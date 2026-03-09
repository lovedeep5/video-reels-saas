"""
Authentication module.

Two auth paths, checked in order:
  1. Authorization: Bearer vr_live_xxx  →  API key (for direct API users)
  2. Authorization: Bearer <Clerk JWT>  →  Clerk session token (for frontend users)

Clerk JWT validation follows the official manual JWT verification guide:
  https://clerk.com/docs/guides/sessions/manual-jwt-verification
"""

import hashlib
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

import jwt as pyjwt
from jwt import PyJWKClient, ExpiredSignatureError, InvalidTokenError
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from config import settings
from database import ApiKey, User, get_db

logger = logging.getLogger(__name__)

# Kept for OpenAPI /docs "Authorize" button
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

API_KEY_PREFIX = "vr_live_"

# ── JWKS client (PyJWKClient handles caching + kid lookup automatically) ──────

_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not settings.CLERK_JWKS_URL:
            raise HTTPException(status_code=500, detail="CLERK_JWKS_URL not configured")
        _jwks_client = PyJWKClient(settings.CLERK_JWKS_URL, cache_keys=True)
    return _jwks_client


# ── Clerk JWT validation ───────────────────────────────────────────────────────

def _get_authorized_parties() -> set[str]:
    """Parse the comma-separated CLERK_AUTHORIZED_PARTIES env var into a set."""
    raw = settings.CLERK_AUTHORIZED_PARTIES or ""
    return {p.strip() for p in raw.split(",") if p.strip()}


def _verify_clerk_token(token: str) -> dict:
    """
    Verify a Clerk RS256 session token and return its payload.

    Validation steps (per Clerk docs):
      1. Fetch the matching public key from JWKS using the token's `kid`.
      2. Verify the RS256 signature.
      3. Verify `exp` and `nbf` with a 5-second leeway for clock skew.
      4. Verify the `azp` (authorized party) claim against allowed origins.
    """
    client = _get_jwks_client()

    try:
        signing_key = client.get_signing_key_from_jwt(token)
    except Exception as e:
        logger.warning("JWKS key lookup failed: %s", e)
        raise InvalidTokenError(f"JWKS key lookup failed: {e}") from e

    payload = pyjwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        leeway=5,                        # 5s tolerance for clock skew (Clerk recommendation)
        options={
            "verify_exp": True,
            "verify_nbf": True,
            "verify_aud": False,         # Clerk session tokens have no audience claim
        },
    )

    # Validate azp (authorized party) — prevents CSRF from other origins.
    # If azp is absent, skip the check (some older Clerk tokens omit it).
    azp: Optional[str] = payload.get("azp")
    if azp:
        allowed = _get_authorized_parties()
        if allowed and azp not in allowed:
            logger.warning("Rejected token with azp=%r, allowed=%r", azp, allowed)
            raise InvalidTokenError(f"Unauthorized party: {azp!r}")

    return payload


# ── Clerk user sync ───────────────────────────────────────────────────────────

def _fetch_clerk_user_info(clerk_id: str) -> dict:
    """Call Clerk Backend API to get email + name for a new user."""
    import requests
    resp = requests.get(
        f"https://api.clerk.com/v1/users/{clerk_id}",
        headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def get_or_create_clerk_user(clerk_id: str, db: Session) -> User:
    """Return existing user by clerk_id, or create one by fetching info from Clerk."""
    user = db.query(User).filter(User.clerk_id == clerk_id).first()
    if user:
        return user

    clerk_data = _fetch_clerk_user_info(clerk_id)

    primary_id = clerk_data.get("primary_email_address_id")
    email = ""
    for ea in clerk_data.get("email_addresses", []):
        if ea["id"] == primary_id:
            email = ea["email_address"]
            break

    first = clerk_data.get("first_name") or ""
    last = clerk_data.get("last_name") or ""
    name = f"{first} {last}".strip() or email.split("@")[0]

    # Link to an existing account with the same email (migration from old auth).
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        existing.clerk_id = clerk_id
        db.commit()
        return existing

    user = User(
        clerk_id=clerk_id,
        email=email,
        name=name,
        password_hash="",
        plan="free",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── API key helpers ───────────────────────────────────────────────────────────

def generate_api_key() -> tuple[str, str, str]:
    raw = secrets.token_hex(32)
    full_key = f"{API_KEY_PREFIX}{raw}"
    prefix = full_key[:16]
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    return full_key, prefix, key_hash


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


# ── Unified dependency ────────────────────────────────────────────────────────
#
# Priority:
#   1. Bearer vr_live_xxx  →  API key  (direct API users)
#   2. Bearer <JWT>        →  Clerk session token  (frontend users)

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise credentials_exc
    token = auth_header[7:]

    # ── Path 1: API key ───────────────────────────────────────────────────────
    if token.startswith(API_KEY_PREFIX):
        key_hash = hash_api_key(token)
        api_key = (
            db.query(ApiKey)
            .filter(ApiKey.key_hash == key_hash, ApiKey.is_active == True)
            .first()
        )
        if not api_key:
            raise credentials_exc
        if api_key.expires_at and api_key.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key has expired. Please create a new one.",
            )
        try:
            api_key.last_used_at = datetime.now(timezone.utc)
            db.commit()
        except Exception:
            db.rollback()
        user = db.query(User).filter(User.id == api_key.user_id).first()
        if not user or not user.is_active:
            raise credentials_exc
        return user

    # ── Path 2: Clerk JWT ─────────────────────────────────────────────────────
    if not settings.CLERK_JWKS_URL:
        raise HTTPException(status_code=500, detail="CLERK_JWKS_URL not configured")

    try:
        payload = _verify_clerk_token(token)
    except ExpiredSignatureError:
        logger.warning("Clerk token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token expired — please refresh the page",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except InvalidTokenError as e:
        logger.warning("Clerk token invalid: %s", e)
        raise credentials_exc
    except Exception as e:
        logger.warning("Clerk token verification error: %s: %s", type(e).__name__, e)
        raise credentials_exc

    clerk_id: Optional[str] = payload.get("sub")
    if not clerk_id:
        logger.warning("Clerk JWT missing 'sub' claim")
        raise credentials_exc

    try:
        user = get_or_create_clerk_user(clerk_id, db)
    except Exception as e:
        logger.warning("get_or_create_clerk_user failed for %s: %s: %s", clerk_id, type(e).__name__, e)
        raise credentials_exc

    if not user.is_active:
        raise credentials_exc
    return user
