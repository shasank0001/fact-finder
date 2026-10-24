from dataclasses import dataclass
from sqlmodel import Session, select
from ...models.tables import VerifiedFeedback, FeedbackStatus

@dataclass
class LayerResult:
    score: float
    message: str
    status: str = "unknown"

def summarize_feedback(session: Session, url: str):
    records = session.exec(select(VerifiedFeedback).where(
        VerifiedFeedback.url == url,
        VerifiedFeedback.status.in_([FeedbackStatus.VERIFIED_DELIVERED, FeedbackStatus.VERIFIED_SCAM])
    )).all()
    if not records:
        return LayerResult(25, "No independently reviewed feedback")
    failures = sum(r.status == FeedbackStatus.VERIFIED_SCAM for r in records)
    return LayerResult(100 * failures / len(records), f"Reviewed feedback: {failures} scam reports / {len(records)}", "checked")
