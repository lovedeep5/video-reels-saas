"use client";
import { useRef, useState } from "react";
import Head from "next/head";

type UploadState = "idle" | "validating" | "uploading" | "success" | "error";

interface UploadResult {
  message: string;
  stats: {
    total_cookie_lines: number;
    youtube_cookies: number;
    google_cookies: number;
    file_size_kb: number;
    s3_key: string;
  };
}

export default function CookiesAdminPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragging, setDragging] = useState(false);

  function validateAndSetFile(f: File) {
    setError(null);
    setResult(null);
    if (!f.name.endsWith(".txt")) {
      setError("Must be a .txt file exported from your browser.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File too large (max 5MB).");
      return;
    }
    setFile(f);
    setState("idle");
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSetFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setState("uploading");
    setError(null);

    const form = new FormData();
    form.append("cookies", file);

    try {
      const res = await fetch("/api/admin/cookies", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        setState("error");
      } else {
        setResult(data);
        setState("success");
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch {
      setError("Network error — please try again.");
      setState("error");
    }
  }

  return (
    <>
      {/* noindex — hide from search crawlers */}
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-bold mb-1">Sync YouTube Cookies</h1>
        <p className="text-sm text-gray-500 mb-6">
          Manually upload your YouTube cookies file. These are stored privately for your account only
          and used to download videos without bot-detection errors.
        </p>

        {/* Recommended: extension */}
        <div className="bg-indigo-950 border border-indigo-800 rounded-xl p-4 mb-4 text-sm">
          <p className="text-indigo-300 font-medium mb-1">Recommended: use our Chrome extension</p>
          <p className="text-indigo-400 text-xs mb-2">One click syncs everything automatically — no file download needed.</p>
          <a href="/dashboard/settings" className="text-xs text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg inline-block">
            Go to Settings → Install Extension
          </a>
        </div>

        {/* Manual fallback */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-sm text-gray-400 space-y-2">
          <p className="text-gray-300 font-medium">Or upload manually</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Install <span className="text-white font-mono text-xs">"Get cookies.txt LOCALLY"</span> Chrome extension</li>
            <li>Log in to <span className="text-white">youtube.com</span></li>
            <li>Click the extension → Export → <span className="text-white">All Cookies</span> (Netscape format)</li>
            <li>Upload the downloaded file below</li>
          </ol>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4
            ${dragging ? "border-blue-500 bg-blue-950/30" : "border-gray-700 hover:border-gray-500"}
            ${file ? "border-green-700 bg-green-950/20" : ""}
          `}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={onFileChange}
          />

          {file ? (
            <div className="text-green-400">
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-green-600 mt-1">{(file.size / 1024).toFixed(0)} KB — ready to upload</p>
            </div>
          ) : (
            <div className="text-gray-500">
              <p>Drop your <span className="text-gray-300">.txt</span> cookies file here</p>
              <p className="text-xs mt-1">or click to browse</p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Success */}
        {state === "success" && result && (
          <div className="bg-green-950 border border-green-800 rounded-xl p-4 mb-4 text-sm space-y-2">
            <p className="text-green-300 font-medium">{result.message}</p>
            <div className="text-green-600 space-y-0.5 font-mono text-xs">
              <p>YouTube cookies: {result.stats.youtube_cookies}</p>
              <p>Google cookies:  {result.stats.google_cookies}</p>
              <p>Total lines:     {result.stats.total_cookie_lines}</p>
              <p>File size:       {result.stats.file_size_kb} KB</p>
              <p>Saved to:        {result.stats.s3_key}</p>
            </div>
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!file || state === "uploading"}
          className="w-full py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {state === "uploading" ? "Uploading…" : "Upload Cookies"}
        </button>

        <p className="text-xs text-gray-600 mt-3 text-center">
          Cookies are stored privately in S3 under your account and only used to download your videos.
        </p>
      </div>
    </>
  );
}
