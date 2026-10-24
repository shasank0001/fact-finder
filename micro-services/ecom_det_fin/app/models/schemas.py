from __future__ import annotations
from pydantic import BaseModel, HttpUrl, Field, field_validator
from typing import Optional, List, Dict
from datetime import datetime
from factfinder.network import validate_url

class CheckSiteRequest(BaseModel):
    url: HttpUrl

    @field_validator("url")
    @classmethod
    def public_url(cls, value):
        validate_url(str(value))
        return value

class Reason(BaseModel):
    layer: str
    message: str
    weight: float
    status: str = "unknown"
    score: float

class Advice(BaseModel):
    payment: str
    actions: List[str]

class RiskResult(BaseModel):
    url: HttpUrl
    risk_score: float = Field(ge=0, le=100)
    badge: str
    reasons: List[Reason]
    advice: Advice
    scanned_at: datetime

class FeedbackRequest(BaseModel):
    url: HttpUrl
    delivered: bool
    order_hash: Optional[str] = Field(default=None, description="Optional proof hash or reference ID")

class HistoryPoint(BaseModel):
    scanned_at: datetime
    risk_score: float
    badge: str

class SiteHistoryResponse(BaseModel):
    url: HttpUrl
    timeline: List[HistoryPoint]
