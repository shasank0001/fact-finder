"""Compatibility helpers; all site fetching uses the public-web transport."""
import asyncio
from .ecom_det_fin.app.services.layers import domain_infra, technical_verification, content_ux, threat_intel

async def check_domain_age(domain):
    result = await asyncio.to_thread(domain_infra.analyze, f"https://{domain}")
    return {"is_suspicious": result.score >= 45, "status": result.status, "details": result.message}

async def check_ssl_certificate(domain):
    result = await technical_verification.analyze(f"https://{domain}")
    return {"suspicious": result.score >= 40, "status": result.status, "details": result.message}

async def detect_suspicious_patterns(url, client=None):
    result = await content_ux.analyze(url)
    return {"is_suspicious": result.score >= 45, "status": result.status, "details": result.message}

async def check_safe_Browse(url, client=None):
    result = await threat_intel.analyze(url)
    return {"safe": result.status == "checked", "checked": result.status in {"checked", "threat"},
            "suspicious": result.status == "threat", "status": result.status, "details": result.message}

async def _unavailable(*args):
    return {"checked": False, "status": "unavailable", "details": "This legacy check is unavailable"}

check_logo_similarity = analyze_whois = analyze_headers = check_broken_links = _unavailable
