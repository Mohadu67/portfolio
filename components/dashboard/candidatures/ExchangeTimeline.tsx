"use client";

import type { ICandidature, IAutoReply, IEmailReceived, IEmailLog } from "@/models/Candidature";

// Timeline des échanges : envois, réponses RH, auto-replies IA — triés chrono.
// Partagée entre LetterModal (statuts post-envoi) et la page détail candidature.
// Le parent fournit le cadre (card ou séparateur) ; ce composant ne rend que le contenu.

interface TimelineEvent {
  date: Date;
  kind: "sent" | "received" | "auto-reply";
  payload: IEmailLog | IEmailReceived | IAutoReply;
}

function buildTimeline(c: ICandidature): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const e of c.emailsSent ?? []) {
    events.push({ date: new Date(e.date), kind: "sent", payload: e });
  }
  for (const e of c.emailsReceived ?? []) {
    events.push({ date: new Date(e.date), kind: "received", payload: e });
  }
  for (const a of c.autoReplies ?? []) {
    events.push({ date: new Date(a.date), kind: "auto-reply", payload: a });
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function formatDate(d: Date): string {
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ExchangeTimeline({ candidature, letter }: { candidature: ICandidature; letter: string }) {
  const events = buildTimeline(candidature);

  if (events.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">Échanges</h3>
        <p className="text-sm text-[var(--text-tertiary)] italic">
          Aucun échange enregistré pour le moment. La sync Gmail détectera les réponses entrantes.
        </p>
        {letter && (
          <details className="mt-4">
            <summary className="text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
              Voir la lettre de motivation envoyée
            </summary>
            <pre className="mt-2 text-xs whitespace-pre-wrap bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded p-3 max-h-64 overflow-y-auto font-sans leading-relaxed">
              {letter}
            </pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
        Échanges ({events.length})
      </h3>
      <div className="space-y-3">
        {events.map((ev, i) => (
          <TimelineRow key={i} event={ev} />
        ))}
      </div>

      {letter && (
        <details className="mt-6 pt-4 border-t border-[var(--border-color)]">
          <summary className="text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
            Voir la lettre de motivation initiale
          </summary>
          <pre className="mt-2 text-xs whitespace-pre-wrap bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded p-3 max-h-64 overflow-y-auto font-sans leading-relaxed">
            {letter}
          </pre>
        </details>
      )}
    </div>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  if (event.kind === "sent") {
    const e = event.payload as IEmailLog;
    return (
      <div className="rounded-lg border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/5 p-3">
        <div className="flex items-center gap-2 mb-1 text-xs">
          <span className="font-semibold text-[var(--accent-blue)]">→ Envoi {e.type === "relance" ? "relance" : "candidature"}</span>
          <span className="text-[var(--text-tertiary)]">·</span>
          <span className="text-[var(--text-tertiary)]">{formatDate(event.date)}</span>
          <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium ${
            e.status === "sent"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-red-500/15 text-red-400"
          }`}>
            {e.status === "sent" ? "✓ envoyé" : "✗ échec"}
          </span>
        </div>
        <div className="text-sm text-[var(--text-primary)] truncate">{e.subject}</div>
        <div className="text-xs text-[var(--text-tertiary)] mt-0.5">À : {e.to}</div>
        {e.error && <div className="text-xs text-red-400 mt-1">{e.error}</div>}
      </div>
    );
  }

  if (event.kind === "received") {
    const e = event.payload as IEmailReceived;
    return (
      <div className="rounded-lg border border-[var(--accent-warning)]/30 bg-[var(--accent-warning)]/5 p-3">
        <div className="flex items-center gap-2 mb-1 text-xs">
          <span className="font-semibold text-[var(--accent-warning)]">← Réponse reçue</span>
          <span className="text-[var(--text-tertiary)]">·</span>
          <span className="text-[var(--text-tertiary)]">{formatDate(event.date)}</span>
        </div>
        <div className="text-sm text-[var(--text-primary)] truncate">{e.subject}</div>
        <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
          De : {e.fromName ? `${e.fromName} <${e.from}>` : e.from}
        </div>
        {(e.bodyText || e.snippet) && (
          <details className="mt-2">
            <summary className="text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
              Lire le message
            </summary>
            <pre className="mt-2 text-xs whitespace-pre-wrap bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-3 max-h-72 overflow-y-auto font-sans leading-relaxed text-[var(--text-secondary)]">
              {e.bodyText || e.snippet}
            </pre>
          </details>
        )}
      </div>
    );
  }

  // auto-reply
  const a = event.payload as IAutoReply;
  const sentBadge = a.sent
    ? <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400">✓ envoyée</span>
    : a.approvalStatus === "pending"
      ? <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-400">⏳ attente Telegram</span>
      : a.approvalStatus === "rejected"
        ? <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400">✗ rejetée</span>
        : a.error
          ? <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400">✗ échec</span>
          : <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">skip (confiance)</span>;

  return (
    <div className="rounded-lg border border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/5 p-3">
      <div className="flex items-center gap-2 mb-1 text-xs flex-wrap">
        <span className="font-semibold text-[var(--accent-orange)]">🤖 Auto-réponse IA</span>
        <span className="text-[var(--text-tertiary)]">·</span>
        <span className="text-[var(--text-tertiary)]">{formatDate(event.date)}</span>
        <span className="text-[var(--text-tertiary)]">·</span>
        <span className="text-[var(--text-secondary)]">{a.category}</span>
        <span className="text-[var(--text-tertiary)]">conf. {a.confidence.toFixed(2)}</span>
        <span className="ml-auto">{sentBadge}</span>
      </div>
      <details>
        <summary className="text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
          Voir la réponse générée
        </summary>
        <pre className="mt-2 text-xs whitespace-pre-wrap bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-3 max-h-72 overflow-y-auto font-sans leading-relaxed text-[var(--text-primary)]">
          {a.reply}
        </pre>
      </details>
      {a.error && <div className="text-xs text-red-400 mt-1">{a.error}</div>}
    </div>
  );
}
