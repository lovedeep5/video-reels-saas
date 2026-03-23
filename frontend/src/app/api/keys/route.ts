import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiKeysCol, ObjectId } from "@/lib/mongodb";

const API_KEY_PREFIX = "vr_live_";

function generateApiKey() {
  const raw = randomBytes(32).toString("hex");
  const fullKey = `${API_KEY_PREFIX}${raw}`;
  const prefix = fullKey.slice(0, 16);
  const keyHash = createHash("sha256").update(fullKey).digest("hex");
  return { fullKey, prefix, keyHash };
}

function computeExpiry(expiry: string, customDate?: string): Date | undefined {
  const now = new Date();
  if (expiry === "week") return new Date(now.getTime() + 7 * 86400000);
  if (expiry === "month") return new Date(now.getTime() + 30 * 86400000);
  if (expiry === "3months") return new Date(now.getTime() + 90 * 86400000);
  if (expiry === "year") return new Date(now.getTime() + 365 * 86400000);
  if (expiry === "custom" && customDate) {
    const d = new Date(customDate);
    if (isNaN(d.getTime())) return undefined;
    if (d.getTime() <= now.getTime()) return undefined;
    return d;
  }
  return undefined; // never
}

function serializeKey(k: any, fullKey?: string) {
  const now = new Date();
  const base = {
    id: k._id.toHexString(),
    name: k.name,
    key_prefix: k.key_prefix,
    is_active: k.is_active,
    created_at: k.created_at?.toISOString(),
    last_used_at: k.last_used_at?.toISOString() ?? null,
    expires_at: k.expires_at?.toISOString() ?? null,
    is_expired: k.expires_at ? k.expires_at < now : false,
  };
  return fullKey ? { ...base, full_key: fullKey } : base;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await apiKeysCol();
  const list = await keys.find({ user_id: user._id, is_active: true }).sort({ created_at: -1 }).toArray();
  return NextResponse.json(list.map((k) => serializeKey(k)));
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, expiry = "never", custom_expires_at } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Key name cannot be empty" }, { status: 400 });

  const keys = await apiKeysCol();
  const activeCount = await keys.countDocuments({ user_id: user._id, is_active: true });
  if (activeCount >= 10) {
    return NextResponse.json({ error: "Maximum 10 active API keys per account" }, { status: 400 });
  }

  const { fullKey, prefix, keyHash } = generateApiKey();
  const expiresAt = computeExpiry(expiry, custom_expires_at);

  const result = await keys.insertOne({
    user_id: user._id!,
    name: name.trim(),
    key_prefix: prefix,
    key_hash: keyHash,
    is_active: true,
    expires_at: expiresAt,
    created_at: new Date(),
  });

  const created = await keys.findOne({ _id: result.insertedId });
  return NextResponse.json(serializeKey(created, fullKey), { status: 201 });
}
