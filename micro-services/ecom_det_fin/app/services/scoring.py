from dataclasses import dataclass
import asyncio
from ..config import settings
from .layers import domain_infra, content_ux, visual_brand, threat_intel, user_feedback
from .layers import business_verification, technical_verification, merchant_verification
from .risk_rules import apply_safety_gates, badge_for
from factfinder.network import validate_url


@dataclass
class Reason:
    layer: str
    message: str
    weight: float
    score: float
    status: str = "unknown"


def to_badge(score: float) -> str:
    return badge_for(score)


def advice_for(score: float):
    if score >= 70:
        return "Do not proceed", ["Critical risk evidence detected", "Do not send payment or financial information"]
    if score >= 45:
        return "High risk — verify independently", ["Check business and seller identity", "Avoid payment until concerns are resolved"]
    if score >= 25:
        return "Exercise caution — verification incomplete", ["Some checks are unavailable or unverified", "Verify seller identity and use payment protection"]
    return "No strong risk signals found", ["This is not a guarantee of safety", "Verify seller identity and use payment protection"]


async def _with_timeout(coro, layer_name, timeout_sec=8, fallback_score=25, fallback_message="Analysis unavailable"):
    try:
        return await asyncio.wait_for(coro, timeout_sec)
    except Exception:
        return type("LayerResult", (), {"score": fallback_score, "message": f"{layer_name}: {fallback_message}", "status": "error"})()


async def evaluate_all(url: str, session=None):
    validate_url(url)
    layers = [
        ("domain_infra", asyncio.to_thread(domain_infra.analyze, url)),
        ("content_ux", content_ux.analyze(url)),
        ("business_verification", business_verification.analyze(url)),
        ("technical_verification", technical_verification.analyze(url)),
        ("merchant_verification", merchant_verification.analyze(url)),
        ("visual_brand", visual_brand.analyze(url)),
        ("threat_intel", threat_intel.analyze(url)),
    ]
    results = await asyncio.gather(*[_with_timeout(coro, name) for name, coro in layers])
    reasons = [Reason(name, result.message, settings.weights[name], result.score, getattr(result, "status", "unknown"))
               for (name, _), result in zip(layers, results)]
    if session is not None:
        feedback = user_feedback.summarize_feedback(session, url)
        reasons.append(Reason("user_feedback", feedback.message, settings.weights["user_feedback"], feedback.score, feedback.status))
    else:
        reasons.append(Reason("user_feedback", "No verified feedback available", settings.weights["user_feedback"], 25, "unknown"))
    raw = sum(r.score * r.weight for r in reasons)
    score, _ = apply_safety_gates(url, [vars(r) for r in reasons], raw)
    return score, reasons
