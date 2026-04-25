"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Settings as SettingsIcon,
  FileText,
  KeyRound,
  Save,
  Plus,
  Trash2,
  Pencil,
  X,
  Mail,
  Bell,
  RefreshCw,
  Inbox,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useApiKey } from "@/lib/contexts/AuthContext";

interface Template {
  _id: string;
  name: string;
  message: string;
  defaultOffsetDays?: number;
  isBuiltin?: boolean;
}

interface AppSettings {
  notifications: {
    onCandidatureSent: boolean;
    onRelanceSent: boolean;
    onInboxResponse: boolean;
  };
  gmail: {
    inboxSyncEnabled: boolean;
    autoArchiveResponses: boolean;
    lastSyncAt?: string | null;
    lastSyncSummary?: string | null;
  };
}

interface SyncResult {
  ok: boolean;
  scanned: number;
  matched: number;
  archived: number;
  errors: string[];
  matchedDetails: Array<{ candidatureId: string; entreprise: string; from: string; subject: string }>;
}

export default function SettingsPage() {
  const apiKey = useApiKey();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        fetch("/api/relance-templates", { headers: { "x-api-key": apiKey } }),
        fetch("/api/settings", { headers: { "x-api-key": apiKey } }),
      ]);
      if (!tRes.ok) throw new Error("Échec templates");
      if (!sRes.ok) throw new Error("Échec settings");
      const [tData, sData] = await Promise.all([tRes.json(), sRes.json()]);
      setTemplates(tData.templates ?? []);
      setSettings(sData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  const updateSettings = async (patch: Partial<AppSettings>) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Échec");
      const updated = await res.json();
      setSettings(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const toggleNotif = (key: keyof AppSettings["notifications"]) => {
    if (!settings) return;
    updateSettings({
      notifications: { ...settings.notifications, [key]: !settings.notifications[key] },
    });
  };

  const toggleGmail = (key: "inboxSyncEnabled" | "autoArchiveResponses") => {
    if (!settings) return;
    updateSettings({ gmail: { ...settings.gmail, [key]: !settings.gmail[key] } });
  };

  const handleSyncNow = async (dryRun = false) => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/inbox/sync${dryRun ? "?dryRun=1" : ""}`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Échec");
      }
      const data = await res.json();
      setLastSync(data);
      load();
      if (data.matched > 0) {
        toast.success(`${data.matched} réponse${data.matched > 1 ? "s" : ""} matchée${data.matched > 1 ? "s" : ""}${dryRun ? " (dry-run)" : ""}`);
      } else {
        toast.info(`Aucune nouvelle réponse${dryRun ? " (dry-run)" : ""}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveTemplate = async (t: Template, isNew: boolean) => {
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

  const handleDeleteTemplate = async (t: Template) => {
    if (!confirm(`Supprimer "${t.name}" ?`)) return;
    try {
      const res = await fetch(`/api/relance-templates/${t._id}`, { method: "DELETE", headers: { "x-api-key": apiKey } });
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

  if (loading || !settings) {
    return <p className="text-center text-[var(--text-secondary)] py-12">Chargement…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Notifications */}
      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Bell size={16} className="text-[var(--accent-warning)]" />
          Notifications
        </h2>
        <p className="text-xs text-[var(--text-tertiary)]">
          Tu reçois un email à <code className="text-[var(--accent-info)]">{process.env.NEXT_PUBLIC_GMAIL_USER ?? "ton Gmail"}</code> à chaque événement coché.
        </p>
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] divide-y divide-[var(--border-soft)]">
          <Toggle
            label="Candidature envoyée"
            description="Quand tu envoies une nouvelle candidature"
            checked={settings.notifications.onCandidatureSent}
            onChange={() => toggleNotif("onCandidatureSent")}
          />
          <Toggle
            label="Relance envoyée"
            description="À chaque relance envoyée (manuelle ou cron)"
            checked={settings.notifications.onRelanceSent}
            onChange={() => toggleNotif("onRelanceSent")}
          />
          <Toggle
            label="Réponse reçue"
            description="Quand le sync Gmail détecte une réponse à une candidature"
            checked={settings.notifications.onInboxResponse}
            onChange={() => toggleNotif("onInboxResponse")}
          />
        </div>
      </section>

      {/* Gmail Inbox Sync */}
      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Inbox size={16} className="text-[var(--accent-info)]" />
          Sync Gmail (réponses entrantes)
        </h2>
        <p className="text-xs text-[var(--text-tertiary)]">
          Connecte ta boîte de réception via IMAP (utilise <code>GMAIL_APP_PASSWORD</code>). Les emails non lus envoyés par tes contacts de candidature sont matchés et leur statut passe à <em>réponse reçue</em>.
        </p>

        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] divide-y divide-[var(--border-soft)]">
          <Toggle
            label="Activer le sync Gmail"
            description="Le cron VPS scanne ta boîte de réception toutes les 30 min"
            checked={settings.gmail.inboxSyncEnabled}
            onChange={() => toggleGmail("inboxSyncEnabled")}
          />
          <Toggle
            label="Archiver automatiquement les réponses détectées"
            description="Déplace les emails matchés vers un label « Cockpit/Réponses candidatures » (sortis de la inbox)"
            checked={settings.gmail.autoArchiveResponses}
            onChange={() => toggleGmail("autoArchiveResponses")}
          />
        </div>

        {/* Sync controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleSyncNow(false)}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] text-sm font-semibold disabled:opacity-50"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Synchroniser maintenant
          </button>
          <button
            onClick={() => handleSyncNow(true)}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--border-soft)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            Test (dry-run)
          </button>
          <span className="text-xs text-[var(--text-tertiary)]">
            {settings.gmail.lastSyncAt
              ? `Dernier sync : ${new Date(settings.gmail.lastSyncAt).toLocaleString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })} — ${settings.gmail.lastSyncSummary}`
              : "Jamais synchronisé"}
          </span>
        </div>

        {lastSync && (
          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 size={14} className="text-emerald-400" />
              {lastSync.scanned} non lus scannés · {lastSync.matched} matché{lastSync.matched > 1 ? "s" : ""} · {lastSync.archived} archivé{lastSync.archived > 1 ? "s" : ""}
            </div>
            {lastSync.matchedDetails.length > 0 && (
              <ul className="text-xs space-y-1 pl-4 list-disc text-[var(--text-secondary)]">
                {lastSync.matchedDetails.map((m, i) => (
                  <li key={i}>
                    <span className="font-semibold">{m.entreprise}</span> ← {m.from} : <em>{m.subject}</em>
                  </li>
                ))}
              </ul>
            )}
            {lastSync.errors.length > 0 && (
              <div className="text-xs text-[var(--accent-danger)]">
                <AlertTriangle size={12} className="inline mr-1" />
                {lastSync.errors.length} erreur(s) : {lastSync.errors.slice(0, 2).join(" · ")}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Templates */}
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
          Variables : <code className="text-[var(--accent-info)]">{"{entreprise}"}</code>,{" "}
          <code className="text-[var(--accent-info)]">{"{poste}"}</code>,{" "}
          <code className="text-[var(--accent-info)]">{"{type}"}</code>,{" "}
          <code className="text-[var(--accent-info)]">{"{prenom}"}</code>.
        </p>

        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t._id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{t.name}</span>
                    {t.isBuiltin && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">BUILTIN</span>
                    )}
                    <span className="text-xs text-[var(--text-tertiary)]">J+{t.defaultOffsetDays ?? 7}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditing(t)} className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--accent-info)]">
                    <Pencil size={14} />
                  </button>
                  {!t.isBuiltin && (
                    <button onClick={() => handleDeleteTemplate(t)} className="p-1.5 rounded hover:bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <details>
                <summary className="text-xs text-[var(--text-tertiary)] cursor-pointer">Voir le message</summary>
                <pre className="text-xs whitespace-pre-wrap mt-2 p-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] font-sans">{t.message}</pre>
              </details>
            </div>
          ))}
        </div>
      </section>

      {/* Config */}
      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <KeyRound size={16} className="text-[var(--accent-blue)]" />
          Configuration serveur
        </h2>
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-2 text-sm">
          <ConfigRow name="API_SECRET" detail="Auth dashboard" />
          <ConfigRow name="ANTHROPIC_API_KEY" detail="Chat IA" />
          <ConfigRow name="GROK_API_KEY" detail="Amélioration de lettres" />
          <ConfigRow name="MONGO_URI" detail="Base MongoDB" />
          <ConfigRow name="GMAIL_USER + GMAIL_APP_PASSWORD" detail="Envoi emails + sync IMAP réponses" />
          <ConfigRow name="CRON_SECRET" detail="Schedulers (relances + inbox)" />
          <ConfigRow name="CHAT_MODEL" detail="Override modèle Claude (défaut Opus 4.5)" />
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">
          Crontab à configurer côté VPS pour que les schedulers tournent (cf. routes /api/cron/run-relances et /api/cron/check-inbox).
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
          onSave={(t) => handleSaveTemplate(t, creating)}
        />
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-hover)] transition-colors text-left"
    >
      <div>
        <p className="font-medium text-[var(--text-primary)]">{label}</p>
        {description && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</p>}
      </div>
      <span
        className={`inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-[var(--accent-orange)]" : "bg-[var(--bg-secondary)]"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
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
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Offset par défaut (jours)</label>
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
