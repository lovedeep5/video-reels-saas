"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function NotificationBar() {
  const [text, setText] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get<{ text: string }>("/admin/notification")
      .then((r) => setText(r.data.text || null))
      .catch(() => {});
  }, []);

  if (!text || dismissed) return null;

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/30">
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center gap-3">
        <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-sm text-amber-300 flex-1">{text}</p>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-500 hover:text-amber-300 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
