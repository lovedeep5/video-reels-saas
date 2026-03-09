"""
Razorpay payment provider — Orders-based flow.

Flow:
  1. POST /api/billing/subscribe       → create_order()  → return {order_id, key_id, amount}
  2. Frontend opens Razorpay checkout with order_id
  3. User pays → Razorpay returns {payment_id, order_id, signature}
  4. POST /api/billing/verify-payment  → verify_payment_signature() → upgrade user plan
  5. Webhook (optional) handles async events
"""
import hashlib
import hmac

from payment.base import PaymentProvider


class RazorpayProvider(PaymentProvider):

    def __init__(self):
        from config import settings
        try:
            import razorpay
            self.client = razorpay.Client(
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
            )
            self.key_id = settings.RAZORPAY_KEY_ID
            self.webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
        except ImportError:
            raise RuntimeError("Install razorpay package: python -m pip install razorpay")

    # ── Order creation ─────────────────────────────────────────────────────────

    def create_order(self, amount_inr: int, plan_key: str, user_id: int) -> dict:
        """
        Create a Razorpay order for a one-time plan payment.
        amount_inr is in rupees; Razorpay expects paise (×100).
        Returns the full order dict from Razorpay.
        """
        return self.client.order.create({
            "amount": amount_inr * 100,   # paise
            "currency": "INR",
            "receipt": f"plan_{plan_key}_user_{user_id}",
            "notes": {
                "plan_key": plan_key,
                "user_id": str(user_id),
            },
        })

    def verify_payment_signature(
        self, order_id: str, payment_id: str, signature: str
    ) -> bool:
        """
        Verify the payment signature returned by Razorpay checkout.
        Raises ValueError if invalid.
        """
        from config import settings
        message = f"{order_id}|{payment_id}"
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(),
            message.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise ValueError("Payment signature verification failed")
        return True

    # ── PaymentProvider ABC stubs (unused in order flow) ──────────────────────

    def create_customer(self, user_id: int, email: str, name: str) -> dict:
        return self.client.customer.create({
            "name": name,
            "email": email,
            "notes": {"user_id": str(user_id)},
        })

    def create_subscription(self, customer_id: str, plan_id: str) -> dict:
        return self.client.subscription.create({
            "plan_id": plan_id,
            "customer_notify": 1,
            "total_count": 12,
        })

    def cancel_subscription(self, subscription_id: str) -> bool:
        result = self.client.subscription.cancel(subscription_id)
        return result.get("status") == "cancelled"

    def verify_webhook(self, payload: bytes, signature: str) -> bool:
        if not self.webhook_secret:
            return True   # skip verification if secret not configured
        expected = hmac.new(
            self.webhook_secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise ValueError("Invalid webhook signature")
        return True

    def get_subscription(self, subscription_id: str) -> dict:
        return self.client.subscription.fetch(subscription_id)
