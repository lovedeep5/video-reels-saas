"""
Tests for Clerk JWT + API key auth.
Run: cd backend && python -m pytest tests/ -v
"""
import sys, os, time, base64
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import jwt as pyjwt

from database import Base, get_db
from main import app

# ── Shared RSA test key pair ──────────────────────────────────────────────────

_PRIVATE_KEY = rsa.generate_private_key(65537, 2048, default_backend())
_PRIVATE_PEM = _PRIVATE_KEY.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.TraditionalOpenSSL,
    serialization.NoEncryption(),
)
_PUBLIC_KEY = _PRIVATE_KEY.public_key()
_TEST_KID = "test-clerk-key-id"


def _make_token(
    clerk_id: str = "user_test123",
    azp: str = "http://localhost:3000",
    expired: bool = False,
    kid: str = _TEST_KID,
) -> str:
    now = int(time.time())
    exp = now - 10 if expired else now + 60
    payload = {
        "sub": clerk_id,
        "sid": "sess_test",
        "iss": "https://test.clerk.accounts.dev",
        "azp": azp,
        "iat": now,
        "nbf": now - 5,
        "exp": exp,
    }
    return pyjwt.encode(payload, _PRIVATE_PEM, algorithm="RS256", headers={"kid": kid})


def _mock_jwks(kid: str = _TEST_KID):
    """Return a mock PyJWKClient whose get_signing_key_from_jwt uses our test public key."""
    mock_signing_key = MagicMock()
    mock_signing_key.key = _PUBLIC_KEY
    mock_client = MagicMock()
    mock_client.get_signing_key_from_jwt.return_value = mock_signing_key
    return mock_client


def _mock_clerk_user(clerk_id: str, email: str = "test@example.com", name: str = "Test User"):
    data = {
        "id": clerk_id,
        "first_name": name.split()[0],
        "last_name": name.split()[1] if " " in name else "",
        "primary_email_address_id": "ea_1",
        "email_addresses": [{"id": "ea_1", "email_address": email}],
    }
    return patch("auth._fetch_clerk_user_info", return_value=data)


# ── Test client factory ────────────────────────────────────────────────────────

def make_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


@pytest.fixture
def client():
    c = make_client()
    yield c
    app.dependency_overrides.clear()


# helper: patch the module-level _jwks_client so get_signing_key_from_jwt uses our key
def _patch_jwks():
    return patch("auth._jwks_client", _mock_jwks())


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_me_no_token_returns_401(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_garbage_token_returns_401(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer notavalidjwt"})
    assert r.status_code == 401


def test_me_expired_token_returns_401(client):
    token = _make_token(expired=True)
    with _patch_jwks(), _mock_clerk_user("user_exp"):
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_me_wrong_azp_returns_401(client):
    token = _make_token(azp="https://evil.com")
    with _patch_jwks(), _mock_clerk_user("user_evil"):
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_me_valid_clerk_token(client):
    token = _make_token("user_alice", azp="http://localhost:3000")
    with _patch_jwks(), _mock_clerk_user("user_alice", "alice@example.com", "Alice Smith"):
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "alice@example.com"
    assert data["name"] == "Alice Smith"
    assert data["plan"] == "free"


def test_me_creates_user_on_first_login(client):
    token = _make_token("user_new")
    with _patch_jwks(), _mock_clerk_user("user_new", "new@example.com", "New User"):
        r1 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r1.status_code == 200

    # Second call reuses the same DB record
    with _patch_jwks(), _mock_clerk_user("user_new", "new@example.com", "New User"):
        r2 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.json()["id"] == r1.json()["id"]


def test_me_links_existing_email_account(client):
    """If a user already exists with the same email (old auth), their clerk_id gets linked."""
    from database import User
    from database import SessionLocal

    # Pre-create a user without a clerk_id (simulates old email/password account)
    token = _make_token("user_linked")
    with _patch_jwks(), _mock_clerk_user("user_linked", "old@example.com", "Old User"):
        # First call: Clerk user doesn't exist yet → Clerk API returns "old@example.com"
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    user_id = r.json()["id"]

    # Second call with same clerk_id reuses same record
    with _patch_jwks(), _mock_clerk_user("user_linked", "old@example.com", "Old User"):
        r2 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.json()["id"] == user_id


def test_get_plans_public(client):
    """Plans endpoint requires no auth."""
    r = client.get("/api/billing/plans")
    assert r.status_code == 200
    keys = [p["key"] for p in r.json()]
    assert "free" in keys and "pro" in keys and "business" in keys


def test_jobs_requires_auth(client):
    r = client.get("/api/jobs")
    assert r.status_code == 401


def test_jobs_empty_with_auth(client):
    token = _make_token("user_jobs")
    with _patch_jwks(), _mock_clerk_user("user_jobs", "jobs@example.com", "Jobs User"):
        r = client.get("/api/jobs", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json() == []


def test_billing_status_requires_auth(client):
    r = client.get("/api/billing/status")
    assert r.status_code == 401


def test_billing_status_with_auth(client):
    token = _make_token("user_bs")
    with _patch_jwks(), _mock_clerk_user("user_bs", "bs@example.com", "BS User"):
        r = client.get("/api/billing/status", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["plan"] == "free"


def test_api_key_flow(client):
    """Create an API key via Clerk auth, then use it without Clerk token."""
    clerk_token = _make_token("user_apikey")
    with _patch_jwks(), _mock_clerk_user("user_apikey", "apikey@example.com", "API User"):
        r = client.post(
            "/api/keys",
            json={"name": "My Key", "expiry": "never"},
            headers={"Authorization": f"Bearer {clerk_token}"},
        )
    assert r.status_code == 200
    full_key = r.json()["full_key"]
    assert full_key.startswith("vr_live_")

    # Use the API key directly — no Clerk JWT needed
    r2 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {full_key}"})
    assert r2.status_code == 200
    assert r2.json()["email"] == "apikey@example.com"

    r3 = client.get("/api/jobs", headers={"Authorization": f"Bearer {full_key}"})
    assert r3.status_code == 200
