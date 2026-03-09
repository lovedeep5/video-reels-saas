from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import User, get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    plan: str


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """
    Verify the Clerk session token and return the local user profile.
    Creates the user in our DB on first call (syncs from Clerk).
    """
    return UserOut(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        plan=current_user.plan,
    )
