"""Unified API. Run from the repository root with uvicorn api:app."""
import asyncio
from contextlib import asynccontextmanager
from dataclasses import asdict
from datetime import datetime
import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlmodel import Session

load_dotenv()

from factfinder.limits import BodyLimitMiddleware
from factfinder.security import router as auth_router, require_user
from factfinder.images import analyze_bytes, MAX_UPLOAD
from .news.news_api import check_news_truth
from .job_offers.job_main import analyze_job_offer
from .job_offers.job_det import CompanyInfoRequest
from .ecom_det_fin.app.db import init_db, get_session
from .ecom_det_fin.app.models.schemas import CheckSiteRequest, FeedbackRequest
from .ecom_det_fin.app.routers.site import check_site, submit_feedback, router as site_router
from .ecom_det_fin.app.routers.verified_feedback import router as verified_feedback_router


@asynccontextmanager
async def lifespan(app):
    init_db()
    yield


app = FastAPI(title="FactFinder", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080").split(","),
                   allow_credentials=True, allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization", "X-Admin-Key"])
app.add_middleware(BodyLimitMiddleware)
app.include_router(auth_router)
app.include_router(site_router)
app.include_router(verified_feedback_router)
_image_slots = asyncio.Semaphore(1)
_scan_slots = asyncio.Semaphore(8)

class NewsRequest(BaseModel):
    query: str = Field(min_length=3, max_length=20000)

@app.get("/")
def root():
    return {"service": "FactFinder", "status": "ok"}

@app.post("/news/verify", dependencies=[Depends(require_user)])
async def verify_news(request: NewsRequest):
    async with _scan_slots:
        try:
            result = await asyncio.wait_for(check_news_truth(request.query), 45)
        except TimeoutError:
            raise HTTPException(504, "News verification timed out") from None
    return {"result": result}

@app.post("/job/analyze", dependencies=[Depends(require_user)])
def analyze_job(request: CompanyInfoRequest):
    return {"result": analyze_job_offer(request.model_dump()).model_dump()}

@app.post("/ecommerce/analyze-advanced", dependencies=[Depends(require_user)])
async def analyze_ecommerce_advanced(request: CheckSiteRequest, session: Session = Depends(get_session)):
    async with _scan_slots:
        try:
            result = await asyncio.wait_for(check_site(request, session), 15)
        except TimeoutError:
            raise HTTPException(504, "Site verification timed out") from None
    return {**result.model_dump(mode="json"), "analysis_type": "advanced"}

@app.post("/analyze", dependencies=[Depends(require_user)])
async def analyze(request: CheckSiteRequest, session: Session = Depends(get_session)):
    # Compatibility endpoint shares the maintained pipeline instead of divergent checks.
    result = await analyze_ecommerce_advanced(request, session)
    return {**result, "verdict": result["badge"], "analysis_type": "basic"}

@app.post("/ecommerce/feedback", dependencies=[Depends(require_user)])
async def feedback(request: FeedbackRequest, session: Session = Depends(get_session)):
    return await submit_feedback(request, session)

@app.post("/image/analyze", dependencies=[Depends(require_user)])
async def analyze_image(file: UploadFile = File(...)):
    contents = await file.read(MAX_UPLOAD + 1)
    await file.close()
    if len(contents) > MAX_UPLOAD:
        raise HTTPException(413, "File exceeds 10 MB")
    if _image_slots.locked():
        raise HTTPException(429, "Image detector is busy; try again shortly")
    async with _image_slots:
        return await asyncio.to_thread(analyze_bytes, contents)

@app.get("/ecommerce/compare", dependencies=[Depends(require_user)])
async def compare(url: str, session: Session = Depends(get_session)):
    result = await analyze_ecommerce_advanced(CheckSiteRequest(url=url), session)
    return {"url": url, "message": "Basic and advanced now use one maintained scoring pipeline", "analysis": result}
