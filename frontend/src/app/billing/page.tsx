"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { billingApi, Plan } from "@/lib/api";
import { getPlanMeta } from "@/lib/auth";
import Navbar from "@/components/Navbar";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function BillingPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState<string | null>(null); // plan_key being processed
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (window as any).__clerkGetToken = getToken;
    const meta = getPlanMeta();
    if (meta) setCurrentPlan(meta.plan);
    billingApi.plans().then((r) => setPlans(r.data));
    billingApi.status().then((r) => setCurrentPlan(r.data.plan));
  }, [isLoaded, isSignedIn, getToken]);

  async function handleUpgrade(plan: Plan) {
    setError(""); setSuccess("");
    setLoading(plan.key);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Failed to load payment gateway. Check your connection.");

      const { data: order } = await billingApi.subscribe(plan.key);

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: "VidToReels",
          description: `${order.plan_name} Plan — Monthly`,
          order_id: order.order_id,
          prefill: order.prefill,
          theme: { color: "#4f46e5" },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await billingApi.verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_key: order.plan_key,
              });
              setCurrentPlan(order.plan_key);
              setSuccess(`You're now on the ${order.plan_name} plan!`);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        });
        rzp.open();
      });
    } catch (err: unknown) {
      const msg = (err as { message?: string; response?: { data?: { detail?: string } } });
      const detail = msg?.response?.data?.detail || msg?.message || "Payment failed";
      if (detail !== "Payment cancelled") setError(detail);
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    if (!confirm("Downgrade to free plan? Your current plan stays active until the end of the billing period.")) return;
    setError(""); setSuccess("");
    try {
      await billingApi.cancel();
      setCurrentPlan("free");
      setSuccess("Downgraded to free plan.");
    } catch {
      setError("Failed to cancel. Please try again.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Billing & Plans</h1>
          <p className="text-gray-400 text-sm mt-1">
            You are currently on the{" "}
            <span className="text-indigo-300 font-medium capitalize">{currentPlan}</span> plan.
          </p>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-700 text-red-300 text-sm px-5 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-950 border border-green-700 text-green-300 text-sm px-5 py-3 rounded-xl mb-6">
            {success}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.key === currentPlan;
            const isPaid = currentPlan !== "free";
            return (
              <div
                key={plan.key}
                className={`rounded-2xl border p-6 flex flex-col gap-4 transition-all ${
                  isCurrent
                    ? "border-indigo-500 bg-indigo-950/50"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                }`}
              >
                {isCurrent && (
                  <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full w-fit">
                    Current plan
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-2xl font-bold mt-1">
                    {plan.price === 0
                      ? "Free"
                      : `₹${plan.price.toLocaleString()}/mo`}
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-gray-300 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-green-400">✓</span> {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  plan.key !== "free" ? (
                    <button
                      onClick={handleCancel}
                      className="py-2 rounded-lg text-sm font-medium border border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400 transition-all"
                    >
                      Cancel plan
                    </button>
                  ) : (
                    <button disabled className="py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-500 cursor-not-allowed">
                      Current
                    </button>
                  )
                ) : plan.key === "free" ? (
                  isPaid ? (
                    <button
                      onClick={handleCancel}
                      className="py-2 rounded-lg text-sm font-medium border border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400 transition-all"
                    >
                      Downgrade
                    </button>
                  ) : (
                    <button disabled className="py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-500 cursor-not-allowed">
                      Free
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={loading === plan.key}
                    className="py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 transition-all"
                  >
                    {loading === plan.key ? "Processing..." : "Upgrade"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 bg-gray-900 border border-gray-800 rounded-xl p-5 text-sm text-gray-400">
          <p className="font-medium text-gray-300 mb-1">Test mode</p>
          <p>
            Use Razorpay test card <code className="text-indigo-300">4111 1111 1111 1111</code>,
            any future expiry, and any CVV to complete a test payment.
          </p>
        </div>
      </main>
    </div>
  );
}
