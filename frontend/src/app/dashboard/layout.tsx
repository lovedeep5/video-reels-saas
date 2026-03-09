"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";
import { authApi } from "@/lib/api";
import { savePlanMeta } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    // Write getToken to window before any child mounts so the axios
    // interceptor has it available for all subsequent API calls.
    (window as any).__clerkGetToken = getToken;

    // Confirm we can actually get a token, then reveal children.
    getToken().then((token) => {
      if (token) {
        setReady(true);
        // Sync backend user record on first dashboard load.
        authApi.me()
          .then((res) => savePlanMeta(res.data))
          .catch((err) => console.error("[layout] authApi.me() failed:", err?.response?.status));
      }
    });
  }, [isLoaded, isSignedIn, getToken]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {ready ? children : (
          <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
            Loading…
          </div>
        )}
      </main>
    </div>
  );
}
