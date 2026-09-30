import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.config import Settings
from app.db import GuidanceAudit, sessions
from app.guidance import compose, public_prompt, redact_sensitive
from app.main import app
from app.schemas import ComposeRequest


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def valid_receipt(**changes):
    payload = {
        "network": "preview",
        "room_id": "solar-commons",
        "contract_address": "a" * 64,
        "tx_hash": "b" * 64,
        "action": "deploy",
        "block_height": 42,
    }
    payload.update(changes)
    return payload


def test_health_and_sample_catalog(client):
    assert client.get("/health").json() == {"status": "ok", "service": "roda-public-api"}
    catalog = client.get("/api/rooms").json()
    assert catalog["mode"] == "sample_catalog"
    assert all(room["is_sample"] for room in catalog["rooms"])


@pytest.mark.asyncio
async def test_gemini_fallback_is_deterministic_without_a_key():
    request = ComposeRequest(room_id="solar-commons", question="privacy")
    settings = Settings(gemini_enabled=False, gemini_api_key="")
    first, digest_one = await compose(request, settings)
    second, digest_two = await compose(request, settings)
    assert first == second
    assert first.source == "local"
    assert digest_one == digest_two
    assert re.fullmatch(r"[a-f0-9]{64}", digest_one)


def test_sensitive_input_redaction():
    text = "email me at bidder@example.com; seed: word word word; key 0x" + "a" * 64
    redacted = redact_sensitive(text)
    assert "bidder@example.com" not in redacted
    assert "word word word" not in redacted
    assert "0x" + "a" * 64 not in redacted


def test_gemini_prompt_contains_public_fields_only():
    prompt = public_prompt(ComposeRequest(room_id="radio-futura", question="checklist"))
    assert "Rádio Futura" not in prompt  # organization identity is not needed for guidance
    assert "offerAmount" not in prompt
    assert "workerSecret" not in prompt
    assert "private until" in prompt


def test_receipt_rejects_private_fields_without_echoing_them(client):
    response = client.post("/api/receipts", json={**valid_receipt(), "private_bid": "999999"})
    assert response.status_code == 422
    assert "999999" not in response.text
    assert response.json()["detail"] == "Invalid public payload. Extra fields are forbidden."


def test_receipt_is_idempotent_and_conflicts_are_rejected(client):
    receipt = valid_receipt(tx_hash="c" * 64)
    assert client.post("/api/receipts", json=receipt).status_code == 201
    assert client.post("/api/receipts", json=receipt).status_code == 201
    conflict = {**receipt, "contract_address": "d" * 64}
    assert client.post("/api/receipts", json=conflict).status_code == 409


def test_metrics_never_count_unverified_browser_reports(client):
    client.post("/api/receipts", json=valid_receipt(tx_hash="e" * 64))
    metrics = client.get("/api/metrics").json()
    assert metrics["reported_receipts"] >= 1
    assert metrics["verified_transactions"] == 0


@pytest.mark.asyncio
async def test_guidance_stores_only_a_hash(client):
    response = client.post("/api/compose", json={"room_id": "solar-commons", "question": "brief"})
    assert response.status_code == 200
    async with sessions() as session:
        latest = await session.scalar(select(GuidanceAudit).order_by(GuidanceAudit.id.desc()))
        count = await session.scalar(select(func.count()).select_from(GuidanceAudit))
        assert latest is not None and re.fullmatch(r"[a-f0-9]{64}", latest.request_hash)
        assert count and count >= 1


def test_invalid_ids_and_oversized_payloads_are_rejected(client):
    invalid = client.post("/api/compose", json={"room_id": "secret-room", "question": "brief"})
    assert invalid.status_code == 422
    response = client.post("/api/compose", content=b"x" * 4097, headers={"content-type": "application/json"})
    assert response.status_code == 413
