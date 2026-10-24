from dataclasses import dataclass
import httpx
from ...config import settings


@dataclass
class LayerResult:
    score: float
    message: str
    status: str = "unknown"


async def analyze(url: str):
    if not settings.safe_browsing_api_key:
        return LayerResult(25, "Safe Browsing is not configured; PhishTank is unavailable")
    payload = {"client": {"clientId": "factfinder", "clientVersion": "0.1"}, "threatInfo": {
        "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
        "platformTypes": ["ANY_PLATFORM"], "threatEntryTypes": ["URL"], "threatEntries": [{"url": url}]}}
    try:
        async with httpx.AsyncClient(timeout=6, trust_env=False) as client:
            response = await client.post("https://safebrowsing.googleapis.com/v4/threatMatches:find",
                                         params={"key": settings.safe_browsing_api_key}, json=payload)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict) or "error" in data:
                raise ValueError("Invalid threat provider response")
            if data.get("matches"):
                return LayerResult(100, "Safe Browsing confirmed a threat match", "threat")
            return LayerResult(0, "Safe Browsing: no listed threats found", "checked")
    except Exception:
        return LayerResult(25, "Safe Browsing unavailable", "error")
