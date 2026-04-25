"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "chat-messages-v1";

const SUGGESTIONS = [
  "Que dois-je faire aujourd'hui ?",
  "Quelles candidatures je devrais relancer cette semaine ?",
  "Lesquelles sont stagnantes depuis plus de 7 jours ?",
  "Donne-moi un récap de la semaine.",
  "Quelles offres correspondent le mieux à mon profil ?",
];

interface ChatPanelProps {
  apiKey: string;
  variant?: "dock" | "page";
}

export function ChatPanel({ apiKey, variant = "page" }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const next: Message[] = [...messages, { role: "user", content: trimmed }, { role: "assistant", content: "" }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Erreur" }));
        throw new Error(err.error ?? "Erreur");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const evt of events) {
          const lines = evt.split("\n");
          let eventName = "message";
          let dataLine = "";
          for (const l of lines) {
            if (l.startsWith("event: ")) eventName = l.slice(7);
            else if (l.startsWith("data: ")) dataLine = l.slice(6);
          }
          if (!dataLine) continue;
          try {
            const data = JSON.parse(dataLine);
            if (eventName === "delta" && typeof data.text === "string") {
              acc += data.text;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            } else if (eventName === "error") {
              throw new Error(data.error ?? "Erreur côté IA");
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Erreur côté IA") continue;
            throw e;
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
      setMessages((prev) => {
        const copy = [...prev];
        if (copy[copy.length - 1]?.role === "assistant" && !copy[copy.length - 1].content) {
          copy.pop();
        }
        return copy;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const clear = () => {
    if (!confirm("Effacer la conversation ?")) return;
    setMessages([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className={`flex flex-col ${variant === "dock" ? "h-[calc(100%-var(--topbar-height))]" : "h-[calc(100vh-var(--topbar-height)-3rem)] max-h-[800px]"}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-soft)]">
        <p className="text-xs text-[var(--text-tertiary)]">
          {messages.length === 0 ? "Démarre une conversation" : `${messages.length} message${messages.length > 1 ? "s" : ""}`}
        </p>
        {messages.length > 0 && (
          <button
            onClick={clear}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-danger)]"
          >
            <Trash2 size={12} /> Effacer
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent-orange)]/20 to-[var(--accent-blue)]/20 flex items-center justify-center mx-auto">
              <Sparkles size={22} className="text-[var(--accent-orange)]" />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              J&apos;ai accès à toutes tes candidatures, ton CV et tes relances.
            </p>
            <div className="flex flex-col gap-2 max-w-md mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left px-3 py-2 rounded-lg border border-[var(--border-soft)] text-sm text-[var(--text-secondary)] hover:border-[var(--accent-orange)]/40 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === "user"
                  ? "bg-[var(--accent-orange)] text-[var(--bg-primary)]"
                  : "bg-[var(--bg-card)] border border-[var(--border-soft)] text-[var(--text-primary)]"
              }`}
            >
              {m.content || (
                <span className="inline-flex items-center gap-2 text-[var(--text-tertiary)]">
                  <Loader2 size={12} className="animate-spin" /> Réflexion…
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-[var(--border-soft)] p-3 flex items-end gap-2"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Pose ta question…"
          rows={1}
          disabled={streaming}
          className="flex-1 resize-none rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] max-h-32"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] disabled:opacity-40 hover:opacity-90"
        >
          {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}
