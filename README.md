# FactFinder

FactFinder offers evidence-assisted news checks, heuristic website and job risk checks, and an optional AI image-origin classifier. AI-text and social-post detectors are explicitly unavailable until evaluated implementations exist. Results are assistance, not a guarantee of factual accuracy or merchant safety.

## Local setup

Use Python 3.13 and Node.js 20 or later. Python 3.10+ is supported by the source, but the tested dependency snapshot is Python 3.13.

```bash
git clone https://github.com/shasank0001/fact-finder.git
cd fact-finder
python -m venv .venv
source .venv/bin/activate
pip install -c constraints.txt -e .
cp .env.example .env
```

Configure `.env` before signing in:

- `AUTH_EMAIL`: the analyst's login email. This release supports one configured analyst, not public registration.
- `AUTH_PASSWORD_HASH`: generate it with `python -c 'import getpass; from factfinder.security import hash_password; print(hash_password(getpass.getpass()))'`.
- `SESSION_SECRET`: generate using `python -c 'import secrets; print(secrets.token_urlsafe(48))'`.
- `COOKIE_SECURE=false` only for local HTTP development; use `true` with HTTPS in production.
- Optional `GEMINI_API_KEY` and `SAFE_BROWSING_API_KEY` enable external evidence providers. Missing providers are reported as unavailable.
- Optional separate random `API_ACCESS_TOKEN` (bots) and `ADMIN_API_KEY` (manual review), each at least 32 characters. Never put either in frontend source or browser environment variables.

Previously committed credentials must be revoked in their provider consoles. Deleting them from the current tree does not revoke them or erase Git history.

Start the API from the repository root:

```bash
uvicorn api:app --host 127.0.0.1 --port 8000
```

Start the frontend in a second terminal:

```bash
cd fact-sniff-detect-main
npm ci
npm run dev
```

Open http://localhost:8080. Vite proxies API requests to port 8000. Production hosting should reverse-proxy the same paths to the API, or explicitly set `VITE_API_BASE_URL` at build time and configure allowed origins. Secure sessions use HttpOnly cookies; passwords are never persisted in browser storage.

## What is checked

| Category | Implementation | Limits |
|---|---|---|
| News | Gemini with Google Search; validates claim JSON and provider grounding references | Unsupported claims abstain. Evidence relevance and factual accuracy still require evaluation. |
| Websites | Domain/content/HTTPS heuristics, optional Safe Browsing, reviewed feedback | Confirmed threat matches override the aggregate. Business, seller and visual identity checks remain unknown without independent evidence. |
| Jobs | Contact and description heuristics, explicit payment-request warnings | Employer/recruiter identity and salary are not independently verified. Risk scores are not calibrated probabilities. |
| Images | Optional local pretrained AI/human-origin classifier | Does not establish factual truth, editing history or ownership. |
| AI text/social posts | Unavailable | No random verdicts are produced. |

The basic and advanced website endpoints now share one maintained pipeline. Historical scripts under `ecommerce_detection` are not a second supported scoring service. Use the canonical entry point above. No accuracy, throughput or latency claims have been established by a benchmark.

## Optional image model

The API starts without image dependencies or weights. Image requests return 503 when the model is unavailable.

```bash
pip install -r requirements-image.txt
# Set IMAGE_MODEL_REVISION to a reviewed full commit from Ateeqq/ai-vs-human-image-detector.
python detect-fake-imagee/download_model2.py
```

The downloader and API both use `IMAGE_MODEL_PATH` (default `models_cache/ai-image-detector`). Runtime loading uses local files only. Supported model labels are exactly `ai` and `hum`/`human`. Uploads are limited to 10 MB and 20 megapixels, in JPEG, PNG or WebP format.

## API

Interactive documentation: http://localhost:8000/docs. All analysis, history and feedback routes require a signed login cookie or `Authorization: Bearer <API_ACCESS_TOKEN>`. `/` is a public health endpoint.

| Method | Path | Body |
|---|---|---|
| POST | `/auth/login` | `{ "email": "...", "password": "..." }` |
| GET | `/auth/me` | — |
| POST | `/auth/logout` | — |
| POST | `/news/verify` | `{ "query": "claim, article text or public article URL" }` |
| POST | `/job/analyze` | `{ "name": "Employer", "job_description": "..." }` plus optional contact details |
| POST | `/ecommerce/analyze-advanced` or `/analyze` | `{ "url": "https://example.com" }` |
| POST | `/image/analyze` | multipart `file` |
| POST | `/ecommerce/feedback` or `/api/feedback` | `{ "url": "https://example.com", "delivered": true }` |
| GET | `/api/site-history?url=...` | Exact normalized URL used by the scan |

Website responses include a risk score from 0 to 100, `Low Risk`/`Caution`/`High Risk`/`Critical`, advice, and reasons with explicit checked/unknown/error/threat status. Scores with missing verification receive at least Caution. A lack of listed threats is not proof of legitimacy.

Unverified feedback is saved but does not influence scoring. `/api/verified-feedback/submit` accepts order/outcome JSON and three distinct PNG/JPEG proofs (order, payment, and delivery or non-delivery communication). Each proof is limited to 5 MB; duplicates are rejected. New submissions remain pending with zero authenticity confidence. Document hashes and metadata never auto-approve feedback.

Manual approval requires both normal API access and the separate `X-Admin-Key` credential. `/api/verified-feedback/admin/proofs/{proof_id}` serves evidence to authorized reviewers. Configure encrypted storage, backups, deletion/retention policy and operational review before accepting real personal documents. Local proof files have restricted permissions; encryption at rest is not implemented by this application. The server derives the reviewer identity and records notes.

## WhatsApp

Both bot implementations need `API_ACCESS_TOKEN` matching the server. The root `whatsapp-bot` integrates news, images and website checks; it does not have a job-offer flow. Set `BACKEND_BASE_URL` and use comma-separated `ALLOWED_NUMBERS` exactly as required by the bot. See its README for WPPConnect setup. No bot was connected to a real account during verification.

## Validation

```bash
pytest -q
cd fact-sniff-detect-main
npm run build
npm run typecheck
npm run lint
```

Regression tests use isolated databases and mocked vendor/network evidence. They cover unsafe scoring, SSRF/DNS pinning, authentication, persistence, proof review, job-payment warnings and news abstention. They do not measure detector accuracy or production load. Outbound fetching pins validated public IPs, validates redirects, limits response size and disables environment proxies. Production deployments should also apply network egress restrictions, global rate limits, HTTPS and request limits at the reverse proxy.
