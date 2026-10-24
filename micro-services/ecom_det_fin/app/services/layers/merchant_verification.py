"""Identify platforms without inventing seller reputation or verification."""
import re
from dataclasses import dataclass, field
from urllib.parse import urlparse
from factfinder.network import SafeAsyncClient

@dataclass
class MerchantVerification:
    platform: str
    merchant_id: str | None = None
    merchant_name: str | None = None
    verification_status: str = "unknown"
    verification_badges: list[str] = field(default_factory=list)

@dataclass
class LayerResult:
    score: float
    message: str
    merchant_info: MerchantVerification | None = None
    status: str = "unknown"

async def _detect_platform(url: str, html_content: str):
    host = (urlparse(url).hostname or "").lower()
    for platform, domains in {"shopify": ["myshopify.com"], "etsy": ["etsy.com"],
                              "ebay": ["ebay.com", "ebay.in"], "amazon": ["amazon.com", "amazon.in"]}.items():
        if any(host == d or host.endswith("." + d) for d in domains):
            return platform
    # Technology fingerprints identify software only, never trusted platform ownership.
    if "wp-content/plugins/woocommerce" in html_content.lower():
        return "woocommerce"
    if "cdn.shopify.com" in html_content.lower():
        return "shopify"
    return None

async def _extract_merchant_info(platform, url, html_content):
    parsed = urlparse(url)
    info = MerchantVerification(platform)
    if platform == "shopify" and (parsed.hostname or "").endswith(".myshopify.com"):
        info.merchant_id = parsed.hostname[:-len(".myshopify.com")]
    else:
        patterns = {"etsy": r"/shop/([^/?]+)", "ebay": r"/usr/([^/?]+)", "amazon": r"[?&](?:seller|me)=([^&]+)"}
        match = re.search(patterns.get(platform, r"(?!)"), url)
        if match:
            info.merchant_id = match.group(1)
    info.merchant_name = info.merchant_id
    return info

async def _verify_shopify_merchant(merchant_id):
    return {"status": "unknown", "trust_score": None}

async def _verify_etsy_seller(shop_name):
    return {"status": "unknown", "trust_score": None}

async def analyze(url, html_content=None):
    if html_content is None:
        try:
            async with SafeAsyncClient(timeout=4, follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
                html_content = response.text
        except Exception:
            return LayerResult(25, "Merchant page unavailable", status="error")
    platform = await _detect_platform(url, html_content)
    info = await _extract_merchant_info(platform, url, html_content) if platform else None
    description = f"Platform: {platform}; seller: {info.merchant_id or 'not identified'}" if info else "Platform not identified"
    return LayerResult(25, description + "; seller reputation is unverified", info)
