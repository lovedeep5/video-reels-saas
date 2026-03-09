/**
 * YouTube Data API v3 helpers.
 * All YouTube-specific code lives here — easy to remove if needed.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";

export interface YouTubeTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export interface YouTubeUploadOptions {
  title: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
  videoBuffer: Buffer;
  tags?: string[];
}

/** Exchange an auth code for access + refresh tokens. */
export async function exchangeCodeForTokens(code: string): Promise<YouTubeTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL!.trim()}/api/youtube/callback`,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data;
}

/** Get a fresh access token from a stored refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

/** Fetch the user's YouTube channel name + ID. */
export async function getChannelInfo(accessToken: string) {
  const res = await fetch(`${CHANNELS_URL}?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  const channel = data.items?.[0];
  return {
    channel_id: channel?.id ?? "",
    channel_title: channel?.snippet?.title ?? "My Channel",
  };
}

/**
 * Upload a video to YouTube using the resumable upload protocol.
 * Returns the YouTube video ID.
 */
export async function uploadVideoToYouTube(
  accessToken: string,
  opts: YouTubeUploadOptions
): Promise<string> {
  // Step 1: initiate resumable upload session
  const initRes = await fetch(
    `${UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(opts.videoBuffer.length),
      },
      body: JSON.stringify({
        snippet: {
          title: opts.title,
          description: opts.description,
          categoryId: "22", // People & Blogs
          tags: opts.tags ?? [],
        },
        status: {
          privacyStatus: opts.visibility,
        },
      }),
    }
  );

  const sessionUri = initRes.headers.get("location");
  if (!sessionUri) {
    const err = await initRes.text();
    throw new Error(`YouTube upload init failed (${initRes.status}): ${err}`);
  }

  // Step 2: upload the video bytes
  const uploadRes = await fetch(sessionUri, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(opts.videoBuffer.length),
    },
    body: new Uint8Array(opts.videoBuffer),
  });

  // YouTube returns 200/201 with video resource, or 308 for incomplete chunks
  if (uploadRes.status !== 200 && uploadRes.status !== 201) {
    const err = await uploadRes.text();
    throw new Error(`YouTube upload failed (${uploadRes.status}): ${err}`);
  }

  const video = await uploadRes.json();
  if (!video.id) throw new Error("YouTube did not return a video ID");
  return video.id;
}
