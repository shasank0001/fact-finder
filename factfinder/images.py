"""Optional image classifier: load local weights on demand, never at API startup."""
import io
import os
import threading
from pathlib import Path
from PIL import Image, ExifTags, UnidentifiedImageError
from fastapi import HTTPException

MODEL_DIR = Path(os.getenv("IMAGE_MODEL_PATH", "models_cache/ai-image-detector"))
_lock = threading.Lock()
_model = _processor = None
MAX_UPLOAD = 10 * 1024 * 1024


def analyze_bytes(contents: bytes):
    global _model, _processor
    try:
        with Image.open(io.BytesIO(contents)) as original:
            if original.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(415, "Use JPEG, PNG, or WebP")
            if original.width * original.height > 20_000_000:
                raise HTTPException(413, "Image exceeds 20 megapixels")
            metadata = {str(ExifTags.TAGS.get(k, k)): str(v) for k, v in original.getexif().items()}
            image = original.convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(415, "Invalid or oversized image") from None
    with _lock:
        if _model is None:
            if not (MODEL_DIR / "config.json").exists():
                raise HTTPException(503, "Image model is not installed; follow the model setup instructions")
            try:
                from transformers import AutoModelForImageClassification, AutoImageProcessor
                _processor = AutoImageProcessor.from_pretrained(MODEL_DIR, local_files_only=True)
                _model = AutoModelForImageClassification.from_pretrained(MODEL_DIR, local_files_only=True)
                _model.eval()
            except Exception:
                raise HTTPException(503, "Image model dependencies or weights are unavailable") from None
        import torch
        inputs = _processor(images=image, return_tensors="pt")
        with torch.inference_mode():
            probabilities = torch.softmax(_model(**inputs).logits, dim=-1)[0]
        raw = {str(_model.config.id2label[i]).lower(): float(p) for i, p in enumerate(probabilities)}
        if set(raw) not in ({"ai", "hum"}, {"ai", "human"}):
            raise HTTPException(503, "Unsupported model label mapping")
        return {"prediction": {"ai": raw["ai"], "human": raw.get("hum", raw.get("human"))},
                "labels": raw, "metadata": metadata or None, "interpretation": "AI origin estimate; not factual authenticity"}
