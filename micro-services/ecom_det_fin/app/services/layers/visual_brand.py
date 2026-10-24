from dataclasses import dataclass

@dataclass
class LayerResult:
    score: float
    message: str
    status: str = "unknown"

async def analyze(url: str):
    return LayerResult(25, "Visual impersonation analysis is not available")
