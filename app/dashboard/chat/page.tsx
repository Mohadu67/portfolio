"use client";

import { useApiKey } from "@/lib/contexts/AuthContext";
import { ChatPanel } from "@/components/dashboard/chat/ChatPanel";

export default function ChatFullPage() {
  const apiKey = useApiKey();

  return (
    <div className="max-w-3xl mx-auto h-full">
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] overflow-hidden">
        <ChatPanel apiKey={apiKey} variant="page" />
      </div>
    </div>
  );
}
