import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { ObjectId } from "mongodb";
import { usersCol, apiKeysCol, DbUser } from "./mongodb";

const API_KEY_PREFIX = "vr_live_";

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// ── Resolve user from Clerk session or API key ────────────────────────────────

export async function getCurrentUser(req?: NextRequest): Promise<DbUser | null> {
  // 1. Check X-API-Key header (recommended for Postman / programmatic use)
  const xApiKey = req?.headers.get("x-api-key") ?? "";
  if (xApiKey.startsWith(API_KEY_PREFIX)) {
    return getUserByApiKey(xApiKey);
  }

  // 2. Check Authorization: Bearer header — but only if it looks like an API key,
  //    because Clerk v5 throws on malformed JWTs before our code can intercept.
  const authHeader = req?.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (bearerToken.startsWith(API_KEY_PREFIX)) {
    return getUserByApiKey(bearerToken);
  }

  // 3. Fall back to Clerk session (browser requests with session cookie/JWT)
  return getUserFromClerkSession();
}

async function getUserByApiKey(key: string): Promise<DbUser | null> {
  const keyHash = hashApiKey(key);
  const keys = await apiKeysCol();
  const apiKey = await keys.findOne({ key_hash: keyHash, is_active: true });
  if (!apiKey) return null;

  // Check expiry
  if (apiKey.expires_at && apiKey.expires_at < new Date()) return null;

  // Update last_used_at (fire and forget — don't block the request)
  keys.updateOne({ _id: apiKey._id }, { $set: { last_used_at: new Date() } }).catch(() => {});

  const users = await usersCol();
  return users.findOne({ _id: apiKey.user_id });
}

async function getUserFromClerkSession(): Promise<DbUser | null> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return null;
    return getOrCreateUser(clerkId);
  } catch {
    // Clerk throws on malformed tokens (e.g. API key accidentally parsed as JWT)
    return null;
  }
}

// ── Create user on first login ────────────────────────────────────────────────

export async function getOrCreateUser(clerkId: string): Promise<DbUser | null> {
  const users = await usersCol();

  const existing = await users.findOne({ clerk_id: clerkId });
  if (existing) return existing;

  // Fetch user info from Clerk Backend API
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    });
    if (!res.ok) return null;
    const data = await res.json();

    const primaryId = data.primary_email_address_id;
    const emailObj = (data.email_addresses ?? []).find((e: any) => e.id === primaryId);
    const email = emailObj?.email_address ?? "";
    const name =
      `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || email.split("@")[0];

    // Link to existing user by email (migration path from old SQLite auth)
    const byEmail = await users.findOne({ email });
    if (byEmail) {
      await users.updateOne({ _id: byEmail._id }, { $set: { clerk_id: clerkId } });
      return users.findOne({ _id: byEmail._id });
    }

    const newUser: DbUser = {
      clerk_id: clerkId,
      email,
      name,
      plan: "free",
      is_active: true,
      created_at: new Date(),
    };
    const result = await users.insertOne(newUser);
    return { ...newUser, _id: result.insertedId };
  } catch {
    return null;
  }
}

// ── Serialise MongoDB ObjectId → string id ────────────────────────────────────

export function serializeId<T extends { _id?: ObjectId }>(
  doc: T
): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id!.toHexString() };
}
