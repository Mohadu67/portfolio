"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings as SettingsIcon, FileText, KeyRound, Save, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useApiKey } from "@/lib/contexts/AuthContext";

interface Template {
  _id: string;
  name: string;
  message: string;
  defaultOffsetDays?: number;
  isBuiltin?: boolean;
}

export default function SettingsPage() {
  const apiKey = useApiKey();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/relance-templates", { headers: { "x-api-key": apiKey } });
      if (!res.ok) throw new Error("Échec");
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (t: Template, isNew: boolean) => {
    try {
      const url = isNew ? "/api/relance-templates" : `/api/relance-templates/${t._id}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ name: t.name, message: t.message, defaultOffsetDays: t.defaultOffsetDays }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Échec");
      }
      toast.success(isNew ? "Template créé" : "Template mis à jour");
      setEditing(null);
      setCreating(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleDelete = async (t: Template) => {
    if (!confirm(`Supprimer "${t.name}" ?`)) return;
    try {
      const res = await fetch(`/api/relance-templates/${t._id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Échec");
      }
      toast.success("Supprimé");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <p className="text-sm text-[var(--text-secondary)]">
        Configure tes templates de relance, vérifie ta config et personnalise le comportement.
      </p>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText size={16} className="text-[var(--accent-orange)]" />
            Templates de relance
          </h2>
          <button
            onClick={() => {
              setCreating(true);
              setEditing({ _id: "new", name: "", message: "", defaultOffsetDays: 7 });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] text-sm font-semibold"
          >
            <Plus size={14} /> Nouveau
          </button>
        </div>

        <p className="text-xs text-[var(--text-tertiary)]">
          Les templates sont insérables en 1 clic depuis le composer de relance. Variables disponibles :{" "}
          <code className="text-[var(--accent-info)]">{"{entreprise}"}</code>,{" "}
          <code className="text-[var(--accent-info)]">{"{poste}"}</code>,{" "}
          <code className="text-[var(--accent-info)]">{"{type}"}</code>,{" "}
          <code className="text-[var(--accent-info)]">{"{prenom}"}</code>.
        </p>

        {loading && <p className="text-sm text-[var(--text-tertiary)]">Chargement…</p>}

        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t._id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{t.name}</span>
                    {t.isBuiltin && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">
                        BUILTIN
                      </span>
                    )}
                    <span className="text-xs text-[var(--text-tertiary)]">
                      Offset par défaut : J+{t.defaultOffsetDays ?? 7}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditing(t)}
                    className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--accent-info)]"
                  >
                    <Pencil size={14} />
                  </button>
                  {!t.isBuiltin && (
                    <button
                      onClick={() => handleDelete(t)}
                      className="p-1.5 rounded hover:bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <details>
                <summary className="text-xs text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-primary)]">
                  Voir le message
                </summary>
                <pre className="text-xs whitespace-pre-wrap mt-2 p-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] font-sans">
                  {t.message}
                </pre>
              </details>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <KeyRound size={16} className="text-[var(--accent-blue)]" />
          Configuration
        </h2>
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-3">
          <ConfigRow name="API_SECRET" detail="Clé d'authentification du dashboard" />
          <ConfigRow name="ANTHROPIC_API_KEY" detail="Chat IA — Claude Opus 4.5" />
          <ConfigRow name="GROK_API_KEY" detail="Amélioration des lettres de motivation" />
          <ConfigRow name="MONGO_URI" detail="Base de données" />
          <ConfigRow name="GMAIL_USER + APP_PASSWORD" detail="Envoi d'emails de candidature" />
          <ConfigRow name="CRON_SECRET" detail="Scheduler des relances (cron VPS)" />
          <ConfigRow name="RAPIDAPI_KEY / ADZUNA / FRANCE_TRAVAIL" detail="Recherche d'offres" />
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">
          Ces clés sont configurées dans le fichier <code>.env</code> du serveur. Pour modifier, SSH sur le VPS.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <SettingsIcon size={16} className="text-[var(--text-secondary)]" />
          Profil portfolio
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          L&apos;édition complète du profil (nom, titre, photo, bio, etc.) se fait depuis le{" "}
          <a href="/dashboard/cv" className="text-[var(--accent-orange)] hover:underline">CV Builder</a> et{" "}
          <a href="/dashboard/media" className="text-[var(--accent-orange)] hover:underline">Médias</a>.
        </p>
      </section>

      {editing && (
        <TemplateEditor
          template={editing}
          isNew={creating}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={(t) => handleSave(t, creating)}
        />
      )}
    </div>
  );
}

function ConfigRow({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <code className="text-sm text-[var(--text-primary)]">{name}</code>
        <p className="text-xs text-[var(--text-tertiary)]">{detail}</p>
      </div>
      <span className="text-xs text-[var(--text-tertiary)]">configuré côté serveur</span>
    </div>
  );
}

function TemplateEditor({
  template,
  isNew,
  onClose,
  onSave,
}: {
  template: Template;
  isNew: boolean;
  onClose: () => void;
  onSave: (t: Template) => void;
}) {
  const [t, setT] = useState(template);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-soft)]">
          <h3 className="font-semibold">{isNew ? "Nouveau template" : "Modifier le template"}</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nom</label>
            <input
              value={t.name}
              onChange={(e) => setT({ ...t, name: e.target.value })}
              disabled={t.isBuiltin}
              className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)] disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Offset par défaut (jours)
            </label>
            <input
              type="number"
              value={t.defaultOffsetDays ?? 7}
              onChange={(e) => setT({ ...t, defaultOffsetDays: parseInt(e.target.value, 10) || 7 })}
              className="w-32 px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Message</label>
            <textarea
              value={t.message}
              onChange={(e) => setT({ ...t, message: e.target.value })}
              rows={14}
              className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)] resize-none font-mono"
            />
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Variables : <code>{"{entreprise}"}</code>, <code>{"{poste}"}</code>,{" "}
              <code>{"{type}"}</code>, <code>{"{prenom}"}</code>
            </p>
          </div>
        </div>
        <div className="border-t border-[var(--border-soft)] p-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-md text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
            Annuler
          </button>
          <button
            onClick={() => onSave(t)}
            disabled={!t.name.trim() || !t.message.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] text-sm font-semibold disabled:opacity-50"
          >
            <Save size={14} /> Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
