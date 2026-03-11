/**
 * Meta Graph API helpers for Instagram Reels publishing.
 * Long-lived tokens (60 days). We extend on every publish to reset the window.
 */

const GRAPH_BASE = "https://graph.facebook.com/v18.0";

export interface InstagramAccount {
  ig_user_id: string;
  username: string;
}

/** Exchange an OAuth code for a long-lived access token. */
export async function exchangeCodeForLongLivedToken(code: string): Promise<string> {
  // Step 1: exchange code → short-lived token
  const shortRes = await fetch(`${GRAPH_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL!.trim()}/api/instagram/callback`,
      code,
    }),
  });
  const shortData = await shortRes.json();
  if (!shortData.access_token) {
    throw new Error(`Short-lived token exchange failed: ${JSON.stringify(shortData)}`);
  }

  // Step 2: extend short-lived → long-lived (60 days)
  return extendToken(shortData.access_token);
}

/** Extend a token to reset the 60-day expiry window. */
export async function extendToken(token: string): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("client_secret", process.env.META_APP_SECRET!);
  url.searchParams.set("fb_exchange_token", token);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Token extension failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

/**
 * Get the Instagram Business Account linked to any of the user's Pages.
 * Returns the first IG Business Account found.
 */
export async function getInstagramAccount(token: string): Promise<InstagramAccount> {
  // Get all pages the user manages
  const pagesRes = await fetch(
    `${GRAPH_BASE}/me/accounts?fields=id,name,instagram_business_account&access_token=${encodeURIComponent(token)}`
  );
  const pagesData = await pagesRes.json();

  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error("No Facebook Pages found. Connect a Page that is linked to an Instagram Business account.");
  }

  for (const page of pagesData.data) {
    const igId = page.instagram_business_account?.id;
    if (!igId) continue;

    // Fetch IG username
    const igRes = await fetch(
      `${GRAPH_BASE}/${igId}?fields=id,username&access_token=${encodeURIComponent(token)}`
    );
    const igData = await igRes.json();
    if (igData.id) {
      return { ig_user_id: igData.id, username: igData.username ?? igData.id };
    }
  }

  throw new Error(
    "No Instagram Business Account linked to your Facebook Pages. " +
    "Go to Facebook Settings → Linked Accounts to connect your Instagram."
  );
}

/**
 * Publish a video as an Instagram Reel.
 * Returns the published Instagram media ID and URL.
 */
export async function publishReel(
  token: string,
  igUserId: string,
  videoUrl: string,
  caption: string
): Promise<{ instagram_media_id: string; instagram_url: string }> {
  // Step 1: create container
  const containerRes = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
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

  // Step 2: poll until FINISHED (up to 10×6s = 60s)
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 6000));
    const statusRes = await fetch(
      `${GRAPH_BASE}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`
    );
    const statusData = await statusRes.json();

    if (statusData.status_code === "FINISHED") break;
    if (statusData.status_code === "ERROR") {
      throw new Error(`Container processing failed: ${statusData.status ?? "unknown error"}`);
    }
    // EXPIRED, IN_PROGRESS — keep polling
    if (i === 9) {
      throw new Error("Instagram container did not finish processing in time. Try again.");
    }
  }

  // Step 3: publish
  const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
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
