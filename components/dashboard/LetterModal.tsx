"use client";

import { useState } from "react";
import type { ICandidature, CandidatureStatut, IAutoReply, IEmailReceived, IEmailLog } from "@/models/Candidature";

// Statuts "après envoi" → on affiche les échanges en priorité, pas la lettre.
const POST_SEND_STATUTS: CandidatureStatut[] = ["postulée", "réponse reçue", "entretien", "refus", "acceptée"];

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

interface LetterModalProps {
  candidature: ICandidature;
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onUpdate?: (id: string, updates: Partial<ICandidature>) => Promise<void>;
  onRequestGenerate?: () => void;
}

export function LetterModal({
  candidature,
  isOpen,
  onClose,
  apiKey,
  onUpdate,
  onRequestGenerate,
}: LetterModalProps) {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const letter = candidature.lettre || "";
  const [email, setEmail] = useState(candidature.email || "");
  const [notes, setNotes] = useState(candidature.notes || "");
  const [status, setStatus] = useState<CandidatureStatut>(candidature.statut);

  if (!isOpen) return null;

  const handleSendEmail = async () => {
    if (!email) {
      setError("Veuillez entrer l'email de l'entreprise");
      return;
    }

    setIsSending(true);
    setError("");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          candidature_id: candidature._id,
          email_destinataire: email,
        }),
      });

      if (!res.ok) {
        throw new Error("Erreur lors de l'envoi");
      }

      setSuccess("Email envoyé avec succès!");

      // Update status to "postulée"
      await onUpdate?.(candidature._id as string, {
        statut: "postulée" as CandidatureStatut,
        email,
      });
      setStatus("postulée");

      setTimeout(() => {
        setSuccess("");
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      await onUpdate?.(candidature._id as string, {
        notes,
        statut: status,
      });
      setSuccess("Modifications sauvegardées!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError("Erreur lors de la sauvegarde");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card-elevated w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">
              {candidature.poste}
            </h2>
            <p className="text-[var(--text-secondary)]">{candidature.entreprise}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            ✕
          </button>
        </div>

        {/* Status & Notes Section */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
              Statut
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CandidatureStatut)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]"
            >
              <option value="identifiée">📌 Identifiée</option>
              <option value="lettre générée">📝 Lettre générée</option>
              <option value="postulée">✉️ Postulée</option>
              <option value="réponse reçue">📬 Réponse reçue</option>
              <option value="entretien">💬 Entretien</option>
              <option value="refus">❌ Refus</option>
              <option value="acceptée">✅ Acceptée</option>
            </select>
          </div>

          <div>
            <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
              Notes personnelles
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ajoutez vos notes personnelles..."
              className="w-full h-24 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] resize-none"
            />
          </div>

          <button
            onClick={handleSaveNotes}
            className="w-full btn-blue text-sm"
          >
            Sauvegarder les modifications
          </button>
        </div>

        {/* Post-send : timeline des échanges en priorité */}
        {POST_SEND_STATUTS.includes(status) ? (
          <ExchangeTimeline candidature={candidature} letter={letter} />
        ) : (
          /* Pre-send : layout original (lettre + envoi) */
          <div className="mb-6 border-t border-[var(--border-color)] pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                Lettre de motivation
              </h3>
              {!letter && onRequestGenerate && (
                <button onClick={onRequestGenerate} className="btn-orange text-sm">
                  Générer une lettre
                </button>
              )}
            </div>

            {letter ? (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded p-4 mb-4 max-h-64 overflow-y-auto">
                <p className="text-[var(--text-secondary)] whitespace-pre-wrap text-sm leading-relaxed">
                  {letter}
                </p>
              </div>
            ) : (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded p-8 text-center text-[var(--text-tertiary)]">
                Aucune lettre générée. Clique sur « Générer une lettre » pour choisir le type (stage / alternance / CDI) et lancer la génération.
              </div>
            )}

            {letter && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
                    Email de l&apos;entreprise
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@entreprise.com"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)]"
                  />
                </div>
                <button
                  onClick={handleSendEmail}
                  disabled={isSending || !email}
                  className="w-full btn-orange disabled:opacity-50"
                >
                  {isSending ? "Envoi en cours..." : "✉️ Envoyer la candidature"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded p-3 mb-4 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/20 border border-green-500/50 rounded p-3 mb-4 text-green-400 text-sm">
            {success}
          </div>
        )}
      </div>
    </div>
  );
}

// Timeline des échanges : envois, réponses RH, auto-replies IA — triés chrono.
// S'affiche quand la candidature est dans un statut "post-envoi" (réponse reçue, entretien, etc.).
function ExchangeTimeline({ candidature, letter }: { candidature: ICandidature; letter: string }) {
  const events = buildTimeline(candidature);

  if (events.length === 0) {
    return (
      <div className="mb-6 border-t border-[var(--border-color)] pt-6">
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
    <div className="mb-6 border-t border-[var(--border-color)] pt-6">
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
