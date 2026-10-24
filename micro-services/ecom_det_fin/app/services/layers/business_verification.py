"""Report page assertions separately from independently verified business identity."""
from dataclasses import dataclass
from typing import Optional
import re
from bs4 import BeautifulSoup
from factfinder.network import SafeAsyncClient

@dataclass
class BusinessVerification:
    is_registered: bool = False
    gst_valid: bool = False
    linkedin_verified: bool = False
    phone_verified: bool = False
    address_verified: bool = False

@dataclass
class LayerResult:
    score: float
    message: str
    verification: Optional[BusinessVerification] = None
    status: str = "unknown"

async def _verify_gst_number(gst: str):
    # Format presence is deliberately not identity verification.
    return False

async def analyze(url: str, html_content: str = None):
    if html_content is None:
        try:
            async with SafeAsyncClient(timeout=4, follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
                html_content = response.text
        except Exception:
            return LayerResult(25, "Business page unavailable", BusinessVerification(), "error")
    text = BeautifulSoup(html_content, "lxml").get_text(" ")
    claims = []
    if re.search(r'\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b', text, re.I):
        claims.append("tax ID format present")
    if re.search(r'\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b', text, re.I):
        claims.append("contact email present")
    suffix = "; " + ", ".join(claims) if claims else ""
    return LayerResult(25, "Business identity has not been independently verified" + suffix, BusinessVerification())
