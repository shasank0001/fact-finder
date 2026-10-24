from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import json
import math

DEFAULT_WEIGHTS = {
    "domain_infra": 0.25,  # INCREASED: Domain analysis critical for typosquatting
    "content_ux": 0.10,
    "business_verification": 0.15,
    "technical_verification": 0.08,
    "merchant_verification": 0.30,  # Reduced slightly to balance
    "visual_brand": 0.05,
    "threat_intel": 0.12,
    "user_feedback": 0.05,
}

class Settings(BaseSettings):
    app_name: str = "FactState API"
    db_url: str = Field(default="sqlite:///data/app.db", alias="DB_URL")
    risk_weights_json: str | None = Field(default=None, alias="RISK_WEIGHTS_JSON")

    safe_browsing_api_key: str | None = Field(default=None, alias="SAFE_BROWSING_API_KEY")
    phishtank_api_key: str | None = Field(default=None, alias="PHISHTANK_API_KEY")

    # Simple risk configuration helpers
    suspicious_tlds: list[str] = Field(default_factory=lambda: [
        ".tk", ".ml", ".ga", ".cf",  # High-risk free TLDs
        ".top", ".xyz", ".shop", ".store", ".online", ".icu", ".cam", ".hair",
        ".monster", ".click", ".rest", ".buzz", ".pw", ".cc", ".ws", ".nu",
        ".bid", ".download", ".stream", ".loan", ".win", ".review", ".faith",
    ])

    canonical_brands: dict[str, list[str]] = Field(default_factory=lambda: {
        "amazon": ["amazon.com", "amazon.in", "amazon.co.uk", "amazon.ca", "amazon.de", "amazon.fr"],
        "flipkart": ["flipkart.com"],
        "myntra": ["myntra.com"],
        "ajio": ["ajio.com"],
        "snapdeal": ["snapdeal.com"],
        "meesho": ["meesho.com"],
        "shopsy": ["shopsy.com"],
        "walmart": ["walmart.com"],
        "alibaba": ["alibaba.com"],
        "aliexpress": ["aliexpress.com"],
        "ebay": ["ebay.com"],
        "etsy": ["etsy.com"],
        "shein": ["shein.com"],
        "google": ["google.com", "google.in"],
        "apple": ["apple.com"],
        "microsoft": ["microsoft.com"],
        "paypal": ["paypal.com"],
        "stripe": ["stripe.com"],
    })

    # Major verified platforms (should get extremely low risk scores)
    verified_major_platforms: list[str] = Field(default_factory=lambda: [
        "amazon.com", "amazon.in", "amazon.co.uk", "amazon.ca", "amazon.de", "amazon.fr",
        "flipkart.com", "myntra.com", "shopsy.com", "walmart.com", "target.com", "bestbuy.com",
        "google.com", "apple.com", "microsoft.com", "paypal.com", "stripe.com"
    ])

    # Multi-vendor marketplaces (require merchant verification)
    marketplace_platforms: list[str] = Field(default_factory=lambda: [
        "myshopify.com", "etsy.com", "ebay.com", "aliexpress.com", "alibaba.com",
        "bonanza.com", "mercari.com", "poshmark.com", "depop.com", "vinted.com",
        "facebook.com/marketplace", "instagram.com/shopping"
    ])

    free_email_domains: list[str] = Field(default_factory=lambda: [
        "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "proton.me", "protonmail.com",
        "icloud.com", "yandex.com", "zoho.com",
    ])

    # Platform domains where the root page is not a storefront (policy checks not applicable)
    platform_domains: list[str] = Field(default_factory=lambda: [
        "shopify.com", "wix.com", "wordpress.com", "squarespace.com", "bigcommerce.com",
        "woocommerce.com", "magento.com", "adobe.com", "shopifycdn.com",
        "amazon.com", "ebay.com", "etsy.com", "walmart.com",
    ])

    # Hosted storefront suffixes (e.g., *.myshopify.com are individual shops)
    hosted_storefront_suffixes: list[str] = Field(default_factory=lambda: [
        ".myshopify.com", ".wixsite.com", ".square.site", ".bigcartel.com", ".weebly.com"
    ])

    # Strict mode tightens thresholds and adds risk floors for certain findings
    strict_mode: bool = Field(default=True, alias="STRICT_MODE")

    # Business verification APIs
    opencorporates_api_key: str | None = Field(default=None, alias="OPENCORPORATES_API_KEY")
    companies_house_api_key: str | None = Field(default=None, alias="COMPANIES_HOUSE_API_KEY")

    # Trusted registrars and hosting providers
    trusted_registrars: list[str] = Field(default_factory=lambda: [
        "namecheap", "godaddy", "google", "cloudflare", "amazon", "gandi", "hover", "name.com",
        "network solutions", "enom", "tucows", "1&1", "ionos", "ovh"
    ])

    trusted_hosting_asns: list[int] = Field(default_factory=lambda: [
        13335,  # Cloudflare
        16509,  # Amazon AWS
        15169,  # Google Cloud
        8075,   # Microsoft Azure
        20940,  # Akamai
        54113,  # Fastly
    ])

    # Suspicious indicators for deeper analysis
    high_risk_countries: list[str] = Field(default_factory=lambda: [
        "CN", "RU", "PK", "BD", "NG", "GH"  # Countries with high fraud rates
    ])

    # Payment gateway whitelist (trusted processors)
    trusted_payment_processors: list[str] = Field(default_factory=lambda: [
        "stripe", "paypal", "razorpay", "payu", "cashfree", "instamojo", "square",
        "shopify payments", "woocommerce", "authorize.net"
    ])

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def weights(self) -> dict[str, float]:
        if self.risk_weights_json:
            try:
                data = json.loads(self.risk_weights_json)
                # Ensure weights sum roughly to 1.0; normalize if needed
                total = sum(data.values())
                if set(data) == set(DEFAULT_WEIGHTS) and all(isinstance(v, (int, float)) and math.isfinite(v) and v >= 0 for v in data.values()) and math.isfinite(total) and total > 0:
                    return {k: float(v) / total for k, v in data.items()}
            except Exception:
                pass
        total = sum(DEFAULT_WEIGHTS.values())
        return {k: v / total for k, v in DEFAULT_WEIGHTS.items()}

settings = Settings()
