from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import generate_api_key, get_current_user
from database import ApiKey, User, get_db

router = APIRouter(prefix="/api/keys", tags=["api-keys"])


class ExpiryOption(str, Enum):
    week = "week"
    month = "month"
    three_months = "3months"
    year = "year"
    custom = "custom"
    never = "never"


def _compute_expires_at(expiry: ExpiryOption, custom_expires_at: Optional[str]) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    if expiry == ExpiryOption.week:
        return now + timedelta(days=7)
    if expiry == ExpiryOption.month:
        return now + timedelta(days=30)
    if expiry == ExpiryOption.three_months:
        return now + timedelta(days=90)
    if expiry == ExpiryOption.year:
        return now + timedelta(days=365)
    if expiry == ExpiryOption.custom:
        if not custom_expires_at:
            raise HTTPException(status_code=400, detail="custom_expires_at is required for custom expiry")
        try:
            dt = datetime.fromisoformat(custom_expires_at.replace("Z", "+00:00"))
            if dt <= now:
                raise HTTPException(status_code=400, detail="Custom expiry date must be in the future")
            return dt
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format for custom_expires_at")
    return None  # never


class KeyOut(BaseModel):
    id: int
    name: str
    key_prefix: str
    is_active: bool
    created_at: str
    last_used_at: Optional[str]
    expires_at: Optional[str]
    is_expired: bool


class KeyCreated(BaseModel):
    id: int
    name: str
    key_prefix: str
    full_key: str          # shown ONCE — client must save it
    created_at: str
    expires_at: Optional[str]


class CreateKeyRequest(BaseModel):
    name: str
    expiry: ExpiryOption = ExpiryOption.never
    custom_expires_at: Optional[str] = None  # ISO date string, only for expiry="custom"


def _key_to_out(k: ApiKey) -> KeyOut:
    now = datetime.now(timezone.utc)
    expires_at_aware = k.expires_at.replace(tzinfo=timezone.utc) if k.expires_at else None
    return KeyOut(
        id=k.id,
        name=k.name,
        key_prefix=k.key_prefix,
        is_active=k.is_active,
        created_at=k.created_at.isoformat(),
        last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
        expires_at=k.expires_at.isoformat() if k.expires_at else None,
        is_expired=bool(expires_at_aware and expires_at_aware < now),
    )


@router.get("", response_model=list[KeyOut])
def list_keys(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).order_by(ApiKey.created_at.desc()).all()
    return [_key_to_out(k) for k in keys]


@router.post("", response_model=KeyCreated)
def create_key(
    data: CreateKeyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Key name cannot be empty")

    active_count = db.query(ApiKey).filter(ApiKey.user_id == current_user.id, ApiKey.is_active == True).count()
    if active_count >= 10:
        raise HTTPException(status_code=400, detail="Maximum 10 active API keys per account")

    expires_at = _compute_expires_at(data.expiry, data.custom_expires_at)
    full_key, prefix, key_hash = generate_api_key()

    api_key = ApiKey(
        user_id=current_user.id,
        name=data.name.strip(),
        key_prefix=prefix,
        key_hash=key_hash,
        is_active=True,
        expires_at=expires_at,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    return KeyCreated(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        full_key=full_key,
        created_at=api_key.created_at.isoformat(),
        expires_at=api_key.expires_at.isoformat() if api_key.expires_at else None,
    )


@router.delete("/{key_id}")
def revoke_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == current_user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
    db.commit()
    return {"message": "API key revoked"}
