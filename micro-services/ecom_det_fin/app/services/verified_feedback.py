"""Proof format/completeness checks cannot automatically verify a transaction."""
from enum import Enum
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field, field_validator
from ..models.tables import VerifiedFeedback, FeedbackStatus

class ProofType(str, Enum):
    ORDER_SCREENSHOT = "order_screenshot"
    DELIVERY_NOTIFICATION = "delivery_notification"
    PAYMENT_RECEIPT = "payment_receipt"
    EMAIL_CONFIRMATION = "email_confirmation"
    BANK_STATEMENT = "bank_statement"
    TRACKING_INFO = "tracking_info"

class OrderDetails(BaseModel):
    order_id: str = Field(min_length=1, max_length=200)
    payment_id: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0, le=10000000)
    order_date: datetime
    product_name: str = Field(min_length=1, max_length=500)
    product_description: str | None = Field(default=None, max_length=2000)
    expected_delivery: datetime | None = None

    @field_validator("order_date", "expected_delivery")
    @classmethod
    def normalize_date(cls, value):
        if value is None:
            return value
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)

class FeedbackOutcome(BaseModel):
    delivered: bool
    delivery_quality: int | None = Field(default=None, ge=1, le=5)
    payment_issues: bool = False
    product_matches_description: bool | None = None
    delivery_date: datetime | None = None

    @field_validator("delivery_date")
    @classmethod
    def normalize_date(cls, value):
        return OrderDetails.normalize_date(value)

@dataclass
class VerificationProof:
    proof_type: ProofType
    file_hash: str
    metadata: dict
    confidence_score: float = 0

class FeedbackVerifier:
    async def verify_proof_files(self, proofs):
        # Hashes and metadata establish no authenticity by themselves.
        return 0.0

    async def calculate_final_verification_score(self, feedback, proofs):
        return 0.0, FeedbackStatus.PENDING_VERIFICATION

class VerifiedFeedbackAPI:
    async def submit_feedback(self, url, user_id, order_details, proof_files, outcome, session):
        order = OrderDetails.model_validate(order_details)
        result = FeedbackOutcome.model_validate(outcome)
        if order.order_date > datetime.now(timezone.utc):
            raise ValueError("Order date must be in the past")
        feedback = VerifiedFeedback.model_validate({
            "url": url, "user_id": user_id, "order_id": order.order_id,
            "payment_id": order.payment_id, "order_amount": order.amount,
            "order_date": order.order_date, "expected_delivery": order.expected_delivery,
            "product_name": order.product_name, "product_description": order.product_description,
            "delivered_successfully": result.delivered, "delivery_quality": result.delivery_quality,
            "payment_issues": result.payment_issues, "product_matches_description": result.product_matches_description,
            "actual_delivery": result.delivery_date,
            "proof_data": __import__("json").dumps(proof_files),
            "verification_score": 0, "weight": 0, "status": FeedbackStatus.PENDING_VERIFICATION,
        })
        session.add(feedback)
        session.flush()
        return {"feedback_id": feedback.id, "status": feedback.status, "verification_score": 0,
                "message": "Evidence received; awaiting independent manual review"}
