import VideoUploader from "@/components/VideoUploader";

export default function UploadPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">New Video</h1>
        <p className="text-gray-400 text-sm mt-1">
          Submit a YouTube URL or upload a video file. We&apos;ll extract the best moments as vertical reels.
        </p>
      </div>
      <VideoUploader />
    </div>
  );
}
