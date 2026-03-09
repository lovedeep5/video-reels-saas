"""
Abstract payment provider interface.
Implement this for any payment gateway (Razorpay, PayU, Cashfree, etc.)
"""
from abc import ABC, abstractmethod
from typing import Any


class PaymentProvider(ABC):

    @abstractmethod
    def create_customer(self, user_id: int, email: str, name: str) -> dict:
        """Create a customer record with the payment provider. Returns provider customer dict."""

    @abstractmethod
    def create_subscription(self, customer_id: str, plan_id: str) -> dict:
        """Create a subscription. Returns provider subscription dict."""

    @abstractmethod
    def cancel_subscription(self, subscription_id: str) -> bool:
        """Cancel an active subscription."""

    @abstractmethod
    def verify_webhook(self, payload: bytes, signature: str) -> bool:
        """Verify webhook HMAC signature. Raises ValueError if invalid."""

    @abstractmethod
    def get_subscription(self, subscription_id: str) -> dict:
        """Fetch subscription details from provider."""
