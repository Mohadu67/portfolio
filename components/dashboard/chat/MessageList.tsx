"use client";

import { MarkdownContent } from "./MarkdownContent";
import type { Message, ToolAction } from "./types";

interface MessageListProps {
  messages: Message[];
  streaming: boolean;
  onAction: (action: ToolAction) => void;
}

// Liste des messages — style Claude.ai :
// - user : card subtile alignée à droite, max-width
// - assistant : full-width, pas de bubble, juste du texte rendu en markdown
// - séparation visuelle via spacing généreux
// - les messages "vides" porteurs uniquement de tool_calls sont masqués
//   (la card de confirmation parle d'elle-même juste après)
export function MessageList({ messages, streaming, onAction }: MessageListProps) {
  const lastIndex = messages.length - 1;

  // Action chips : on prend les actions attachées au DERNIER tool_results de la conversation
  // (en remontant depuis la fin) et on les affiche sous le dernier message assistant non vide.
  // Les chips disparaissent automatiquement dès qu'un nouveau cycle commence (nouveau tool_results
  // sans actions = pas de chips). Ne s'affichent pas pendant le streaming.
  const latestActions = !streaming ? findLatestActions(messages) : [];

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
        const showActions = isLastAssistant && latestActions.length > 0;
        return (
          <div key={i} className="w-full">
            {hasContent ? <MarkdownContent content={m.content} /> : null}
            {showStreamingDot && <StreamingDot />}
            {showActions && (
              <div className="mt-5 flex flex-wrap gap-2">
                {latestActions.map((a) => (
                  <ActionChip key={a.id} action={a} onClick={onAction} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Trouve les actions du tool_results le plus récent dans la conversation.
// Retourne [] si le tool_results le plus récent n'a pas d'actions OU si un user/assistant message
// "normal" a été émis depuis (= l'utilisateur est passé à autre chose).
function findLatestActions(messages: Message[]): ToolAction[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" && m.tool_results) {
      // C'est le tool_results le plus récent. Concat des actions de tous les results.
      return m.tool_results.flatMap((r) => r.actions ?? []);
    }
    // Si on rencontre un user message texte avant un tool_results, l'utilisateur a
    // continué la conversation → actions périmées.
    if (m.role === "user" && m.content) return [];
  }
  return [];
}

interface ActionChipProps {
  action: ToolAction;
  onClick: (a: ToolAction) => void;
}

function ActionChip({ action, onClick }: ActionChipProps) {
  const variant = action.variant ?? "primary";
  const styles =
    variant === "primary"
      ? "bg-[var(--accent-orange)] text-[var(--bg-primary)] border-[var(--accent-orange)] hover:opacity-90"
      : variant === "danger"
        ? "bg-[var(--accent-danger)]/10 text-[var(--accent-danger)] border-[var(--accent-danger)]/40 hover:bg-[var(--accent-danger)]/20"
        : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-soft)] hover:bg-[var(--bg-hover)]";
  return (
    <button
      type="button"
      onClick={() => onClick(action)}
      className={`min-h-[40px] px-3.5 py-2 rounded-md text-sm font-medium border transition-colors ${styles}`}
    >
      {action.label}
    </button>
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
