"""
Billing router — Razorpay Orders integration.

Endpoints:
  GET  /api/billing/plans            → list available plans
  GET  /api/billing/status           → current user subscription
  POST /api/billing/subscribe        → create Razorpay order → return {order_id, key_id, amount}
  POST /api/billing/verify-payment   → verify Razorpay signature → activate plan
  POST /api/billing/cancel           → downgrade to free
  POST /api/billing/webhook          → Razorpay webhook (async events)
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from config import PLANS, settings
from database import PaymentEvent, User, get_db

router = APIRouter(prefix="/api/billing", tags=["billing"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PlanOut(BaseModel):
    key: str
    name: str
    price: int
    currency: str
    clips_per_video: int
    videos_per_month: int
    max_duration_seconds: int
    features: list[str]
    razorpay_plan_id: Optional[str]


class SubscriptionStatus(BaseModel):
    plan: str
    payment_customer_id: Optional[str]
    payment_subscription_id: Optional[str]
    subscription_expires_at: Optional[str]
    payment_provider: Optional[str]


class SubscribeRequest(BaseModel):
    plan_key: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_key: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/plans", response_model=list[PlanOut])
def get_plans():
    return [PlanOut(key=k, **{f: v for f, v in v.items() if f != "key"}) for k, v in PLANS.items()]


@router.get("/status", response_model=SubscriptionStatus)
def subscription_status(current_user: User = Depends(get_current_user)):
    return SubscriptionStatus(
        plan=current_user.plan,
        payment_customer_id=current_user.payment_customer_id,
        payment_subscription_id=current_user.payment_subscription_id,
        subscription_expires_at=(
            current_user.subscription_expires_at.isoformat()
            if current_user.subscription_expires_at
            else None
        ),
        payment_provider=current_user.payment_provider,
    )


@router.post("/subscribe")
def subscribe(
    data: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a Razorpay order for the requested plan.
    Returns order details for the frontend Razorpay checkout.
    """
    if data.plan_key not in PLANS:
        raise HTTPException(status_code=400, detail="Unknown plan")
    if data.plan_key == "free":
        raise HTTPException(status_code=400, detail="Cannot subscribe to free plan")

    plan = PLANS[data.plan_key]
    if plan["price"] == 0:
        raise HTTPException(status_code=400, detail="Plan has no price")

    from payment.razorpay import RazorpayProvider
    try:
        provider = RazorpayProvider()
        order = provider.create_order(
            amount_inr=plan["price"],
            plan_key=data.plan_key,
            user_id=current_user.id,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Payment gateway error: {e}")

    return {
        "order_id": order["id"],
        "key_id": settings.RAZORPAY_KEY_ID,
        "amount": order["amount"],        # paise
        "currency": order["currency"],
        "plan_key": data.plan_key,
        "plan_name": plan["name"],
        "prefill": {
            "name": current_user.name,
            "email": current_user.email,
        },
    }


@router.post("/verify-payment")
def verify_payment(
    data: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verify Razorpay payment signature and activate the plan.
    """
    if data.plan_key not in PLANS:
        raise HTTPException(status_code=400, detail="Unknown plan")

    from payment.razorpay import RazorpayProvider
    try:
        provider = RazorpayProvider()
        provider.verify_payment_signature(
            order_id=data.razorpay_order_id,
            payment_id=data.razorpay_payment_id,
            signature=data.razorpay_signature,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Payment verification failed — invalid signature")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Payment gateway error: {e}")

    # Activate the plan
    current_user.plan = data.plan_key
    current_user.payment_subscription_id = data.razorpay_payment_id
    current_user.payment_provider = "razorpay"
    current_user.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=30)

    # Log the payment event
    event = PaymentEvent(
        user_id=current_user.id,
        provider="razorpay",
        event_type="payment.captured",
        payload=json.dumps({
            "order_id": data.razorpay_order_id,
            "payment_id": data.razorpay_payment_id,
            "plan_key": data.plan_key,
        }),
        processed=True,
    )
    db.add(event)
    db.commit()

    return {"status": "active", "plan": data.plan_key}


@router.post("/cancel")
def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Downgrade the user back to free plan."""
    current_user.plan = "free"
    current_user.payment_subscription_id = None
    current_user.subscription_expires_at = None
    db.commit()
    return {"status": "cancelled", "plan": "free"}


@router.post("/webhook")
async def payment_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Razorpay webhook — handles async payment events.
    Set the webhook URL in Razorpay dashboard: https://your-domain/api/billing/webhook
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if settings.RAZORPAY_WEBHOOK_SECRET:
        from payment.razorpay import RazorpayProvider
        try:
            RazorpayProvider().verify_webhook(body, signature)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(body)
        event_type = payload.get("event", "unknown")
    except Exception:
        payload = {}
        event_type = "parse_error"

    event = PaymentEvent(
        provider="razorpay",
        event_type=event_type,
        payload=body.decode(),
        processed=False,
    )
    db.add(event)
    db.commit()

    # Handle known events
    if event_type == "payment.captured":
        _handle_payment_captured(payload, db)
        event.processed = True
        db.commit()

    return {"status": "received"}


def _handle_payment_captured(payload: dict, db):
    """Activate plan when payment.captured webhook fires."""
    try:
        notes = payload.get("payload", {}).get("payment", {}).get("entity", {}).get("notes", {})
        plan_key = notes.get("plan_key") or notes.get("plan")
        user_id = notes.get("user_id")
        if not plan_key or not user_id or plan_key not in PLANS:
            return
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user:
            user.plan = plan_key
            user.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
            db.commit()
    except Exception as e:
        print(f"[webhook] _handle_payment_captured error: {e}")
