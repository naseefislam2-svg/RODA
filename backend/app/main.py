import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .catalog import ROOMS
from .config import get_settings
from .db import Base, GuidanceAudit, PublicReceipt, engine, get_session
from .guidance import compose
from .schemas import ComposeRequest, GuidanceResponse, ReceiptInput, ReceiptResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.auto_create_tables and settings.environment != "production":
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="RODA public API", version="1.0.0", lifespan=lifespan,
              docs_url="/docs" if settings.environment != "production" else None,
              redoc_url=None, openapi_url="/openapi.json" if settings.environment != "production" else None)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","),
                   allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
DbSession = Annotated[AsyncSession, Depends(get_session)]
request_windows: dict[str, deque] = defaultdict(deque)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, _exc: RequestValidationError):
    # FastAPI's default response echoes invalid input, which may contain secrets.
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid public payload. Extra fields are forbidden."},
    )


@app.middleware("http")
async def public_boundary(request: Request, call_next):
    if request.method == "POST":
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 4096:
                return JSONResponse(status_code=413, content={"detail": "Public payload is too large"})
        request._body = bytes(body)
        # No IPs retained: one bounded process-wide limit. Use an edge limiter for multiple replicas.
        window = request_windows["writes"]
        now = time.monotonic()
        while window and window[0] < now - 60:
            window.popleft()
        if len(window) >= 60:
            return JSONResponse(status_code=429, content={"detail": "Please try again in a minute"})
        window.append(now)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/health")
async def health(session: DbSession):
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(503, "Database unavailable") from exc
    return {"status": "ok", "service": "roda-public-api"}


@app.get("/api/rooms")
async def rooms():
    return {"rooms": ROOMS, "mode": "sample_catalog"}


@app.get("/api/metrics")
async def metrics(session: DbSession):
    reported = await session.scalar(select(func.count()).select_from(PublicReceipt)) or 0
    verified = await session.scalar(select(func.count()).select_from(PublicReceipt).where(
        PublicReceipt.verification == "indexer_verified")) or 0
    return {"sample_commissions": len(ROOMS), "reported_receipts": reported,
            "verified_transactions": verified, "mode": "sample_catalog"}


@app.post("/api/compose", response_model=GuidanceResponse)
async def guidance(request: ComposeRequest, session: DbSession):
    result, digest = await compose(request, settings)
    session.add(GuidanceAudit(request_hash=digest, source=result.source))
    await session.commit()
    return result


@app.post("/api/receipts", response_model=ReceiptResponse, status_code=201)
async def report_receipt(receipt: ReceiptInput, session: DbSession):
    # The browser only sends finalized results. This API independently labels every
    # unauthenticated report as client_reported; it never promotes it to verified.
    existing = await session.scalar(select(PublicReceipt).where(
        PublicReceipt.network == receipt.network, PublicReceipt.tx_hash == receipt.tx_hash))
    if existing:
        if any(getattr(existing, key) != value for key, value in receipt.model_dump().items()):
            raise HTTPException(409, "Transaction was already reported with different public metadata")
        return ReceiptResponse(**receipt.model_dump())
    session.add(PublicReceipt(**receipt.model_dump()))
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, "Transaction already reported") from exc
    return ReceiptResponse(**receipt.model_dump())
