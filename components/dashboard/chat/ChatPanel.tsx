"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "./EmptyState";
import { MessageList } from "./MessageList";
import { PendingToolsPanel } from "./PendingToolsPanel";
import { STORAGE_KEY } from "./types";
import type { Message, ToolAction, ToolCall, ToolCallState, ToolResult } from "./types";

interface ChatPanelProps {
  apiKey: string;
  variant?: "dock" | "page";
}

export function ChatPanel({ apiKey, variant = "page" }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Message[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingTools, setPendingTools] = useState<ToolCallState[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist + auto-scroll to bottom on new message
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [messages, pendingTools]);

  // Auto-resize textarea (mobile : max-h-40 = 160px, desktop : max-h-48 = 192px)
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    const max = window.innerWidth >= 640 ? 192 : 160;
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 44), max)}px`;
  }, [input]);

  const streamFromMessages = async (msgs: Message[]) => {
    setStreaming(true);
    let acc = "";
    let receivedToolCalls: ToolCall[] = [];

    // Strip the trailing empty assistant placeholder that the UI adds for streaming.
    // Anthropic requires the last message to be a user message.
    const sendable = msgs.filter((m, i) => {
      if (i !== msgs.length - 1) return true;
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
            receivedToolCalls = (data.tool_calls ?? []) as ToolCall[];
          } else if (eventName === "error") {
            throw new Error(data.error ?? "Erreur côté IA");
          }
        }
      }

      // Attach tool_calls to the assistant message if any
      if (receivedToolCalls.length > 0) {
        // Build the updated messages array locally (don't rely on setMessages updater
        // side-effect which can be deferred in React 18 concurrent mode).
        const msgsWithToolCalls = msgs.map((m, i) =>
          i === msgs.length - 1
            ? { ...m, content: acc, tool_calls: receivedToolCalls }
            : m,
        );
        setMessages(msgsWithToolCalls);

        // Auto-execute read-only tools (no confirmation needed) and re-stream.
        const allReadOnly = receivedToolCalls.every((tc) => tc.requires_confirmation === false);
        if (allReadOnly) {
          setStreaming(false);
          await autoExecuteTools(receivedToolCalls, msgsWithToolCalls);
          return;
        }

        setPendingTools(receivedToolCalls.map((tc) => ({ call: tc, status: "pending" })));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
      setMessages((prev) => {
        const copy = [...prev];
        if (
          copy[copy.length - 1]?.role === "assistant" &&
          !copy[copy.length - 1].content &&
          !receivedToolCalls.length
        ) {
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
        // Utilise l'input édité par l'user dans la card si présent,
        // sinon l'input proposé par l'IA.
        body: JSON.stringify({
          tool: state.call.name,
          input: state.editedInput ?? state.call.input,
        }),
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
        // Boutons d'action contextuels (non envoyés à l'IA — affichés uniquement dans l'UI).
        actions: Array.isArray(data.actions) ? data.actions : undefined,
      };
    } catch (err) {
      return {
        tool_use_id: state.call.id,
        content: err instanceof Error ? err.message : "Erreur",
        is_error: true,
      };
    }
  };

  const autoExecuteTools = async (calls: ToolCall[], baseMsgs: Message[]) => {
    const results: ToolResult[] = [];
    for (const call of calls) {
      const res = await executeTool({ call, status: "executing" });
      results.push(res);
    }
    const snapshot: Message[] = [
      ...baseMsgs,
      { role: "user", content: "", tool_results: results },
      { role: "assistant", content: "" },
    ];
    setMessages(snapshot);
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
            : x,
        ),
      );
      if (res.is_error) toast.error(res.content);
      else toast.success(res.content);
    }

    // Add a user message with tool_results, then call the model again
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

  const updateToolInput = (callId: string, patch: Record<string, unknown>) => {
    setPendingTools((p) =>
      p.map((t) =>
        t.call.id === callId
          ? { ...t, editedInput: { ...(t.editedInput ?? t.call.input), ...patch } }
          : t,
      ),
    );
  };

  const clear = () => {
    if (!confirm("Effacer la conversation ?")) return;
    setMessages([]);
    setPendingTools([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  // Click sur un action chip rendu sous le dernier message assistant. Le bouton remplace une
  // saisie utilisateur "oui envoie à <email>" + un nouveau cycle de confirmation : on synthétise
  // directement le tool_call comme si l'IA l'avait fait, puis on exécute. Le clic vaut consentement.
  const handleAction = async (action: ToolAction) => {
    if (streaming || hasPending) return;

    // Pseudo-tool "__cancel__" : marque visuellement l'abandon, l'IA acquittera.
    if (action.tool === "__cancel__") {
      const next: Message[] = [
        ...messages,
        { role: "user", content: action.label },
        { role: "assistant", content: "" },
      ];
      setMessages(next);
      await streamFromMessages(next);
      return;
    }

    const callId = `actionchip_${Date.now()}`;
    const syntheticCall: ToolCall = {
      id: callId,
      name: action.tool,
      input: action.input,
      requires_confirmation: false,
    };

    // 1. user message (label du chip) + assistant message portant le tool_call synthétique
    const baseMsgs: Message[] = [
      ...messages,
      { role: "user", content: action.label },
      { role: "assistant", content: "", tool_calls: [syntheticCall] },
    ];
    setMessages(baseMsgs);

    // 2. exécution directe du tool (pas de card de confirmation — le clic suffit)
    setStreaming(true);
    const result = await executeTool({ call: syntheticCall, status: "executing" });
    setStreaming(false);

    if (result.is_error) toast.error(result.content);
    else toast.success(result.content);

    // 3. tool_results + assistant streaming
    const next: Message[] = [
      ...baseMsgs,
      { role: "user", content: "", tool_results: [result] },
      { role: "assistant", content: "" },
    ];
    setMessages(next);
    await streamFromMessages(next);
  };

  const hasMessages = messages.length > 0;
  const hasPending = pendingTools.some((t) => t.status === "pending");
  const canSend = !!input.trim() && !streaming && !hasPending;

  // Largeurs : full-width sur mobile, contenu lisible en max-w-3xl sur desktop.
  // On utilise une largeur "claude.ai-like" centrée pour le contenu.
  const contentWidth =
    variant === "page" ? "max-w-3xl mx-auto w-full" : "w-full";

  return (
    <div
      className={`flex flex-col bg-[var(--bg-primary)] ${
        variant === "dock"
          ? "h-[calc(100%-var(--topbar-height))]"
          : "h-[calc(100dvh-var(--topbar-height))] sm:h-[calc(100vh-var(--topbar-height)-1.5rem)]"
      }`}
    >
      {hasMessages && (
        <div className="flex items-center justify-between px-4 sm:px-5 py-2 border-b border-[var(--border-soft)]">
          <p className="text-xs text-[var(--text-tertiary)]">
            {messages.length} message{messages.length > 1 ? "s" : ""}
          </p>
          <button
            onClick={clear}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-danger)] py-1.5 px-2 -mr-2 rounded transition-colors"
          >
            <Trash2 size={12} /> Effacer
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className={`${contentWidth} px-4 sm:px-6 py-6 sm:py-8`}>
          {!hasMessages ? (
            <EmptyState onPick={send} />
          ) : (
            <>
              <MessageList messages={messages} streaming={streaming} onAction={handleAction} />
              {pendingTools.length > 0 && (
                <div className="mt-8">
                  <PendingToolsPanel
                    pending={pendingTools}
                    disabled={streaming}
                    onApprove={approveAll}
                    onReject={rejectAll}
                    onEdit={updateToolInput}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-[var(--border-soft)] px-3 sm:px-4 py-3 sm:py-4"
      >
        <div className={`${contentWidth} flex items-end gap-2`}>
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
            placeholder={
              hasPending
                ? "Confirme ou refuse l'action ci-dessus…"
                : "Pose ta question…"
            }
            rows={1}
            disabled={streaming || hasPending}
            className="flex-1 resize-none rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)] px-4 py-3 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] disabled:opacity-50 leading-relaxed max-h-40 sm:max-h-48 min-h-[44px]"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Envoyer"
            className="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[var(--accent-orange)] text-[var(--bg-primary)] disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
          >
            {streaming ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
