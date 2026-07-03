"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
  Radar,
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
    autoReplyEnabled: boolean;
    autoReplyMinConfidence: number;
    telegramApprovalEnabled: boolean;
    lastSyncAt?: string | null;
    lastSyncSummary?: string | null;
  };
  automation: {
    autoRelanceJ7Enabled: boolean;
    autoRelanceDays: number;
    autoApplyEnabled: boolean;
    autoApplyMaxPerDay: number;
    autoApplyMinCompanyScore: number;
    weeklyProspectKeywords: string;
    weeklyProspectLocation: string;
    lastProspectRunAt?: string | null;
    lastProspectSummary?: string | null;
    defaultLetterInstruction: string;
    enableOfferSearch: boolean;
    enablePendingProcess: boolean;
    strictQualityScore: boolean;
    allowGenericEmails: boolean;
    defaultCandidatureType: "stage" | "alternance" | "cdi";
    lastOfferSearchRunAt?: string | null;
    lastOfferSearchSummary?: string | null;
    lastPendingProcessRunAt?: string | null;
    lastPendingProcessSummary?: string | null;
  };
  letterTemplate: {
    stage: string;
    alternance: string;
    cdi: string;
  };
  profile: {
    availability: string;
  };
  _defaults?: {
    letterTemplate: { stage: string; alternance: string; cdi: string };
    letterTemplatePlaceholder: string;
  };
}

type LetterType = "stage" | "alternance" | "cdi";

interface ProspectDecision {
  url: string;
  domain: string;
  entreprise: string;
  companyScore?: number;
  companyReason?: string;
  bestOffer?: { title: string; url: string; score: number; reason: string; jobType?: string };
  email?: { email: string; score: number; reasons: string[] };
  decision: "skipped" | "applied" | "would_apply";
  skipReason?: string;
  candidatureId?: string;
  error?: string;
}

interface ProspectResult {
  ok: boolean;
  dryRun: boolean;
  scanned: number;
  applied: number;
  wouldApply: number;
  skipped: number;
  errors: string[];
  decisions: ProspectDecision[];
}

interface SyncResult {
  ok: boolean;
  scanned: number;
  matched: number;
  archived: number;
  autoReplied: number;
  autoReplySkipped: number;
  errors: string[];
  matchedDetails: Array<{
    candidatureId: string;
    entreprise: string;
    from: string;
    subject: string;
    autoReply?: { category: string; confidence: number; sent: boolean; error?: string };
  }>;
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
  const [prospecting, setProspecting] = useState(false);
  const [lastProspect, setLastProspect] = useState<ProspectResult | null>(null);
  const [processingPending, setProcessingPending] = useState(false);
  const [templateDrafts, setTemplateDrafts] = useState<{ stage: string; alternance: string; cdi: string }>({
    stage: "",
    alternance: "",
    cdi: "",
  });
  const [savingTemplate, setSavingTemplate] = useState<LetterType | null>(null);

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
      const defaults = sData?._defaults?.letterTemplate;
      const tpl = sData?.letterTemplate ?? {};
      setTemplateDrafts({
        stage: tpl.stage || defaults?.stage || "",
        alternance: tpl.alternance || defaults?.alternance || "",
        cdi: tpl.cdi || defaults?.cdi || "",
      });
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

  const toggleGmail = (key: "inboxSyncEnabled" | "autoArchiveResponses" | "autoReplyEnabled" | "telegramApprovalEnabled") => {
    if (!settings) return;
    updateSettings({ gmail: { ...settings.gmail, [key]: !settings.gmail[key] } });
  };

  const setAutoReplyMinConfidence = (value: number) => {
    if (!settings) return;
    const clamped = Math.max(0, Math.min(1, value));
    updateSettings({ gmail: { ...settings.gmail, autoReplyMinConfidence: clamped } });
  };

  const toggleAutoApply = () => {
    if (!settings) return;
    updateSettings({
      automation: { ...settings.automation, autoApplyEnabled: !settings.automation.autoApplyEnabled },
    });
  };

  const saveLetterTemplate = async (type: LetterType) => {
    if (!settings) return;
    const value = templateDrafts[type];
    const placeholder = settings._defaults?.letterTemplatePlaceholder ?? "{{paragraphe_genere}}";
    if (value.trim() && !value.includes(placeholder)) {
      toast.error(`Le template doit contenir le placeholder ${placeholder}`);
      return;
    }
    setSavingTemplate(type);
    try {
      await updateSettings({
        letterTemplate: { ...settings.letterTemplate, [type]: value },
      });
      toast.success(`Modèle ${type} enregistré`);
    } finally {
      setSavingTemplate(null);
    }
  };

  const resetLetterTemplate = (type: LetterType) => {
    if (!settings?._defaults?.letterTemplate) return;
    setTemplateDrafts((prev) => ({ ...prev, [type]: settings._defaults!.letterTemplate[type] }));
    toast.info("Modèle réinitialisé (clique Enregistrer pour appliquer)");
  };

  const updateAutoApplyField = <K extends keyof AppSettings["automation"]>(key: K, value: AppSettings["automation"][K]) => {
    if (!settings) return;
    updateSettings({ automation: { ...settings.automation, [key]: value } });
  };

  const updateProfileField = <K extends keyof AppSettings["profile"]>(key: K, value: AppSettings["profile"][K]) => {
    if (!settings) return;
    updateSettings({ profile: { ...settings.profile, [key]: value } });
  };

  const handleProspectNow = async (dryRun = true) => {
    setProspecting(true);
    try {
      const res = await fetch(`/api/auto-apply/run${dryRun ? "?dryRun=1&max=5" : "?max=5"}`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Échec");
      }
      const data: ProspectResult = await res.json();
      setLastProspect(data);
      load();
      const total = data.applied + data.wouldApply;
      if (total > 0) {
        toast.success(`${data.applied} envoyée(s), ${data.wouldApply} dry-run${dryRun ? "" : ""}`);
      } else {
        toast.info(`Aucune candidature ${dryRun ? "(dry-run)" : ""} — ${data.skipped} skippée(s)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setProspecting(false);
    }
  };

  const handleProcessPendingNow = async (force: boolean, dryRun: boolean) => {
    setProcessingPending(true);
    try {
      const res = await fetch(`/api/pending/process`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ force, dryRun }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Échec");
      }
      const data: { processed: number; applied: number; skipped: number; errors: string[] } = await res.json();
      load();
      if (data.applied > 0) {
        toast.success(`${data.applied} envoyée(s) · ${data.skipped} skip · ${data.errors.length} erreur(s)`);
      } else {
        toast.info(`${data.processed} traité(s) · ${data.skipped} skip${dryRun ? " (dry-run)" : ""}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setProcessingPending(false);
    }
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
          <Toggle
            label="Auto-réponse IA (Agent Cockpit)"
            description="Gemini classifie chaque réponse reçue et envoie automatiquement un message dans le thread. ⚠️ Action irréversible."
            checked={settings.gmail.autoReplyEnabled}
            onChange={() => toggleGmail("autoReplyEnabled")}
          />
          <Toggle
            label="Validation Telegram avant envoi"
            description="Chaque réponse préparée par l'IA t'est envoyée sur Telegram (boutons ✅/❌) — rien ne part sans ton accord. Nécessite TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID côté serveur."
            checked={settings.gmail.telegramApprovalEnabled}
            onChange={() => toggleGmail("telegramApprovalEnabled")}
          />
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Seuil de confiance minimum</div>
              <div className="text-xs text-[var(--text-tertiary)]">
                En dessous, l&apos;IA ne répond pas (notif seulement). 0 = répond à tout, 1 = jamais.
              </div>
            </div>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={settings.gmail.autoReplyMinConfidence}
              onChange={(e) => setAutoReplyMinConfidence(parseFloat(e.target.value))}
              className="w-20 px-2 py-1 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-right"
            />
          </div>
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
              {lastSync.autoReplied > 0 && <> · {lastSync.autoReplied} auto-réponse{lastSync.autoReplied > 1 ? "s" : ""}</>}
              {lastSync.autoReplySkipped > 0 && <> · {lastSync.autoReplySkipped} skip (confiance trop faible)</>}
            </div>
            {lastSync.matchedDetails.length > 0 && (
              <ul className="text-xs space-y-1 pl-4 list-disc text-[var(--text-secondary)]">
                {lastSync.matchedDetails.map((m, i) => (
                  <li key={i}>
                    <span className="font-semibold">{m.entreprise}</span> ← {m.from} : <em>{m.subject}</em>
                    {m.autoReply && (
                      <span className="ml-2 text-[var(--text-tertiary)]">
                        [IA: {m.autoReply.category} · conf. {m.autoReply.confidence.toFixed(2)} ·{" "}
                        {m.autoReply.sent ? <span className="text-emerald-400">envoyée</span> : m.autoReply.error ? <span className="text-[var(--accent-danger)]">échec</span> : <span>skip</span>}]
                      </span>
                    )}
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

      {/* Prospection auto hebdo */}
      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Radar size={16} className="text-[var(--accent-orange)]" />
          Prospection auto (hebdo)
        </h2>
        <p className="text-xs text-[var(--text-tertiary)]">
          L&apos;IA scrape Google une fois par semaine, lit la page « à propos » de chaque entreprise, détecte une page recrutement si elle existe,
          match les annonces avec ton profil, extrait l&apos;email RH (whitelist) et envoie la candidature.
          <strong className="text-[var(--accent-warning)]"> Action irréversible.</strong>
        </p>

        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] divide-y divide-[var(--border-soft)]">
          <Toggle
            label="Activer la prospection auto"
            description="Le cron VPS lance le pipeline une fois par semaine (lundi 9h). Désactivé = aucune candidature envoyée."
            checked={settings.automation.autoApplyEnabled}
            onChange={toggleAutoApply}
          />
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">
                Mots-clés Google <span className="opacity-70">(1 ligne = 1 query, rotation à chaque run · mixer tech + assoc + PME digital pour élargir)</span>
              </label>
              <textarea
                rows={5}
                value={settings.automation.weeklyProspectKeywords}
                onChange={(e) => updateAutoApplyField("weeklyProspectKeywords", e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm font-mono"
                placeholder={[
                  "startup tech Strasbourg",
                  "ESN Strasbourg",
                  "agence web Strasbourg",
                  "PME e-commerce Strasbourg",
                  "association numérique Alsace",
                  "industrie 4.0 Alsace",
                ].join("\n")}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Localisation</label>
              <input
                type="text"
                value={settings.automation.weeklyProspectLocation}
                onChange={(e) => updateAutoApplyField("weeklyProspectLocation", e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm"
                placeholder="Strasbourg"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Max envois / jour</label>
              <input
                type="number"
                min={0}
                max={50}
                value={settings.automation.autoApplyMaxPerDay}
                onChange={(e) => updateAutoApplyField("autoApplyMaxPerDay", parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Score qualité minimum (0–1)</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={settings.automation.autoApplyMinCompanyScore}
                onChange={(e) => updateAutoApplyField("autoApplyMinCompanyScore", parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">
                Consignes par défaut pour l&apos;IA (lettres auto)
                <span className="opacity-70"> — orientation appliquée à toutes les lettres générées par l&apos;auto-apply</span>
              </label>
              <textarea
                rows={3}
                value={settings.automation.defaultLetterInstruction}
                onChange={(e) => updateAutoApplyField("defaultLetterInstruction", e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm"
                placeholder="Ex: insiste sur l'autonomie et la capacité à livrer en solo, ne mentionne pas le fast-food sauf si l'entreprise est dans la food/retail."
                maxLength={800}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleProspectNow(true)}
            disabled={prospecting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--border-soft)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            {prospecting ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
            Test dry-run (5 entreprises)
          </button>
          <button
            onClick={() => {
              if (!confirm("⚠️ Lancer un vrai envoi de candidatures auto ? Action irréversible.")) return;
              handleProspectNow(false);
            }}
            disabled={prospecting || !settings.automation.autoApplyEnabled}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[var(--accent-warning)] text-[var(--bg-primary)] text-sm font-semibold disabled:opacity-50"
          >
            Lancer maintenant (vrai envoi)
          </button>
          <span className="text-xs text-[var(--text-tertiary)]">
            {settings.automation.lastProspectRunAt
              ? `Dernier run : ${new Date(settings.automation.lastProspectRunAt).toLocaleString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })} — ${settings.automation.lastProspectSummary}`
              : "Jamais lancé"}
          </span>
        </div>

        {lastProspect && (
          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 size={14} className="text-emerald-400" />
              {lastProspect.scanned} scannée(s) · {lastProspect.applied} envoyée(s)
              {lastProspect.wouldApply > 0 && <> · {lastProspect.wouldApply} would-apply (dry-run)</>}
              · {lastProspect.skipped} skip
              {lastProspect.dryRun && <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">DRY-RUN</span>}
            </div>
            {lastProspect.decisions.length > 0 && (
              <ul className="text-xs space-y-2">
                {lastProspect.decisions.map((d, i) => (
                  <li key={i} className="border-l-2 pl-2" style={{ borderColor: d.decision === "applied" ? "var(--accent-orange)" : d.decision === "would_apply" ? "var(--accent-info)" : "var(--border-soft)" }}>
                    <div className="font-semibold text-[var(--text-primary)]">
                      {d.entreprise || d.domain}
                      <span className="ml-2 text-[var(--text-tertiary)] font-normal">[{d.decision}]</span>
                    </div>
                    {d.companyScore !== undefined && (
                      <div className="text-[var(--text-secondary)]">
                        Score qualité : {d.companyScore.toFixed(2)} — {d.companyReason}
                      </div>
                    )}
                    {d.bestOffer && (
                      <div className="text-[var(--text-secondary)]">
                        Offre matchée : <em>{d.bestOffer.title}</em> ({d.bestOffer.score.toFixed(2)}, {d.bestOffer.jobType ?? "?"}) — {d.bestOffer.reason}
                      </div>
                    )}
                    {d.email && (
                      <div className="text-[var(--text-secondary)]">
                        Email choisi : <code className="text-[var(--accent-info)]">{d.email.email}</code> (score {d.email.score.toFixed(2)}, {d.email.reasons.join(", ")})
                      </div>
                    )}
                    {d.skipReason && <div className="text-[var(--text-tertiary)]">Skip : {d.skipReason}</div>}
                    {d.error && <div className="text-[var(--accent-danger)]">Erreur : {d.error}</div>}
                  </li>
                ))}
              </ul>
            )}
            {lastProspect.errors.length > 0 && (
              <div className="text-xs text-[var(--accent-danger)]">
                <AlertTriangle size={12} className="inline mr-1" />
                {lastProspect.errors.length} erreur(s) : {lastProspect.errors.slice(0, 2).join(" · ")}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Auto-apply — F2 (recherche d'offres) + F3 (process pending) */}
      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Radar size={16} className="text-[var(--accent-orange)]" />
          Auto-apply (F2 offres / F3 pending)
        </h2>
        <p className="text-xs text-[var(--text-tertiary)]">
          Active les deux flux automatiques supplémentaires. <strong>F2</strong> : recherche d&apos;offres sur les SavedQueries puis envoi auto.{" "}
          <strong>F3</strong> : reprend les candidatures statut « identifiée » et tente l&apos;envoi auto (résolution SerpAPI du site officiel, scrape, lettre, envoi).
          Les deux respectent le rate-limit Gmail partagé.
        </p>

        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] divide-y divide-[var(--border-soft)]">
          <Toggle
            label="Activer F2 — Recherche d'offres + auto-apply"
            description="Cron hebdo (lundi 9h05) sur les SavedQueries. Désactivé par défaut."
            checked={settings.automation.enableOfferSearch}
            onChange={() => updateAutoApplyField("enableOfferSearch", !settings.automation.enableOfferSearch)}
          />
          <Toggle
            label="Activer F3 — Process pending"
            description="Cron quotidien sur les candidatures 'identifiée'. Désactivé par défaut."
            checked={settings.automation.enablePendingProcess}
            onChange={() => updateAutoApplyField("enablePendingProcess", !settings.automation.enablePendingProcess)}
          />
          <Toggle
            label="Score qualité strict"
            description="Si activé, re-score Gemini sur chaque candidature avant envoi (F2/F3). Recommandé."
            checked={settings.automation.strictQualityScore}
            onChange={() => updateAutoApplyField("strictQualityScore", !settings.automation.strictQualityScore)}
          />
          <Toggle
            label="Autoriser les emails génériques"
            description="Fallback contact@/hello@/info@ si pickBestContactEmail strict refuse. Le blacklist (noreply@, abuse@) reste actif."
            checked={settings.automation.allowGenericEmails}
            onChange={() => updateAutoApplyField("allowGenericEmails", !settings.automation.allowGenericEmails)}
          />
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Max envois / jour (cap Gmail)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={settings.automation.autoApplyMaxPerDay}
                onChange={(e) => updateAutoApplyField("autoApplyMaxPerDay", Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)))}
                className="w-full px-2 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm"
              />
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Plage 1–30. Cap warmup recommandé : 15.</p>
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Type de candidature par défaut</label>
              <select
                value={settings.automation.defaultCandidatureType}
                onChange={(e) => updateAutoApplyField("defaultCandidatureType", e.target.value as "stage" | "alternance" | "cdi")}
                className="w-full px-2 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm"
              >
                <option value="stage">Stage</option>
                <option value="alternance">Alternance</option>
                <option value="cdi">CDI</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[var(--text-tertiary)]">
          <div className="rounded border border-[var(--border-soft)] p-3">
            <div className="font-medium text-[var(--text-secondary)] mb-1">F2 — Dernier run offres</div>
            {settings.automation.lastOfferSearchRunAt
              ? <>
                  {new Date(settings.automation.lastOfferSearchRunAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  <div className="mt-1">{settings.automation.lastOfferSearchSummary}</div>
                </>
              : <span>Jamais lancé</span>}
          </div>
          <div className="rounded border border-[var(--border-soft)] p-3">
            <div className="font-medium text-[var(--text-secondary)] mb-1">F3 — Dernier run pending</div>
            {settings.automation.lastPendingProcessRunAt
              ? <>
                  {new Date(settings.automation.lastPendingProcessRunAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  <div className="mt-1">{settings.automation.lastPendingProcessSummary}</div>
                </>
              : <span>Jamais lancé</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleProcessPendingNow(false, true)}
            disabled={processingPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--border-soft)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            {processingPending ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
            Test dry-run pending
          </button>
          <button
            onClick={() => {
              if (!confirm("Traiter toutes les candidatures « identifiée » et envoyer les mails ? Action irréversible.")) return;
              handleProcessPendingNow(true, false);
            }}
            disabled={processingPending || !settings.automation.autoApplyEnabled}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[var(--accent-warning)] text-[var(--bg-primary)] text-sm font-semibold disabled:opacity-50"
          >
            Traiter maintenant (force=true)
          </button>
          <Link
            href="/dashboard/recherche"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--border-soft)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            Gérer les SavedQueries (F2)
          </Link>
        </div>
      </section>

      {/* Mes dispos pour les auto-replies */}
      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Mail size={16} className="text-[var(--accent-info)]" />
          Mes dispos (pour l&apos;auto-reply IA)
        </h2>
        <p className="text-xs text-[var(--text-tertiary)]">
          Quand un RH demande un créneau pour échanger, l&apos;IA reprend ce texte EXACTEMENT (mot pour mot).
          Tu peux mettre plusieurs lignes, des commentaires, des préférences format/durée — l&apos;IA suit ce que tu écris.
        </p>
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-3">
          <div>
            <label className="text-xs text-[var(--text-tertiary)] block mb-1">
              Dispos détaillées (texte libre, multi-lignes)
            </label>
            <textarea
              value={settings.profile?.availability ?? ""}
              onChange={(e) => updateProfileField("availability", e.target.value)}
              rows={6}
              placeholder={`Ex :\nMardi 11h-13h ou jeudi 14h-17h en visio (Meet/Zoom).\nFlexible le soir après 18h si besoin.\nPour un call rapide : 15 min suffisent, dis-moi juste l'heure.`}
              className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm font-mono leading-relaxed resize-y min-h-[120px]"
            />
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
              Vide → l&apos;IA dira que tu reviendras confirmer un créneau.
            </p>
          </div>
          <div className="pt-2 border-t border-[var(--border-soft)] text-xs text-[var(--text-secondary)] flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">Calendly auto-synchronisé</span> depuis la section{" "}
              <Link href="/dashboard/cv" className="text-[var(--accent-info)] hover:underline">
                /dashboard/cv → Contact
              </Link>
              . Si le lien y est renseigné, l&apos;IA le proposera EN PLUS des créneaux ci-dessus.
            </div>
          </div>
        </div>
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
      {settings && (
        <section className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText size={16} className="text-[var(--accent-orange)]" />
            Modèles de lettre de motivation
          </h2>
          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-4">
            <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
              Trois modèles éditables — un par type de contrat. L&apos;IA génère uniquement le
              paragraphe placé à l&apos;endroit du placeholder{" "}
              <code className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--accent-orange)] text-[11px]">
                {settings._defaults?.letterTemplatePlaceholder ?? "{{paragraphe_genere}}"}
              </code>
              . Tout le reste est utilisé tel quel.
            </p>
            {(["stage", "alternance", "cdi"] as const).map((type) => {
              const placeholder = settings._defaults?.letterTemplatePlaceholder ?? "{{paragraphe_genere}}";
              const current = templateDrafts[type];
              const persisted = settings.letterTemplate?.[type] ?? "";
              const isCustom = persisted.trim().length > 0;
              const hasPlaceholder = current.includes(placeholder);
              const dirty = current !== (persisted || settings._defaults?.letterTemplate[type] || "");
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold capitalize">{type}</span>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isCustom
                            ? "bg-[var(--accent-orange)]/15 text-[var(--accent-orange)]"
                            : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"
                        }`}
                      >
                        {isCustom ? "Personnalisé" : "Par défaut"}
                      </span>
                      {!hasPlaceholder && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent-danger)]/15 text-[var(--accent-danger)]">
                          Placeholder manquant
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isCustom && (
                        <button
                          onClick={() => resetLetterTemplate(type)}
                          className="text-xs px-3 py-1 rounded border border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          Réinitialiser
                        </button>
                      )}
                      <button
                        onClick={() => saveLetterTemplate(type)}
                        disabled={!dirty || savingTemplate === type || !hasPlaceholder}
                        className="text-xs px-3 py-1 rounded bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-1"
                      >
                        {savingTemplate === type ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                        Enregistrer
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={current}
                    onChange={(e) => setTemplateDrafts((prev) => ({ ...prev, [type]: e.target.value }))}
                    rows={10}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm text-[var(--text-primary)] font-mono leading-relaxed focus:outline-none focus:border-[var(--accent-orange)] transition-colors resize-y"
                    spellCheck
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <KeyRound size={16} className="text-[var(--accent-blue)]" />
          Configuration serveur
        </h2>
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-2 text-sm">
          <ConfigRow name="API_SECRET" detail="Auth dashboard" />
          <ConfigRow name="ANTHROPIC_API_KEY" detail="Génération de lettres (Claude)" />
          <ConfigRow name="GEMINI_API_KEY" detail="Chat dashboard + amélioration de lettres (Google AI Studio)" />
          <ConfigRow name="MONGO_URI" detail="Base MongoDB" />
          <ConfigRow name="GMAIL_USER + GMAIL_APP_PASSWORD" detail="Envoi emails + sync IMAP réponses" />
          <ConfigRow name="CRON_SECRET" detail="Schedulers (relances + inbox)" />
          <ConfigRow name="CHAT_MODEL" detail="Override modèle Gemini (défaut gemini-2.5-flash)" />
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
