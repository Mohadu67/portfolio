"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Trash2, Loader2, Wrench, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  requires_confirmation?: boolean;
}

interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

interface ToolCallState {
  call: ToolCall;
  status: "pending" | "approved" | "executing" | "done" | "rejected" | "error";
  result?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
}

const STORAGE_KEY = "chat-messages-v2";

const SUGGESTIONS = [
  "Que dois-je faire aujourd'hui ?",
  "Quelles candidatures je devrais relancer cette semaine ?",
  "Programme une relance polie pour ma candidature la plus ancienne sans réponse.",
  "Marque la candidature X en 'entretien'.",
  "Donne-moi un récap de la semaine.",
];

const TOOL_LABELS: Record<string, string> = {
  schedule_relance: "📅 Programmer une relance",
  cancel_relance: "🚫 Annuler une relance",
  update_candidature_status: "🔖 Changer le statut",
  update_candidature_notes: "📝 Mettre à jour les notes",
  send_relance_now: "✉️ Envoyer une relance immédiatement",
  list_candidatures: "🔍 Lister les candidatures",
  get_candidature: "📄 Lire une candidature",
  list_relances_due: "📋 Lister les relances dues",
  list_cv_sections: "📚 Lister les sections du CV",
  get_cv_section: "📖 Lire une section du CV",
};

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
  const [pendingTools, setPendingTools] = useState<ToolCallState[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages]);

  const streamFromMessages = async (msgs: Message[]) => {
    setStreaming(true);
    let acc = "";
    let receivedToolCalls: ToolCall[] = [];

    // Strip the trailing empty assistant placeholder that the UI adds for streaming.
    // Anthropic requires the last message to be a user message.
    const sendable = msgs.filter((m, i) => {
      if (i !== msgs.length - 1) return true;
      // last message — keep only if user, or assistant with actual content/tool_calls
      if (m.role === "user") return true;
      return Boolean(m.content || (m.tool_calls && m.tool_calls.length > 0));
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: sendable.map((m) => ({
            role: m.role,
            content: m.content,
            tool_calls: m.tool_calls,
            tool_results: m.tool_results,
          })),
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Erreur" }));
        throw new Error(err.error ?? "Erreur");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
          const data = JSON.parse(dataLine);
          if (eventName === "delta" && typeof data.text === "string") {
            acc += data.text;
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { ...copy[copy.length - 1], content: acc };
              return copy;
            });
          } else if (eventName === "tool_calls") {
            receivedToolCalls = data.tool_calls ?? [];
          } else if (eventName === "error") {
            throw new Error(data.error ?? "Erreur côté IA");
          }
        }
      }

      // Attach tool_calls to the assistant message if any
      if (receivedToolCalls.length > 0) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            tool_calls: receivedToolCalls,
          };
          return copy;
        });

        // Auto-execute read-only tools (no confirmation needed) and re-stream.
        const allReadOnly = receivedToolCalls.every((tc) => tc.requires_confirmation === false);
        if (allReadOnly) {
          setStreaming(false);
          await autoExecuteTools(receivedToolCalls);
          return;
        }

        setPendingTools(receivedToolCalls.map((tc) => ({ call: tc, status: "pending" })));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
      setMessages((prev) => {
        const copy = [...prev];
        if (copy[copy.length - 1]?.role === "assistant" && !copy[copy.length - 1].content && !receivedToolCalls.length) {
          copy.pop();
        }
        return copy;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming || pendingTools.some((t) => t.status === "pending")) return;

    const next: Message[] = [
      ...messages,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" },
    ];
    setMessages(next);
    setInput("");
    await streamFromMessages(next);
  };

  const executeTool = async (state: ToolCallState): Promise<ToolResult> => {
    try {
      const res = await fetch("/api/chat/tool-exec", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ tool: state.call.name, input: state.call.input }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          tool_use_id: state.call.id,
          content: data.error ?? "Erreur d'exécution",
          is_error: true,
        };
      }
      return {
        tool_use_id: state.call.id,
        content: data.summary ?? "OK",
      };
    } catch (err) {
      return {
        tool_use_id: state.call.id,
        content: err instanceof Error ? err.message : "Erreur",
        is_error: true,
      };
    }
  };

  const autoExecuteTools = async (calls: ToolCall[]) => {
    const results: ToolResult[] = [];
    for (const call of calls) {
      const res = await executeTool({ call, status: "executing" });
      results.push(res);
    }
    let snapshot: Message[] = [];
    setMessages((prev) => {
      snapshot = [
        ...prev,
        { role: "user", content: "", tool_results: results },
        { role: "assistant", content: "" },
      ];
      return snapshot;
    });
    await new Promise((r) => setTimeout(r, 0));
    await streamFromMessages(snapshot);
  };

  const approveAll = async () => {
    setPendingTools((p) => p.map((t) => ({ ...t, status: "executing" })));
    const results: ToolResult[] = [];

    for (const t of pendingTools) {
      const res = await executeTool(t);
      results.push(res);
      setPendingTools((p) =>
        p.map((x) =>
          x.call.id === t.call.id
            ? { ...x, status: res.is_error ? "error" : "done", result: res.content }
            : x
        )
      );
      if (res.is_error) toast.error(res.content);
      else toast.success(res.content);
    }

    // Add a user message with tool_results, then call the model again to get final response
    const next: Message[] = [
      ...messages,
      { role: "user", content: "", tool_results: results },
      { role: "assistant", content: "" },
    ];
    setMessages(next);
    setPendingTools([]);
    await streamFromMessages(next);
  };

  const rejectAll = async () => {
    const results: ToolResult[] = pendingTools.map((t) => ({
      tool_use_id: t.call.id,
      content: "L'utilisateur a refusé cette action.",
      is_error: true,
    }));
    setPendingTools((p) => p.map((t) => ({ ...t, status: "rejected" })));

    const next: Message[] = [
      ...messages,
      { role: "user", content: "", tool_results: results },
      { role: "assistant", content: "" },
    ];
    setMessages(next);
    setPendingTools([]);
    await streamFromMessages(next);
  };

  const clear = () => {
    if (!confirm("Effacer la conversation ?")) return;
    setMessages([]);
    setPendingTools([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div
      className={`flex flex-col ${
        variant === "dock"
          ? "h-[calc(100%-var(--topbar-height))]"
          : "h-[calc(100vh-var(--topbar-height)-3rem)] max-h-[800px]"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-soft)]">
        <p className="text-xs text-[var(--text-tertiary)]">
          {messages.length === 0
            ? "Démarre une conversation"
            : `${messages.length} message${messages.length > 1 ? "s" : ""}`}
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
              <br />
              <span className="text-[var(--text-tertiary)]">
                Je peux aussi <strong>agir</strong> avec ta confirmation.
              </span>
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

        {messages.map((m, i) => {
          if (m.role === "user" && m.tool_results) {
            // Hide tool result messages (they're system-level)
            return null;
          }
          if (!m.content && !m.tool_calls) return null;

          return (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "bg-[var(--accent-orange)] text-[var(--bg-primary)]"
                    : "bg-[var(--bg-card)] border border-[var(--border-soft)] text-[var(--text-primary)]"
                }`}
              >
                {m.content ||
                  (m.tool_calls ? (
                    <span className="text-[var(--text-tertiary)] italic">
                      Demande d&apos;action...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-[var(--text-tertiary)]">
                      <Loader2 size={12} className="animate-spin" /> Réflexion…
                    </span>
                  ))}
              </div>
            </div>
          );
        })}

        {/* Pending tool calls — confirmation UI */}
        {pendingTools.length > 0 && (
          <div className="rounded-xl border border-[var(--accent-warning)]/40 bg-[var(--accent-warning)]/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-warning)]">
              <Wrench size={14} /> Action{pendingTools.length > 1 ? "s" : ""} demandée{pendingTools.length > 1 ? "s" : ""} par l&apos;IA
            </div>
            <div className="space-y-2">
              {pendingTools.map((t) => (
                <ToolCard key={t.call.id} state={t} />
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={approveAll}
                disabled={streaming || pendingTools.some((t) => t.status === "executing")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent-success)] text-[var(--bg-primary)] text-sm font-semibold disabled:opacity-50"
              >
                <Check size={14} /> Confirmer
              </button>
              <button
                onClick={rejectAll}
                disabled={streaming || pendingTools.some((t) => t.status === "executing")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-soft)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
              >
                <X size={14} /> Refuser
              </button>
            </div>
          </div>
        )}
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
          placeholder={pendingTools.length > 0 ? "Confirme ou refuse l'action ci-dessus…" : "Pose ta question…"}
          rows={1}
          disabled={streaming || pendingTools.some((t) => t.status === "pending")}
          className="flex-1 resize-none rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] max-h-32 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim() || pendingTools.some((t) => t.status === "pending")}
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] disabled:opacity-40 hover:opacity-90"
        >
          {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}

function ToolCard({ state }: { state: ToolCallState }) {
  const label = TOOL_LABELS[state.call.name] ?? state.call.name;
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
        {state.status === "executing" && (
          <Loader2 size={12} className="animate-spin text-[var(--text-tertiary)]" />
        )}
        {state.status === "done" && <Check size={12} className="text-[var(--accent-success)]" />}
        {state.status === "error" && <AlertTriangle size={12} className="text-[var(--accent-danger)]" />}
        {state.status === "rejected" && <X size={12} className="text-[var(--text-tertiary)]" />}
      </div>
      <pre className="text-xs whitespace-pre-wrap bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded p-2 max-h-32 overflow-y-auto font-mono">
        {JSON.stringify(state.call.input, null, 2)}
      </pre>
      {state.result && (
        <p className="text-xs mt-2 text-[var(--text-secondary)]">{state.result}</p>
      )}
    </div>
  );
}
