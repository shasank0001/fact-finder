"""Explicit optional model download; run from the repository root."""
import os
import re
from dotenv import load_dotenv
load_dotenv()
from huggingface_hub import snapshot_download

if __name__ == "__main__":
    revision = os.getenv("IMAGE_MODEL_REVISION")
    if not revision or not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise SystemExit("Set IMAGE_MODEL_REVISION to the full 40-character model commit you have reviewed")
    snapshot_download(repo_id="Ateeqq/ai-vs-human-image-detector", revision=revision,
                      local_dir=os.getenv("IMAGE_MODEL_PATH", "models_cache/ai-image-detector"))
