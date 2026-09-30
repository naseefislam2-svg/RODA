from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PublicModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ComposeRequest(PublicModel):
    # A finite question set makes accidental free-text private disclosure impossible.
    room_id: Literal["solar-commons", "radio-futura", "circular-objects"]
    question: Literal["brief", "privacy", "checklist"] = "brief"


class Guidance(PublicModel):
    summary: str = Field(min_length=1, max_length=700)
    steps: list[str] = Field(min_length=1, max_length=5)
    privacy_note: str = Field(min_length=1, max_length=400)


class GuidanceResponse(Guidance):
    source: Literal["gemini", "local"]


class ReceiptInput(PublicModel):
    network: Literal["preview", "preprod"]
    room_id: Literal["solar-commons", "radio-futura", "circular-objects"]
    contract_address: str = Field(pattern=r"^[a-f0-9]{64}$")
    tx_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    action: Literal["deploy", "seal", "open", "withdraw"]
    block_height: int = Field(ge=1, le=2**53 - 1)


class ReceiptResponse(ReceiptInput):
    verification: Literal["client_reported"] = "client_reported"
