// VidToReels Cookie Sync — popup.js
// Works with both production (vidtoreels.com) and local dev (localhost:3000)

const PROD_URL = "https://vidtoreels.com";
const DEV_URL  = "http://localhost:3000";

// ── Helpers ──────────────────────────────────────────────────────────────────

function $(id) { return document.getElementById(id); }

function setStatus(boxId, dotId, labelId, detailId, { type, label, detail }) {
  const box = $(boxId);
  box.className = "status-box" + (type ? " " + type : "");
  $(dotId).className = "dot " + ({ success: "green", error: "red", warning: "yellow" }[type] ?? "gray");
  $(labelId).textContent = label;
  if (detailId) $(detailId).textContent = detail ?? "";
}

// ── Check which base URL to use (prod or dev) ────────────────────────────────

async function detectBaseUrl() {
  // Try to reach prod first; fall back to dev for local testing
  try {
    const r = await fetch(`${PROD_URL}/api/auth/me`, { credentials: "include" });
    if (r.status !== 0) return PROD_URL; // reachable (even 401 means server is up)
  } catch { /* offline or blocked */ }
  return DEV_URL;
}

// ── Check auth status by calling /api/auth/me ────────────────────────────────

async function checkAuth(baseUrl) {
  const res = await fetch(`${baseUrl}/api/auth/me`, { credentials: "include" });
  if (res.ok) {
    const user = await res.json();
    return { loggedIn: true, name: user.name || user.email };
  }
  return { loggedIn: false };
}

// ── Get YouTube + Google account cookies from Chrome ─────────────────────────
// yt-dlp needs both: YouTube cookies for the video session AND Google account
// cookies (SAPISID, SID, HSID, etc. on .google.com) to prove you're logged in.

const COOKIE_DOMAINS = [
  ".youtube.com",
  "youtube.com",
  ".google.com",
  "google.com",
  ".accounts.google.com",
  "accounts.google.com",
];

async function getYouTubeCookies() {
  const results = await Promise.all(
    COOKIE_DOMAINS.map(
      (domain) =>
        new Promise((resolve) => {
          chrome.cookies.getAll({ domain }, (cookies) => resolve(cookies || []));
        })
    )
  );

  const all = results.flat();

  // Deduplicate by name+domain
  const seen = new Set();
  return all.filter((c) => {
    const key = `${c.domain}|${c.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function init() {
  let baseUrl;
  try {
    baseUrl = await detectBaseUrl();
  } catch {
    baseUrl = PROD_URL;
  }

  // Check login
  let user;
  try {
    user = await checkAuth(baseUrl);
  } catch {
    user = { loggedIn: false };
  }

  if (!user.loggedIn) {
    $("main").style.display = "none";
    $("not-logged-in").style.display = "flex";
    return;
  }

  setStatus("auth-status", "auth-dot", "auth-label", "auth-detail", {
    type: "success",
    label: `Logged in as ${user.name}`,
    detail: baseUrl === DEV_URL ? "Using local dev server" : "",
  });

  // Check YouTube cookies
  $("yt-status").style.display = "block";
  const ytCookies = await getYouTubeCookies();

  if (ytCookies.length === 0) {
    setStatus("yt-status", "yt-dot", "yt-label", "yt-detail", {
      type: "error",
      label: "No YouTube cookies found",
      detail: "Please log into YouTube in Chrome first, then come back.",
    });
    $("sync-btn").disabled = true;
    return;
  }

  setStatus("yt-status", "yt-dot", "yt-label", "yt-detail", {
    type: "success",
    label: `YouTube session found`,
    detail: `${ytCookies.length} cookies ready to sync`,
  });

  $("sync-btn").disabled = false;

  // Sync button click
  $("sync-btn").addEventListener("click", async () => {
    $("sync-btn").disabled = true;
    $("sync-icon").innerHTML = '<div class="spinner"></div>';
    $("sync-text").textContent = "Syncing...";
    $("sync-result").style.display = "none";

    try {
      const res = await fetch(`${baseUrl}/api/cookies/sync`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: ytCookies }),
      });

      const data = await res.json();

      if (res.ok) {
        $("sync-result").style.display = "block";
        setStatus("sync-result", "result-dot", "result-label", "result-detail", {
          type: "success",
          label: "Cookies synced!",
          detail: `${data.cookie_count} YouTube cookies uploaded. Your next video should process successfully.`,
        });
        // Save last sync time
        chrome.storage.local.set({ lastSync: new Date().toISOString() });
      } else {
        $("sync-result").style.display = "block";
        setStatus("sync-result", "result-dot", "result-label", "result-detail", {
          type: "error",
          label: "Sync failed",
          detail: data.error || "Unknown error",
        });
      }
    } catch (e) {
      $("sync-result").style.display = "block";
      setStatus("sync-result", "result-dot", "result-label", "result-detail", {
        type: "error",
        label: "Network error",
        detail: String(e),
      });
    } finally {
      $("sync-icon").textContent = "🔄";
      $("sync-text").textContent = "Sync My YouTube Cookies";
      $("sync-btn").disabled = false;
    }
  });

  // Show last sync time if available
  chrome.storage.local.get(["lastSync"], (result) => {
    if (result.lastSync) {
      const d = new Date(result.lastSync);
      $("auth-detail").textContent = `Last synced: ${d.toLocaleString()}`;
    }
  });
}

init();
