"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Calendar, Send, Save, FileText, Eye, Trash2, Copy as CopyIcon, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { ICandidature, IRelanceLog } from "@/models/Candidature";

interface RelanceTemplate {
  _id: string;
  name: string;
  message: string;
  defaultOffsetDays?: number;
  isBuiltin?: boolean;
}

type Mode =
  | { kind: "create"; candidature: ICandidature }
  | { kind: "edit"; candidature: ICandidature; index: number; entry: IRelanceLog };

interface RelanceComposerProps {
  open: boolean;
  mode: Mode | null;
  apiKey: string;
  onClose: () => void;
  onSaved: () => void;
}

const PRESETS: Array<{ label: string; days: number }> = [
  { label: "+7 j", days: 7 },
  { label: "+14 j", days: 14 },
  { label: "+21 j", days: 21 },
  { label: "+1 mois", days: 30 },
];

function toLocalInputValue(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function applyVariables(template: string, c: ICandidature, prenom: string): string {
  return template
    .replaceAll("{entreprise}", c.entreprise ?? "")
    .replaceAll("{poste}", c.poste ?? "")
    .replaceAll("{type}", c.type ?? "stage")
    .replaceAll("{prenom}", prenom);
}

export function RelanceComposer({ open, mode, apiKey, onClose, onSaved }: RelanceComposerProps) {
  const [templates, setTemplates] = useState<RelanceTemplate[]>([]);
  const [title, setTitle] = useState("Relance");
  const [message, setMessage] = useState("");
  const [scheduledFor, setScheduledFor] = useState<string>(() =>
    toLocalInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  );
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const candidature = mode?.candidature ?? null;
  const isEdit = mode?.kind === "edit";
  const prenom = (candidature && (process.env.NEXT_PUBLIC_PROFIL_PRENOM as string)) || "Mohammed";

  // Load templates on mount + reset state on open
  useEffect(() => {
    if (!open) return;
    fetch("/api/relance-templates", { headers: { "x-api-key": apiKey } })
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setTemplates(d.templates ?? []));
  }, [open, apiKey]);

  useEffect(() => {
    if (!mode) return;
    if (mode.kind === "edit") {
      setTitle(mode.entry.templateTitle ?? "Relance");
      setMessage(mode.entry.message);
      setScheduledFor(toLocalInputValue(new Date(mode.entry.scheduledFor)));
    } else {
      setTitle("Relance");
      setMessage("");
      setScheduledFor(toLocalInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
    }
  }, [mode]);

  const previewMessage = useMemo(() => {
    if (!candidature) return message;
    return applyVariables(message, candidature, prenom);
  }, [message, candidature, prenom]);

  const insertTemplate = (t: RelanceTemplate) => {
    setMessage(t.message);
    setTitle(t.name);
    if (t.defaultOffsetDays) {
      setScheduledFor(toLocalInputValue(new Date(Date.now() + t.defaultOffsetDays * 24 * 60 * 60 * 1000)));
    }
    toast.success(`Template inséré : ${t.name}`);
  };

  const setPreset = (days: number) => {
    setScheduledFor(toLocalInputValue(new Date(Date.now() + days * 24 * 60 * 60 * 1000)));
  };

  const insertVariable = (token: string) => {
    setMessage((m) => `${m}${token}`);
  };

  const handleSubmit = async (sendNow = false) => {
    if (!candidature) return;
    if (!message.trim()) {
      toast.error("Message requis");
      return;
    }

    setSubmitting(true);
    try {
      if (sendNow) {
        const res = await fetch("/api/send-relance", {
          method: "POST",
          headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            candidature_id: candidature._id,
            message: previewMessage,
            templateTitle: title,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Échec");
        }
        toast.success("Relance envoyée");
      } else if (mode?.kind === "edit") {
        const res = await fetch(`/api/candidatures/${candidature._id}/relances`, {
          method: "PATCH",
          headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            index: mode.index,
            scheduledFor: new Date(scheduledFor).toISOString(),
            message,
            templateTitle: title,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Échec");
        }
        toast.success("Relance mise à jour");
      } else {
        const res = await fetch(`/api/candidatures/${candidature._id}/relances`, {
          method: "POST",
          headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledFor: new Date(scheduledFor).toISOString(),
            template: "custom",
            templateTitle: title,
            message,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Échec");
        }
        toast.success("Relance programmée");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />}

      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-[min(560px,100vw)] bg-[var(--bg-card)] border-l border-[var(--border-soft)] shadow-2xl shadow-black/40 transition-transform duration-200 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div
          className="flex items-center justify-between px-4 border-b border-[var(--border-soft)]"
          style={{ height: "var(--topbar-height)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Calendar size={16} className="text-[var(--accent-orange)] flex-shrink-0" />
            <h2 className="font-semibold text-[var(--text-primary)] truncate">
              {isEdit ? "Modifier la relance" : "Programmer une relance"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
          >
            <X size={16} />
          </button>
        </div>

        {candidature && (
          <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">
            <div className="rounded-lg bg-[var(--bg-secondary)] p-3 border border-[var(--border-soft)]">
              <p className="text-xs text-[var(--text-tertiary)]">Candidature</p>
              <p className="font-semibold text-[var(--text-primary)] truncate">
                {candidature.entreprise} — {candidature.poste}
              </p>
              {candidature.email ? (
                <p className="text-xs text-[var(--text-secondary)] mt-1">{candidature.email}</p>
              ) : (
                <p className="text-xs text-[var(--accent-warning)] mt-1">⚠ Aucun email destinataire</p>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Titre / sujet de la relance
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Date d&apos;envoi
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setPreset(p.days)}
                    className="px-2.5 py-1 rounded-md bg-[var(--bg-secondary)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] border border-[var(--border-soft)]"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]"
              />
            </div>

            {/* Templates 1-clic */}
            {templates.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 flex items-center gap-1">
                  <Wand2 size={12} /> Templates rapides (insertion 1-clic)
                </label>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => insertTemplate(t)}
                      className="px-2.5 py-1 rounded-md bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] text-xs font-medium border border-[var(--accent-orange)]/20 hover:bg-[var(--accent-orange)]/20"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Variables */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Variables (cliquer pour insérer)
              </label>
              <div className="flex flex-wrap gap-2">
                {["{entreprise}", "{poste}", "{type}", "{prenom}"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-2 py-0.5 rounded font-mono text-xs bg-[var(--bg-secondary)] text-[var(--accent-info)] hover:bg-[var(--bg-hover)]"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  Message
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-[var(--accent-info)] hover:underline"
                >
                  <Eye size={12} /> {showPreview ? "Éditer" : "Aperçu (variables substituées)"}
                </button>
              </div>
              {showPreview ? (
                <pre className="w-full min-h-[260px] px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] whitespace-pre-wrap font-sans">
                  {previewMessage}
                </pre>
              ) : (
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={11}
                  placeholder="Écris ton message libre, ou clique un template pour partir d'une base."
                  className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)] resize-none"
                />
              )}
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                {message.length} caractères · Variables substituées à l&apos;envoi
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-[var(--border-soft)] px-5 py-3 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-md text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            Annuler
          </button>
          <div className="flex items-center gap-2">
            {!isEdit && candidature?.email && (
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--border-soft)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
              >
                <Send size={14} /> Envoyer maintenant
              </button>
            )}
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] text-sm font-semibold disabled:opacity-50"
            >
              <Save size={14} />
              {submitting ? "..." : isEdit ? "Mettre à jour" : "Programmer"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
