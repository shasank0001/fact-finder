"""Configured analyst login, signed sessions, and separate service/admin credentials."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

router = APIRouter(prefix="/auth", tags=["authentication"])
COOKIE = "factfinder_session"
_attempts = defaultdict(deque)


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600_000).hex()
    return f"{salt}:{digest}"


def _secret():
    value = os.getenv("SESSION_SECRET", "")
    if len(value) < 32:
        raise HTTPException(503, "Authentication is not configured")
    return value.encode()


def _origin_check(request: Request):
    origin = request.headers.get("origin")
    allowed = os.getenv("CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080").split(",")
    if origin and origin not in allowed:
        raise HTTPException(403, "Origin not allowed")


def require_user(request: Request):
    token = os.getenv("API_ACCESS_TOKEN", "")
    authorization = request.headers.get("authorization", "")
    if len(token) >= 32 and hmac.compare_digest(authorization, f"Bearer {token}"):
        return {"id": "service", "email": "service", "name": "Service"}
    _origin_check(request)
    cookie = request.cookies.get(COOKIE, "")
    try:
        payload, signature = cookie.rsplit(".", 1)
        expected = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError()
        user = json.loads(base64.urlsafe_b64decode(payload))
        if user["expires"] < time.time() or user["email"] != os.getenv("AUTH_EMAIL"):
            raise ValueError()
        return {"id": user["email"], "email": user["email"], "name": "Analyst"}
    except (ValueError, KeyError, TypeError):
        raise HTTPException(401, "Sign in to continue") from None


def require_admin(request: Request):
    key = os.getenv("ADMIN_API_KEY", "")
    if len(key) < 32 or not hmac.compare_digest(request.headers.get("x-admin-key", ""), key):
        raise HTTPException(403, "Administrator credential required")
    return "configured-admin"


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=1024)


@router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response):
    _origin_check(request)
    secret = _secret()
    email = os.getenv("AUTH_EMAIL", "")
    stored = os.getenv("AUTH_PASSWORD_HASH", "")
    if not email or ":" not in stored:
        raise HTTPException(503, "Analyst credentials are not configured")
    # Bounded per-process limiter; production deployments should add an edge limiter.
    if len(_attempts) > 10000:
        _attempts.clear()
    attempts = _attempts[request.client.host if request.client else "unknown"]
    now = time.time()
    while attempts and attempts[0] < now - 60:
        attempts.popleft()
    if len(attempts) >= 5:
        raise HTTPException(429, "Too many login attempts; try again in a minute")
    attempts.append(now)
    valid = hmac.compare_digest(hash_password(payload.password, stored.split(":", 1)[0]), stored)
    if not valid or not hmac.compare_digest(payload.email.encode(), email.encode()):
        raise HTTPException(401, "Invalid credentials")
    body = base64.urlsafe_b64encode(json.dumps({"email": email, "expires": now + 3600}).encode()).decode()
    signature = hmac.new(secret, body.encode(), hashlib.sha256).hexdigest()
    response.set_cookie(COOKIE, f"{body}.{signature}", httponly=True, samesite="strict", max_age=3600,
                        secure=os.getenv("COOKIE_SECURE", "true").lower() == "true")
    return {"id": email, "email": email, "name": "Analyst"}


@router.get("/me")
def me(user=Depends(require_user)):
    return user


@router.post("/logout")
def logout(request: Request, response: Response):
    _origin_check(request)
    response.delete_cookie(COOKIE)
    return {"status": "ok"}
