from collections.abc import AsyncIterator
from datetime import UTC, datetime

from sqlalchemy import BigInteger, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .config import get_settings


class Base(DeclarativeBase):
    pass


class PublicReceipt(Base):
    __tablename__ = "public_receipts"
    __table_args__ = (UniqueConstraint("network", "tx_hash"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    network: Mapped[str] = mapped_column(String(12))
    room_id: Mapped[str] = mapped_column(String(64))
    contract_address: Mapped[str] = mapped_column(String(64), index=True)
    tx_hash: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(12))
    block_height: Mapped[int] = mapped_column(BigInteger)
    verification: Mapped[str] = mapped_column(String(24), default="client_reported")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class GuidanceAudit(Base):
    __tablename__ = "guidance_audit"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    source: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


def database_engine(url: str):
    parsed = make_url(url)
    connect_args = {}
    if parsed.drivername in {"postgres", "postgresql", "postgresql+asyncpg"}:
        # asyncpg expects ssl, not libpq sslmode/channel_binding query parameters.
        query = dict(parsed.query)
        query.pop("sslmode", None)
        query.pop("channel_binding", None)
        parsed = parsed.set(drivername="postgresql+asyncpg", query=query)
        connect_args = {"ssl": True, "statement_cache_size": 0}
    return create_async_engine(parsed, pool_pre_ping=True, connect_args=connect_args)


engine = database_engine(get_settings().database_url)
sessions = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with sessions() as session:
        yield session
