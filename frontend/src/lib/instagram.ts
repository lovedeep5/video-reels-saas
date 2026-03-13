/**
 * Instagram Login API helpers (2025+ flow).
 * Uses api.instagram.com for OAuth, graph.instagram.com for tokens & publishing.
 * Long-lived tokens last 60 days; refresh before expiry.
 */

const GRAPH_BASE = "https://graph.instagram.com";
const API_VERSION = "v21.0";

export interface InstagramAccount {
  ig_user_id: string;
  username: string;
}

/**
 * Exchange an OAuth code for a long-lived access token.
 * Instagram Login flow (NOT Facebook Login):
 *   1. POST https://api.instagram.com/oauth/access_token → short-lived (1hr)
 *   2. GET  https://graph.instagram.com/access_token?grant_type=ig_exchange_token → long-lived (60 days)
 */
export async function exchangeCodeForLongLivedToken(code: string): Promise<string> {
  // Step 1: exchange code → short-lived token (form-urlencoded required)
  const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!.trim(),
      client_secret: process.env.INSTAGRAM_APP_SECRET!.trim(),
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL!.trim()}/api/instagram/callback`,
      code,
    }),
  });
  const shortData = await shortRes.json();
  if (!shortData.access_token) {
    throw new Error(`Short-lived token exchange failed: ${JSON.stringify(shortData)}`);
  }

  // Step 2: exchange short-lived → long-lived (60 days)
  return extendToken(shortData.access_token);
}

/** Exchange a short-lived token for a long-lived one (60 days). */
export async function extendToken(shortLivedToken: string): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", process.env.INSTAGRAM_APP_SECRET!);
  url.searchParams.set("access_token", shortLivedToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Long-lived token exchange failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

/** Refresh a long-lived token (must be valid, not expired). Returns new 60-day token. */
export async function refreshToken(longLivedToken: string): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", longLivedToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

/**
 * Get the authenticated Instagram user's ID and username.
 * Uses the Instagram Graph API /me endpoint.
 */
export async function getInstagramAccount(token: string): Promise<InstagramAccount> {
  const res = await fetch(
    `${GRAPH_BASE}/${API_VERSION}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`
  );
  const data = await res.json();

  if (!data.user_id) {
    throw new Error(`Failed to get Instagram account: ${JSON.stringify(data)}`);
  }

  return {
    ig_user_id: data.user_id,
    username: data.username ?? data.user_id,
  };
}

/**
 * Publish a video as an Instagram Reel.
 * Uses the Content Publishing API:
 *   1. POST /{ig-user-id}/media  → create container (REELS)
 *   2. Poll container status until FINISHED
 *   3. POST /{ig-user-id}/media_publish → publish
 */
export async function publishReel(
  token: string,
  igUserId: string,
  videoUrl: string,
  caption: string
): Promise<{ instagram_media_id: string; instagram_url: string }> {
  // Step 1: create media container
  const containerRes = await fetch(`${GRAPH_BASE}/${API_VERSION}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      access_token: token,
    }),
  });
  const containerData = await containerRes.json();
  if (!containerData.id) {
    throw new Error(`Container creation failed: ${JSON.stringify(containerData)}`);
  }
  const containerId: string = containerData.id;

  // Step 2: poll until FINISHED (up to 20×5s = 100s for longer videos)
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(
      `${GRAPH_BASE}/${API_VERSION}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`
    );
    const statusData = await statusRes.json();

    if (statusData.status_code === "FINISHED") break;
    if (statusData.status_code === "ERROR") {
      throw new Error(`Container processing failed: ${statusData.status ?? "unknown error"}`);
    }
    if (i === 19) {
      throw new Error("Instagram container did not finish processing in time. Try again.");
    }
  }

  // Step 3: publish
  const publishRes = await fetch(`${GRAPH_BASE}/${API_VERSION}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: token,
    }),
  });
  const publishData = await publishRes.json();
  if (!publishData.id) {
    throw new Error(`Publish failed: ${JSON.stringify(publishData)}`);
  }

  const mediaId: string = publishData.id;
  return {
    instagram_media_id: mediaId,
    instagram_url: `https://www.instagram.com/reel/${mediaId}/`,
  };
}
