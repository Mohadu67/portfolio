"use client";

import { MarkdownContent } from "./MarkdownContent";
import type { Message } from "./types";

interface MessageListProps {
  messages: Message[];
  streaming: boolean;
}

// Liste des messages — style Claude.ai :
// - user : card subtile alignée à droite, max-width
// - assistant : full-width, pas de bubble, juste du texte rendu en markdown
// - séparation visuelle via spacing généreux
// - les messages "vides" porteurs uniquement de tool_calls sont masqués
//   (la card de confirmation parle d'elle-même juste après)
export function MessageList({ messages, streaming }: MessageListProps) {
  const lastIndex = messages.length - 1;

  return (
    <div className="space-y-8 sm:space-y-10">
      {messages.map((m, i) => {
        // Messages "user" porteurs de tool_results : invisibles (system-level)
        if (m.role === "user" && m.tool_results) return null;

        const isLastAssistant = i === lastIndex && m.role === "assistant";
        const hasContent = Boolean(m.content);
        const hasToolCalls = Boolean(m.tool_calls && m.tool_calls.length > 0);

        // Assistant sans contenu mais avec tool_calls :
        // on masque, la card de confirmation prend le relais.
        if (m.role === "assistant" && !hasContent && hasToolCalls) {
          return null;
        }

        // Assistant message vide hors streaming (cas dégénéré) : skip
        if (m.role === "assistant" && !hasContent && !(isLastAssistant && streaming)) {
          return null;
        }

        if (m.role === "user") {
          // User message visible
          return (
            <div key={i} className="flex justify-end">
              <div className="max-w-[88%] sm:max-w-[80%] rounded-2xl bg-[var(--bg-card)] border border-[var(--border-soft)] px-4 py-2.5 text-[15px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {m.content}
              </div>
            </div>
          );
        }

        // Assistant : full-width, pas de bubble, markdown
        const showStreamingDot = isLastAssistant && streaming;
        return (
          <div key={i} className="w-full">
            {hasContent ? <MarkdownContent content={m.content} /> : null}
            {showStreamingDot && <StreamingDot />}
          </div>
        );
      })}
    </div>
  );
}

// Curseur de streaming discret : un petit point qui pulse.
function StreamingDot() {
  return (
    <span
      aria-label="Génération en cours"
      className="inline-block w-2 h-2 ml-1 align-middle rounded-full bg-[var(--text-secondary)] animate-pulse"
    />
  );
}
