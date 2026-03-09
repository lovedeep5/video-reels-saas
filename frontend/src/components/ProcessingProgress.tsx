"use client";

interface Props {
  status: string;
  progress: number;
  message: string;
  error?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Queued",
  downloading: "Downloading",
  transcribing: "Transcribing",
  processing: "Analyzing",
  rendering: "Rendering",
  done: "Complete",
  failed: "Failed",
};

export default function ProcessingProgress({ status, progress, message, error }: Props) {
  const isDone = status === "completed";
  const isFailed = status === "failed";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-200">{STATUS_LABELS[status] ?? status}</span>
        <span className={`text-sm font-bold ${isDone ? "text-green-400" : isFailed ? "text-red-400" : "text-indigo-400"}`}>
          {isDone ? "100%" : isFailed ? "Error" : `${progress}%`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-800 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full progress-bar ${isDone ? "bg-green-500" : isFailed ? "bg-red-500" : "bg-indigo-500"}`}
          style={{ width: `${isDone ? 100 : isFailed ? 100 : progress}%` }}
        />
      </div>

      <p className="text-sm text-gray-400">{isFailed ? error || message : message}</p>
    </div>
  );
}
