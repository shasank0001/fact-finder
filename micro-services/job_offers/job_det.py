from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Optional
from urllib.parse import urlparse
from datetime import datetime
from enum import Enum
import re
import uuid

# ------------------------------- Pydantic Models -------------------------------

class SocialMedia(BaseModel):
    linkedin: Optional[str] = None
    facebook: Optional[str] = None
    twitter: Optional[str] = None
    instagram: Optional[str] = None

class CompanyInfoRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="Company name")
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    job_description: Optional[str] = Field(default=None, max_length=20000)
    salary_offered: Optional[str] = None
    requirements: Optional[str] = None
    contact_person: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    social_media: Optional[SocialMedia] = None
    job_post_date: Optional[str] = None

    @field_validator('email')
    def validate_email(cls, v):
        if v and '@' not in v:
            raise ValueError('Invalid email format')
        return v

    @field_validator('website')
    def validate_website(cls, v):
        if v and not (v.startswith('http://') or v.startswith('https://') or '.' in v):
            raise ValueError('Invalid website format')
        return v

class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class DetectionResponse(BaseModel):
    is_suspicious: bool
    risk_score: float = Field(..., ge=0, le=100, description="Heuristic risk score, not a calibrated probability")
    confidence_score: float = Field(..., ge=0, le=100, deprecated=True, description="Compatibility alias of risk_score; not confidence")
    risk_level: RiskLevel
    red_flags: List[str]
    warnings: List[str]
    recommendations: List[str]
    verification_checks: Dict[str, str]
    similarity_matches: List[str]
    analysis_id: str
    timestamp: datetime
    final_prediction_reason: Optional[str] = None
    checks: Dict[str, str]

class BatchAnalysisRequest(BaseModel):
    companies: List[CompanyInfoRequest] = Field(..., max_length=50)

class BatchAnalysisResponse(BaseModel):
    total_analyzed: int
    suspicious_count: int
    results: Dict[str, DetectionResponse]
    batch_id: str
    timestamp: datetime

class ReportScamRequest(BaseModel):
    company_name: str
    reason: str
    additional_info: Optional[str] = None

# ------------------------------- Detector Core -------------------------------

class FakeInternshipDetectorAPI:
    def __init__(self):
        self.suspicious_domains = {
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
            '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
            'protonmail.com', 'yandex.com', 'mail.ru'
        }

        self.red_flag_keywords = {
            'urgent', 'immediate', 'guaranteed', 'no experience required',
            'easy money', 'pay upfront', 'processing fee',
            'registration fee', 'training fee', 'equipment fee', 'deposit',
            'wire transfer', 'western union', 'moneygram', 'bitcoin',
            'cryptocurrency', 'mlm', 'pyramid', 'get rich quick', 'passive income',
            'make money fast', 'limited time', 'act now', 'first come first serve'
        }

        self.reported_companies = set()
        self.analysis_cache = {}

    def analyze_company(self, company_info: CompanyInfoRequest) -> DetectionResponse:
        analysis_id = str(uuid.uuid4())
        red_flags = []
        verification_checks = {}

        website_score, website_flags = self._check_website(company_info.website)
        email_score, email_flags = self._check_email_domain(company_info.email)
        desc_score, desc_flags = self._analyze_job_description(company_info.job_description)
        contact_score, contact_flags = self._verify_contact_info(company_info)
        social_score, social_flags, social_checks = self._social_media_verification(company_info)
        timing_score, timing_flags = self._timing_analysis(company_info.job_post_date)

        red_flags.extend(website_flags + email_flags + desc_flags + contact_flags + social_flags + timing_flags)
        verification_checks.update(social_checks)

        all_scores = [website_score, email_score, desc_score, contact_score, social_score, timing_score]
        confidence_score = sum(all_scores) / len([s for s in all_scores if s is not None])

        description = (company_info.job_description or "").lower()
        fee_patterns = [r"\bpay\s+(?:a |the )?(?:upfront|(?:registration|processing|training|equipment) fee)",
                        r"\b(?:send|transfer|deposit)\b.{0,30}\b(?:bitcoin|crypto|money|payment)\b",
                        r"\b(?:registration|processing|training|equipment) fee\s+(?:is )?(?:required|mandatory)"]
        fee_request = False
        for sentence in re.split(r"[.!?;\n]+", description):
            for pattern in fee_patterns:
                for match in re.finditer(pattern, sentence):
                    prefix = sentence[:match.start()]
                    if not re.search(r"(?:no|do not|don't|never|no need to|without having to)\s+$", prefix):
                        fee_request = True
        if fee_request:
            confidence_score = max(confidence_score, 85)
        risk_level = self._calculate_risk_level(confidence_score, len(red_flags))
        is_suspicious = risk_level in {"HIGH", "CRITICAL"}
        reason = "Upfront payment request detected" if fee_request else "High risk indicators" if confidence_score >= 60 else "Multiple red flags" if len(red_flags) >= 4 else "Low risk indicators"

        result = DetectionResponse(
            is_suspicious=is_suspicious,
            risk_score=round(min(100, confidence_score), 2),
            confidence_score=round(min(100, confidence_score), 2),
            risk_level=RiskLevel(risk_level),
            red_flags=red_flags,
            warnings=self._generate_warnings(risk_level, red_flags),
            recommendations=self._generate_recommendations(risk_level),
            verification_checks=verification_checks,
            similarity_matches=[],
            analysis_id=analysis_id,
            timestamp=datetime.now(),
            final_prediction_reason=reason,
            checks={"employer_identity": "unverified", "salary": "not independently evaluated", "method": "local heuristics"}
        )

        self.analysis_cache[analysis_id] = result
        return result

    def _check_website(self, website):
        flags = []
        score = 0
        if website:
            parsed_url = urlparse(website if website.startswith("http") else f"http://{website}")
            domain = parsed_url.netloc.lower()
            if len(domain.split('.')[0]) < 3:
                flags.append("Very short domain name")
                score += 15
        return score, flags

    def _check_email_domain(self, email):
        flags = []
        score = 0
        if email:
            domain = email.split('@')[-1].lower()
            if domain in self.suspicious_domains:
                flags.append("Uses free email service")
                score += 25
        return score, flags

    def _analyze_job_description(self, desc):
        flags = []
        score = 0
        if desc:
            lower = desc.lower()
            for keyword in self.red_flag_keywords:
                if keyword in lower and not re.search(r"(?:no|without|never)\s+(?:a |any )?" + re.escape(keyword), lower):
                    flags.append(f"Suspicious keyword found: {keyword}")
                    score += 10
        return score, flags

    def _verify_contact_info(self, info: CompanyInfoRequest):
        flags = []
        score = 0
        if not info.phone or not info.address:
            flags.append("Missing essential contact information")
            score += 10
        return score, flags

    def _social_media_verification(self, info: CompanyInfoRequest):
        flags = []
        checks = {}
        score = 0
        if info.social_media:
            for platform, url in info.social_media.model_dump().items():
                if url:
                    checks[f"{platform}_url"] = f"Provided, not independently verified: {url}"
        else:
            flags.append("No social media provided")
            score += 10
        return score, flags, checks

    def _timing_analysis(self, post_date):
        flags = []
        score = 0
        return score, flags

    def _calculate_risk_level(self, score, red_flags):
        if score >= 80 or red_flags >= 6:
            return "CRITICAL"
        elif score >= 60 or red_flags >= 4:
            return "HIGH"
        elif score >= 40 or red_flags >= 2:
            return "MEDIUM"
        return "LOW"

    def _generate_warnings(self, level, red_flags):
        warnings = []
        if level == "CRITICAL":
            warnings.append("🚨 CRITICAL: Likely scam")
        elif level == "HIGH":
            warnings.append("🔴 HIGH RISK: Multiple red flags")
        elif level == "MEDIUM":
            warnings.append("🟡 CAUTION: Some indicators of scam")
        if any("fee" in f for f in red_flags):
            warnings.append("💰 NEVER pay to apply")
        return warnings

    def _generate_recommendations(self, level):
        base = [
            "Research company independently using multiple sources",
            "Check LinkedIn and other professional networks",
            "Verify company registration with authorities",
            "Look for employee reviews on job sites",
            "Request video interview or in-person meeting"
        ]
        if level in ["HIGH", "CRITICAL"]:
            base += [
                "DO NOT provide personal financial information",
                "DO NOT pay any upfront fees",
                "Report to authorities if confirmed scam"
            ]
        return base
