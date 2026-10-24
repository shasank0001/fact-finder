import hashlib
import io
import json
import os
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError
from factfinder.security import require_user, require_admin
from ..db import get_session
from ..models.tables import VerifiedFeedback, FeedbackProof, FeedbackStatus
from ..services.verified_feedback import VerifiedFeedbackAPI, ProofType, OrderDetails, FeedbackOutcome

router = APIRouter(prefix="/api/verified-feedback", tags=["Verified Feedback"], dependencies=[Depends(require_user)])
MAX_PROOF = 5 * 1024 * 1024

@router.post("/submit")
async def submit_verified_feedback(
    url: str = Form(...), order_details: str = Form(...), outcome: str = Form(...),
    proof_files: list[UploadFile] = File(...), proof_metadata: str = Form(...),
    session: Session = Depends(get_session), user=Depends(require_user),
):
    from ..models.schemas import CheckSiteRequest
    try:
        url = str(CheckSiteRequest(url=url).url)
        order = OrderDetails.model_validate_json(order_details)
        result = FeedbackOutcome.model_validate_json(outcome)
        metadata = json.loads(proof_metadata)
        if not isinstance(metadata, list) or len(metadata) != len(proof_files) or not 3 <= len(proof_files) <= 5:
            raise ValueError("Provide three to five proofs with matching type metadata")
        types = {ProofType(m["proof_type"]) for m in metadata}
        required = {ProofType.ORDER_SCREENSHOT, ProofType.PAYMENT_RECEIPT,
                    ProofType.DELIVERY_NOTIFICATION if result.delivered else ProofType.EMAIL_CONFIRMATION}
        if not required <= types:
            raise ValueError("Missing required distinct proof types")
        proofs, hashes = [], set()
        for file, meta in zip(proof_files, metadata):
            content = await file.read(MAX_PROOF + 1)
            await file.close()
            if not content or len(content) > MAX_PROOF:
                raise ValueError("Each proof must contain 1 byte to 5 MB")
            try:
                with Image.open(io.BytesIO(content)) as image:
                    if image.width * image.height > 20_000_000 or image.format not in {"JPEG", "PNG"}:
                        raise ValueError("Use PNG or JPEG proofs up to 20 megapixels")
                    image.verify()
                    content_type = "image/png" if image.format == "PNG" else "image/jpeg"
            except (OSError, UnidentifiedImageError, Image.DecompressionBombError):
                raise ValueError("Use valid PNG or JPEG proof files") from None
            digest = hashlib.sha256(content).hexdigest()
            if digest in hashes or session.exec(select(FeedbackProof).where(FeedbackProof.file_hash == digest)).first():
                raise ValueError("Duplicate proof: each document may be submitted only once")
            hashes.add(digest)
            proofs.append({"type": ProofType(meta["proof_type"]).value, "hash": digest,
                           "size": len(content), "content_type": content_type, "content": content})
        stored_metadata = [{k: v for k, v in proof.items() if k != "content"} for proof in proofs]
        response = await VerifiedFeedbackAPI().submit_feedback(url, user["id"], order.model_dump(), stored_metadata, result.model_dump(), session)
        folder = Path(os.getenv("PROOF_STORAGE_DIR", "data/proofs"))
        folder.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(folder, 0o700)
        created = []
        try:
            for proof in proofs:
                path = folder / proof["hash"]
                fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                created.append(path)
                with os.fdopen(fd, "wb") as stream:
                    stream.write(proof["content"])
                session.add(FeedbackProof(feedback_id=response["feedback_id"], file_hash=proof["hash"], storage_path=str(path.resolve()), content_type=proof["content_type"]))
            session.commit()
        except Exception:
            session.rollback()
            for path in created:
                path.unlink(missing_ok=True)
            raise
        return {"success": True, **response}
    except HTTPException:
        session.rollback()
        raise
    except (ValueError, KeyError, TypeError, ValidationError) as exc:
        session.rollback()
        raise HTTPException(422, "Invalid evidence or order details") from None
    except (IntegrityError, FileExistsError):
        session.rollback()
        raise HTTPException(409, "Proof already submitted") from None

@router.get("/requirements")
def requirements():
    return {"required_types": ["order_screenshot", "payment_receipt", "delivery_notification OR email_confirmation for non-delivery"],
            "accepted_formats": ["PNG", "JPEG"], "max_bytes_per_file": MAX_PROOF,
            "verification": "Manual review required; hashes and metadata do not prove authenticity",
            "storage": "Local restricted files; deployment must supply encrypted storage and a retention policy"}

@router.get("/status")
def list_status(url: str, session: Session = Depends(get_session), user=Depends(require_user)):
    rows = session.exec(select(VerifiedFeedback).where(VerifiedFeedback.url == url, VerifiedFeedback.user_id == user["id"])).all()
    return [{"id": r.id, "url": r.url, "verification_status": r.status, "created_at": r.submission_time} for r in rows]

@router.get("/status/{feedback_id}")
def get_status(feedback_id: int, session: Session = Depends(get_session), user=Depends(require_user)):
    row = session.get(VerifiedFeedback, feedback_id)
    if not row or row.user_id != user["id"]:
        raise HTTPException(404, "Feedback not found")
    return {"feedback_id": row.id, "status": row.status, "review_notes": row.verification_notes}

@router.get("/admin/proofs/{proof_id}")
def get_proof(proof_id: int, admin=Depends(require_admin), session: Session = Depends(get_session)):
    proof = session.get(FeedbackProof, proof_id)
    if not proof or not Path(proof.storage_path).is_file():
        raise HTTPException(404, "Proof not found")
    return FileResponse(proof.storage_path, media_type=proof.content_type, filename=proof.file_hash)

@router.post("/admin/verify/{feedback_id}")
def admin_verify(feedback_id: int, verification_decision: Literal["approve", "reject", "request_more_info"] = Form(...),
                 reviewer_notes: str = Form(..., min_length=10, max_length=2000),
                 reviewer=Depends(require_admin), session: Session = Depends(get_session)):
    row = session.get(VerifiedFeedback, feedback_id)
    if not row:
        raise HTTPException(404, "Feedback not found")
    if verification_decision == "approve":
        proofs = session.exec(select(FeedbackProof).where(FeedbackProof.feedback_id == feedback_id)).all()
        if len(proofs) < 3 or not all(Path(p.storage_path).is_file() for p in proofs):
            raise HTTPException(409, "Reviewable proof files are missing")
        row.status = FeedbackStatus.VERIFIED_DELIVERED if row.delivered_successfully else FeedbackStatus.VERIFIED_SCAM
        row.weight = 1
    else:
        row.status = FeedbackStatus.REJECTED if verification_decision == "reject" else FeedbackStatus.PENDING_VERIFICATION
        row.weight = 0
    row.reviewer_id, row.verification_notes = reviewer, reviewer_notes
    session.add(row)
    session.commit()
    return {"feedback_id": row.id, "status": row.status}
