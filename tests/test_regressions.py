import asyncio
import importlib
import io
import json
import socket
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace as NS

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool
from api import app
from factfinder import network, security

PKG = "micro-services.ecom_det_fin.app"
scoring = importlib.import_module(PKG + ".services.scoring")
rules = importlib.import_module(PKG + ".services.risk_rules")
site = importlib.import_module(PKG + ".routers.site")
models = importlib.import_module(PKG + ".models.tables")
db = importlib.import_module(PKG + ".db")
news = importlib.import_module("micro-services.news.news_api")
jobs = importlib.import_module("micro-services.job_offers.job_det")
merchant = importlib.import_module(PKG + ".services.layers.merchant_verification")
business = importlib.import_module(PKG + ".services.layers.business_verification")
feedback = importlib.import_module(PKG + ".services.verified_feedback")

@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("SESSION_SECRET", "test-secret-" * 4)
    monkeypatch.setenv("AUTH_EMAIL", "analyst@example.com")
    monkeypatch.setenv("AUTH_PASSWORD_HASH", security.hash_password("test-password", "test-salt"))
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("API_ACCESS_TOKEN", "service-token-" * 4)
    monkeypatch.setenv("ADMIN_API_KEY", "admin-token-" * 4)
    monkeypatch.setenv("PROOF_STORAGE_DIR", str(tmp_path / "proofs"))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    security._attempts.clear()
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    def session():
        with Session(engine) as s:
            yield s
    app.dependency_overrides[db.get_session] = session
    # Do not initialize the on-disk database in offline endpoint tests.
    monkeypatch.setattr(importlib.import_module("micro-services.main"), "init_db", lambda: None)
    with TestClient(app) as c:
        c.headers["Authorization"] = "Bearer " + "service-token-" * 4
        yield c, engine
    app.dependency_overrides.clear()


def run(coro):
    return asyncio.run(coro)

@pytest.mark.parametrize("url", ["http://127.0.0.1", "http://[::1]", "http://10.0.0.1", "http://169.254.169.254", "http://localhost", "file:///etc/passwd", "https://user:pass@example.com", "http://example.com:8080", "http://[::ffff:127.0.0.1]"])
def test_private_urls_rejected(url):
    with pytest.raises(ValueError):
        network.validate_url(url)


def test_dns_mixed_public_private_rejected(monkeypatch):
    async def exercise():
        async def resolve(*args, **kwargs):
            return [(None,None,None,None,("8.8.8.8",443)),(None,None,None,None,("127.0.0.1",443))]
        monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", resolve)
        with pytest.raises(ValueError):
            await network.public_addresses("example.com",443)
    run(exercise())


def test_dns_pinning_preserves_host_sni_and_rechecks_redirect(monkeypatch):
    async def exercise():
        calls=[]
        async def resolve(host, port):
            calls.append(host)
            if host == "private.example":
                raise ValueError("private resolution")
            return ["8.8.8.8"]
        monkeypatch.setattr(network,"public_addresses",resolve)
        transport=network.PublicTransport()
        def reply(req):
            assert req.url.host == "8.8.8.8"
            assert req.headers["host"] == "example.com"
            assert req.extensions["sni_hostname"] == "example.com"
            return httpx.Response(302,headers={"location":"https://private.example/"})
        transport.inner=httpx.MockTransport(reply)
        async with httpx.AsyncClient(transport=transport,follow_redirects=True) as c:
            with pytest.raises(ValueError):
                await c.get("https://example.com")
        assert calls == ["example.com","private.example"]
    run(exercise())


def test_response_size_limit(monkeypatch):
    async def exercise():
        async def addresses(*args): return ["8.8.8.8"]
        monkeypatch.setattr(network,"public_addresses",addresses)
        async with network.SafeAsyncClient() as c:
            c._transport.inner=httpx.MockTransport(lambda req: httpx.Response(200,content=b"x"*(network.MAX_RESPONSE_BYTES+1)))
            with pytest.raises(ValueError):
                await c.get("https://example.com")
    run(exercise())


def test_threat_cannot_be_safe_and_gates_are_idempotent():
    for reasons in [[{"status":"threat"}], [{"status":"unknown"}], [{"status":"error"}]]:
        once=rules.apply_safety_gates("https://example.com",reasons,0)
        twice=rules.apply_safety_gates("https://example.com",reasons,once[0])
        assert once==twice
        assert once[0]>=25
        assert "Safe to proceed" not in scoring.advice_for(once[0])[0]
    assert rules.apply_safety_gates("https://example.com",[{"status":"threat"}],0)==(90,"Critical")


def test_real_scoring_applies_threat_floor(monkeypatch):
    monkeypatch.setattr(scoring.domain_infra,"analyze",lambda url:NS(score=0,message="ok",status="checked"))
    for module in [scoring.content_ux,scoring.business_verification,scoring.technical_verification,scoring.merchant_verification,scoring.visual_brand]:
        async def low(url): return NS(score=0,message="ok",status="checked")
        monkeypatch.setattr(module,"analyze",low)
    async def threat(url):return NS(score=100,message="confirmed hit",status="threat")
    monkeypatch.setattr(scoring.threat_intel,"analyze",threat)
    assert run(scoring.evaluate_all("https://example.com"))[0]>=90
    assert sum(scoring.settings.weights.values())==pytest.approx(1)


def test_no_simulated_business_or_merchant_verification():
    b=run(business.analyze("https://example.com","27ABCDE1234F1Z5 Street PayPal SSL verified hr@example.com"))
    assert b.score>=25 and not b.verification.gst_valid and not b.verification.phone_verified
    assert run(merchant._verify_shopify_merchant("longshopname"))["status"]=="unknown"
    assert run(merchant._detect_platform("https://etsy.com.attacker.example/shop/name","")) is None
    assert run(merchant._extract_merchant_info("ebay","https://www.ebay.com/usr/alice", "")).merchant_id=="alice"


def test_job_payment_and_negation():
    d=jobs.FakeInternshipDetectorAPI()
    paid=d.analyze_company(jobs.CompanyInfoRequest(name="Example",job_description="Pay upfront by bitcoin. Processing fee."))
    assert paid.is_suspicious and paid.risk_level=="CRITICAL"
    safe=d.analyze_company(jobs.CompanyInfoRequest(name="Example",phone="123",address="Street",job_description="No registration fee. Work from home.",social_media={"linkedin":"https://linkedin.com/company/example"}))
    assert not safe.is_suspicious
    assert not any("registration fee" in flag for flag in safe.red_flags)


def test_news_abstains_without_grounding_and_validates_citations():
    claim={"claim_text":"Claim", "evaluation":"Supported", "evidence":[{"source_title":"Source","url":"https://example.com/","snippet":"Claim"}]}
    payload={"verdict_overall":"True","claims":[claim],"explanation":"Model says true"}
    response=NS(text=json.dumps(payload),candidates=[])
    assert news.parse_grounded_response(response)["verdict"]=="Uncertain"
    grounding=NS(web_search_queries=["query"],grounding_chunks=[NS(web=NS(uri="https://example.com/"))],grounding_supports=[NS(segment=NS(text="Claim"),grounding_chunk_indices=[0])])
    response.candidates=[NS(grounding_metadata=grounding)]
    assert news.parse_grounded_response(response)["verdict"]=="True"
    grounding.grounding_chunks=[NS(web=NS(uri="https://other.example/"))]
    assert news.parse_grounded_response(response)["verdict"]=="Uncertain"


def test_login_rejects_invalid_and_forged_sessions(client):
    c,_=client
    c.headers.pop("Authorization")
    assert c.get("/auth/me").status_code==401
    c.cookies.set(security.COOKIE,"forged.payload")
    assert c.get("/auth/me").status_code==401
    assert c.post("/auth/login",json={"email":"analyst@example.com","password":"wrong"}).status_code==401
    response=c.post("/auth/login",json={"email":"analyst@example.com","password":"test-password"})
    assert response.status_code==200
    assert "HttpOnly" in response.headers["set-cookie"]
    c.cookies.delete(security.COOKIE) # Remove the explicitly forged cookie before checking the real session.
    response=c.post("/auth/login",json={"email":"analyst@example.com","password":"test-password"})
    assert c.get("/auth/me").status_code==200
    assert c.post("/auth/logout",headers={"Origin":"https://attacker.example"}).status_code==403
    assert c.post("/auth/logout").status_code==200
    assert c.get("/auth/me").status_code==401


def test_protected_endpoints_and_missing_providers(client):
    c,_=client
    assert c.post("/news/verify",json={"query":"A factual statement"}).status_code==503
    c.headers.pop("Authorization")
    for path,data in [("/job/analyze",{"name":"Test"}),("/news/verify",{"query":"A claim"}),("/analyze",{"url":"https://example.com"})]:
        assert c.post(path,json=data).status_code==401


def test_admin_requires_separate_credential(client):
    c,_=client
    r=c.post("/api/verified-feedback/admin/verify/1",data={"verification_decision":"approve","reviewer_notes":"Reviewed documents"})
    assert r.status_code==403


def test_endpoint_scoring_history_and_feedback_persistence(client,monkeypatch):
    c,engine=client
    async def evaluate(url,session=None):
        return 45,[scoring.Reason("domain_infra","signal",1,45,"checked")]
    monkeypatch.setattr(site,"evaluate_all",evaluate)
    r=c.post("/ecommerce/analyze-advanced",json={"url":"https://example.com"})
    assert r.status_code==200,r.text
    assert r.json()["risk_score"]==45 and r.json()["badge"]=="High Risk"
    assert c.get("/api/site-history",params={"url":"https://example.com/"}).json()["timeline"][0]["risk_score"]==45
    assert c.post("/ecommerce/feedback",json={"url":"https://example.com","delivered":True}).status_code==200
    with Session(engine) as s:
        assert len(s.exec(select(models.Feedback)).all())==1
    assert c.post("/analyze",json={"url":"http://127.0.0.1"}).status_code==422


def png(color):
    out=io.BytesIO();Image.new("RGB",(2,2),color).save(out,format="PNG");return out.getvalue()

def test_proof_persistence_pending_admin_and_duplicate_rejection(client):
    c,engine=client
    files=[("proof_files",("proof.png",png(color),"image/png")) for color in ["red","green","blue"]]
    data={"url":"https://example.com", "order_details":json.dumps({"order_id":"ORD1","payment_id":"PAY1","amount":100,"order_date":(datetime.now(timezone.utc)-timedelta(days=1)).isoformat(),"product_name":"Item"}),
          "outcome":json.dumps({"delivered":True}),"proof_metadata":json.dumps([{"proof_type":p} for p in ["order_screenshot","payment_receipt","delivery_notification"]])}
    response=c.post("/api/verified-feedback/submit",data=data,files=files)
    assert response.status_code==200,response.text
    assert response.json()["status"]=="pending_verification"
    record_id=response.json()["feedback_id"]
    assert isinstance(record_id,int)
    with Session(engine) as s:
        assert len(s.exec(select(models.FeedbackProof)).all())==3
        assert s.get(models.VerifiedFeedback,record_id).verification_score==0
    assert c.post("/api/verified-feedback/submit",data=data,files=files).status_code==422
    assert c.post(f"/api/verified-feedback/admin/verify/{record_id}",headers={"X-Admin-Key":"admin-token-"*4},data={"verification_decision":"approve","reviewer_notes":"Independently checked all documents"}).status_code==200
    layer=importlib.import_module(PKG+".services.layers.user_feedback")
    with Session(engine) as s:
        assert layer.summarize_feedback(s,"https://example.com/").status=="checked"


def test_invalid_image_rejected_without_model(client):
    c,_=client
    assert c.post("/image/analyze",files={"file":("x.jpg",b"not an image","image/jpeg")}).status_code==415
    assert c.post("/image/analyze",files={"file":("x.png",png("red"),"image/png")}).status_code==503


def test_oversized_request_rejected_before_parser(client):
    c,_=client
    response=c.post("/image/analyze",content=b"x",headers={"Content-Length":str(27*1024*1024)})
    assert response.status_code==413


def test_threat_provider_http_error_is_unknown(monkeypatch):
    layer=importlib.import_module(PKG+".services.layers.threat_intel")
    monkeypatch.setattr(layer.settings,"safe_browsing_api_key","unused-test-value")
    real=httpx.AsyncClient
    def factory(**kwargs):
        return real(transport=httpx.MockTransport(lambda req:httpx.Response(403,json={"error":"denied"})))
    monkeypatch.setattr(layer.httpx,"AsyncClient",factory)
    result=run(layer.analyze("https://example.com"))
    assert result.status=="error" and result.score>=25

@pytest.mark.parametrize("description", ["Do not pay upfront.", "Never pay a registration fee.", "No need to pay upfront.", "No registration fee required."])
def test_job_negated_payment_request_does_not_trigger_critical(description):
    result=jobs.FakeInternshipDetectorAPI().analyze_company(jobs.CompanyInfoRequest(name="Example",job_description=description))
    assert result.risk_level != "CRITICAL"
