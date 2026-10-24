from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field
from enum import Enum

class FeedbackStatus(str, Enum):
    PENDING_VERIFICATION = "pending_verification"
    VERIFIED_DELIVERED = "verified_delivered"
    VERIFIED_SCAM = "verified_scam"
    VERIFICATION_FAILED = "verification_failed"
    REJECTED = "rejected"

class SiteScan(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    url: str
    risk_score: float
    badge: str
    reasons_json: str  # JSON-serialized Reason list
    scanned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)

class Feedback(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    url: str
    delivered: bool
    order_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)

class VerifiedFeedback(SQLModel, table=True):
    __tablename__ = "verified_feedback"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Basic Info
    url: str = Field(index=True)
    user_id: str = Field(index=True)  # Anonymous but trackable
    submission_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Order Details (Required)
    order_id: Optional[str] = None
    payment_id: Optional[str] = None
    order_amount: Optional[float] = None
    order_date: Optional[datetime] = None
    expected_delivery: Optional[datetime] = None
    actual_delivery: Optional[datetime] = None

    # Product Details
    product_name: Optional[str] = None
    product_description: Optional[str] = None
    product_price: Optional[float] = None
    quantity: Optional[int] = None

    # Verification Status
    status: FeedbackStatus = FeedbackStatus.PENDING_VERIFICATION
    verification_score: float = 0.0  # 0-100, how confident we are in this feedback

    # Proof Files (stored as hashes + metadata)
    proof_data: str = Field(default="{}")  # JSON string of verification proofs

    # Outcome
    delivered_successfully: Optional[bool] = None
    delivery_quality: Optional[int] = None  # 1-5 rating
    payment_issues: bool = False
    product_matches_description: Optional[bool] = None

    # Verification Notes
    verification_notes: Optional[str] = None
    reviewer_id: Optional[str] = None  # Admin who verified

    # Impact on Risk Score
    weight: float = 0.0  # How much this feedback affects the site's risk score

class UserReputationScore(SQLModel, table=True):
    __tablename__ = "user_reputation"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True, unique=True)
    reputation_score: float = Field(default=50.0)  # 0-100
    total_feedbacks: int = Field(default=0)
    verified_feedbacks: int = Field(default=0)
    false_reports: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FeedbackProof(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    feedback_id: int = Field(foreign_key="verified_feedback.id", index=True)
    file_hash: str = Field(unique=True, index=True)
    storage_path: str
    content_type: str
