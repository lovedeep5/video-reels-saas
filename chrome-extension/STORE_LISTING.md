# Chrome Web Store — Submission Info

## Extension Name
VidToReels Cookie Sync

## Short Description (132 chars max)
Sync your YouTube session to VidToReels so age-restricted or sign-in required videos can be processed without errors.

## Detailed Description
VidToReels Cookie Sync allows VidToReels (vidtoreels.com) to process YouTube videos that require you to be signed in — such as age-restricted content or videos that trigger YouTube's bot detection.

HOW IT WORKS:
1. Make sure you're logged into YouTube in Chrome
2. Open this extension while logged into VidToReels
3. Click "Sync My YouTube Cookies"
4. Your YouTube session is securely uploaded to VidToReels

That's it — your next video submission will process without any "YouTube blocked this download" errors.

PRIVACY:
- Cookies are only sent to vidtoreels.com (your own account)
- No data is shared with third parties
- You can re-sync any time your YouTube session changes (e.g. after logging out and back in)

This extension is intended solely for use with your VidToReels account.

## Category
Productivity

## Language
English

## Single Purpose Description
To sync the user's YouTube session cookies from Chrome to their VidToReels account, enabling processing of YouTube videos that require authentication.

## Privacy Policy URL
https://vidtoreels.com/privacy

---

## Permissions Justification

**cookies**
Required to read your YouTube and Google session cookies from Chrome so they can be synced to VidToReels for video processing.

**storage**
Used to store the timestamp of the last successful sync locally on the user's device.

**host: *.youtube.com**
To read YouTube session cookies needed for authenticated video downloads.

**host: *.google.com**
To read Google account cookies (SAPISID, SID, HSID etc.) required alongside YouTube cookies by the download tool.

**host: vidtoreels.com**
To upload the collected cookies securely to the user's VidToReels account via the API.

---

## Reviewer Notes (paste in the "Notes for reviewer" field)
This extension collects YouTube and Google session cookies solely to authenticate video downloads on the user's behalf within their own VidToReels account. Cookies are transmitted over HTTPS exclusively to vidtoreels.com — no data is sent to any third party. The user must be logged into both YouTube and VidToReels for the extension to function. This is a companion tool for the VidToReels SaaS product.
