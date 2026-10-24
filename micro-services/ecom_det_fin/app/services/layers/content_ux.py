from __future__ import annotations
from dataclasses import dataclass
from typing import Tuple
import re
import httpx
from factfinder.network import SafeAsyncClient
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from ...config import settings
from urllib.parse import urlparse

FAKE_URGENCY_PHRASES = [
    r"last\s*few\s*left",
    r"only\s*\d+\s*left",
    r"today\s*only",
    r"limited\s*time",
    r"flash\s*sale",
]

@dataclass
class LayerResult:
    score: float
    message: str
    status: str = "checked"

async def _fetch_html(url: str) -> str | None:
    try:
        timeout = httpx.Timeout(3.0, connect=1.5)
        async with SafeAsyncClient(timeout=timeout, follow_redirects=True) as client:
            res = await client.get(url)
            if res.status_code < 400 and "text/html" in res.headers.get("content-type", ""):
                return res.text
    except Exception:
        return None
    return None


def _check_policy_presence(soup: BeautifulSoup) -> tuple[int, list[str]]:
    risk = 0
    reasons: list[str] = []
    text = soup.get_text(" ").lower()
    policies = ["refund", "return", "privacy", "terms", "contact"]
    missing = [p for p in policies if p not in text]
    if missing:
        risk += 20
        reasons.append(f"Policies missing: {', '.join(missing[:3])}")
    # contact info
    if not re.search(r"\bcontact\b|\bemail\b|\bphone\b", text):
        risk += 15
        reasons.append("Contact info not obvious")
    return risk, reasons


def _check_fake_urgency(soup: BeautifulSoup) -> tuple[int, list[str]]:
    risk = 0
    reasons: list[str] = []
    text = soup.get_text(" ").lower()
    for pat in FAKE_URGENCY_PHRASES:
        if re.search(pat, text):
            risk += 10
            reasons.append("Fake urgency detected")
            break
    return risk, reasons


async def analyze(url: str) -> LayerResult:
    html = await _fetch_html(url)
    if not html:
        return LayerResult(score=25.0, message="Could not fetch page or not HTML", status="error")
    soup = BeautifulSoup(html, "lxml")

    total_risk = 0
    reasons: list[str] = []

    # Platform-aware: if root domain is a known platform and not a hosted storefront, don't apply policy penalties
    parsed = urlparse(url)
    host = (parsed.hostname or '').lower()
    is_platform_root = any(host == p or host.endswith("." + p) for p in settings.platform_domains)
    is_hosted_store = any(host.endswith(suf) for suf in settings.hosted_storefront_suffixes)
    if not is_platform_root or is_hosted_store:
        r1, rs1 = _check_policy_presence(soup)
        total_risk += r1
        reasons += rs1

    r2, rs2 = _check_fake_urgency(soup)
    total_risk += r2
    reasons += rs2

    # Heuristic: detect presence of social links (trust signal) vs none
    social_domains = ["facebook.com", "twitter.com", "x.com", "instagram.com", "linkedin.com"]
    social = [a.get('href','') for a in soup.find_all('a')]

    # Try extracting social links from JSON-LD sameAs entries
    try:
        import json
        for script in soup.find_all('script', type=lambda t: t and 'ld+json' in t):
            try:
                data = json.loads(script.string or "{}")
                # data can be a dict or a list of dicts
                objs = data if isinstance(data, list) else [data]
                for obj in objs:
                    same_as = obj.get('sameAs') if isinstance(obj, dict) else None
                    if isinstance(same_as, list):
                        social.extend([str(u) for u in same_as])
            except Exception:
                continue
    except Exception:
        pass

    # Also check meta tags commonly used for social profiles
    try:
        for meta in soup.find_all('meta'):
            content = meta.get('content') or meta.get('value') or ''
            if content:
                social.append(content)
    except Exception:
        pass

    if not any(any(s in h for s in social_domains) for h in social):
        total_risk += 5
        reasons.append("No social presence links detected")

    # Shallow broken link scan (only anchors on same host, up to 5)
    try:
        samples = [a.get('href') for a in soup.find_all('a', href=True)][:10]
        broken = 0
        if samples:
            base = url
            timeout = httpx.Timeout(2.0, connect=1.0)
            async with SafeAsyncClient(timeout=timeout, follow_redirects=True) as client:
                for href in samples[:3]:
                    full = urljoin(base, href)
                    try:
                        r = await client.head(full)
                        if r.status_code >= 400:
                            broken += 1
                    except Exception:
                        broken += 1
        if broken >= 3:
            total_risk += 10
            reasons.append(f"Broken links detected: {broken}")
    except Exception:
        pass

    # Contact email domain heuristic (free email domains for store contact)
    try:
        emails = set(re.findall(r"[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+)", soup.get_text(" ")))
        for dom in emails:
            if dom.lower() in settings.free_email_domains:
                total_risk += 10
                reasons.append(f"Contact email uses free domain: {dom}")
                break
    except Exception:
        pass

    # Brand lookalike heuristic via page title
    try:
        # Apply brand title mismatch only when not on platform root (homepages often reference multiple brands)
        if not is_platform_root or is_hosted_store:
            title = (soup.title.string or "").lower() if soup.title else ""
            for brand, canon_list in settings.canonical_brands.items():
                if brand in title:
                    if not any(host == c or host.endswith("." + c) for c in canon_list):
                        total_risk += 25
                        reasons.append(f"Brand lookalike: mentions '{brand}' but domain not canonical")
                        break
    except Exception:
        pass

    # In strict mode, if we fetched content but found very few trust signals, apply a small floor
    if settings.strict_mode and total_risk < 10:
        total_risk = 10.0
        reasons.append("Strict mode floor for limited trust signals")

    msg = "; ".join(reasons) if reasons else "Basic policy/contact checks passed"
    return LayerResult(score=min(100.0, float(total_risk)), message=msg)
