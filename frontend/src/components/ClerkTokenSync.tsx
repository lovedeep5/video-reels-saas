"use client";
import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * Writes the Clerk getToken function to window.__clerkGetToken so the
 * axios interceptor in api.ts can attach the session token to every request.
 * Uses useEffect so it only runs client-side after Clerk has initialised.
 */
export default function ClerkTokenSync() {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    (window as any).__clerkGetToken = getToken;
  }, [isLoaded, getToken]);

  return null;
}
