import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VidToReels — AI Video Clips & Faceless Video Generator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same image as opengraph-image, duplicated because Next.js Turbopack
// doesn't allow re-exporting `runtime` from another file.
export { default } from "./opengraph-image";
