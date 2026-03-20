"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPlanMeta } from "@/lib/auth";
import VideoUploader from "@/components/VideoUploader";

export default function UploadPage() {
  const router = useRouter();
  const meta = getPlanMeta();

  useEffect(() => {
    if (meta && !meta.is_admin) {
      router.replace("/dashboard/faceless");
    }
  }, [meta, router]);

  if (!meta?.is_admin) {
    return <div className="text-gray-400 text-sm">Redirecting...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">YouTube to Clips</h1>
        <p className="text-gray-400 text-sm mt-1">
          Submit a YouTube URL or upload a video file. We&apos;ll extract the best moments as vertical reels.
        </p>
      </div>
      <VideoUploader />
    </div>
  );
}
