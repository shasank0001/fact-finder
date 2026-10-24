"""HTTPS availability is a transport signal, not proof of seller identity."""
from dataclasses import dataclass
from urllib.parse import urlparse
from factfinder.network import SafeAsyncClient

@dataclass
class LayerResult:
    score: float
    message: str
    status: str = "unknown"

async def analyze(url: str):
    try:
        async with SafeAsyncClient(timeout=4, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
        if urlparse(str(response.url)).scheme != "https" or urlparse(url).scheme != "https":
            return LayerResult(40, "Unencrypted HTTP is present in the requested/final URL", "checked")
        return LayerResult(5, "HTTPS certificate validated; merchant identity and mail records unverified", "checked")
    except Exception:
        return LayerResult(25, "HTTPS verification unavailable", "error")
