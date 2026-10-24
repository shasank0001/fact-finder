"""Apply severity floors once, from explicit evidence status."""
from urllib.parse import urlparse
from ..config import settings

PHISHING_TOKENS = {"refund", "verify", "verification", "payment", "login", "billing", "unlock"}


def badge_for(score: float) -> str:
    if score < 25:
        return "Low Risk"
    if score < 45:
        return "Caution"
    if score < 70:
        return "High Risk"
    return "Critical"


def apply_safety_gates(url: str, reasons: list[dict], raw_score: float) -> tuple[float, str]:
    score = float(raw_score)
    # Missing evidence is uncertainty, not an assertion of fraud or safety.
    unknown = any(r.get("status", "unknown") in {"unknown", "error", "unavailable"} for r in reasons)
    if unknown:
        score = max(score, 25.0)
    host = (urlparse(url).hostname or "").lower()
    if host not in settings.verified_major_platforms:
        tokens = {t for part in host.split(".") for t in part.replace("-", " ").split()}
        if tokens & PHISHING_TOKENS:
            score = max(score, 45.0)
    if any(r.get("status") == "threat" for r in reasons):
        score = max(score, 90.0)
    score = max(0.0, min(100.0, score))
    return score, badge_for(score)
