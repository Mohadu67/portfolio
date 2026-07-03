"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  Building2,
  MapPin,
  Mail,
  ExternalLink,
  Trash2,
  Plus,
  FileText,
  Save,
  AlertTriangle,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { useApiKey } from "@/lib/contexts/AuthContext";
import { RelanceComposer } from "@/components/dashboard/relances/RelanceComposer";
import { ExchangeTimeline } from "@/components/dashboard/candidatures/ExchangeTimeline";
import type { ICandidature, CandidatureStatut, RelanceStatus, IRelanceLog } from "@/models/Candidature";

const STATUS_LABELS: Record<CandidatureStatut, string> = {
  identifiée: "Identifiée",
  "lettre générée": "Lettre générée",
  postulée: "Postulée",
  "réponse reçue": "Réponse reçue",
  entretien: "Entretien",
  refus: "Refus",
  acceptée: "Acceptée",
};

const STATUS_COLORS: Record<CandidatureStatut, string> = {
  identifiée: "var(--status-identifiee)",
  "lettre générée": "var(--status-lettre)",
  postulée: "var(--status-postule)",
  "réponse reçue": "var(--status-reponse)",
  entretien: "var(--status-entretien)",
  refus: "var(--status-refus)",
  acceptée: "var(--status-acceptee)",
};

function statusMeta(status: RelanceStatus) {
  switch (status) {
    case "programmée":
      return { color: "text-amber-400", bg: "bg-amber-400/10", Icon: Clock };
    case "envoyée":
      return { color: "text-emerald-400", bg: "bg-emerald-400/10", Icon: CheckCircle2 };
    case "annulée":
      return { color: "text-[var(--text-tertiary)]", bg: "bg-[var(--bg-secondary)]", Icon: Ban };
    case "échouée":
      return { color: "text-red-400", bg: "bg-red-400/10", Icon: XCircle };
  }
}

interface Params {
  params: Promise<{ id: string }>;
}

export default function CandidatureDetailPage({ params }: Params) {
  const { id } = use(params);
  const apiKey = useApiKey();
  const [candidature, setCandidature] = useState<ICandidature | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [composerMode, setComposerMode] = useState<
    | null
    | { kind: "create"; candidature: ICandidature }
    | { kind: "edit"; candidature: ICandidature; index: number; entry: IRelanceLog }
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/candidatures", { headers: { "x-api-key": apiKey } });
      if (!res.ok) throw new Error("Échec");
      const data = await res.json();
      const c = (data.candidatures as ICandidature[]).find((x) => String(x._id) === id);
      if (!c) throw new Error("Candidature introuvable");
      setCandidature(c);
      setNotesDraft(c.notes ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [apiKey, id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = async (updates: Partial<ICandidature>) => {
    try {
      const res = await fetch(`/api/candidatures/${id}`, {
        method: "PATCH",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Échec");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    await updateField({ notes: notesDraft });
    setEditingNotes(false);
    setSavingNotes(false);
    toast.success("Notes sauvegardées");
  };

  const cancelRelance = async (index: number) => {
    if (!confirm("Annuler cette relance ?")) return;
    try {
      const res = await fetch(`/api/candidatures/${id}/relances`, {
        method: "PATCH",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ index, action: "cancel" }),
      });
      if (!res.ok) throw new Error("Échec");
      toast.success("Relance annulée");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const sendRelanceNow = async (log: IRelanceLog) => {
    if (!confirm("Envoyer cette relance maintenant ?")) return;
    try {
      const res = await fetch("/api/send-relance", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          candidature_id: id,
          message: log.message,
          templateTitle: log.templateTitle ?? "Relance",
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Échec");
      }
      toast.success("Relance envoyée");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  if (loading) return <p className="text-center text-[var(--text-secondary)] py-12">Chargement…</p>;
  if (!candidature) return null;

  const statusColor = STATUS_COLORS[candidature.statut];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link
        href="/dashboard/candidatures"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft size={14} /> Retour à la liste
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold"
                style={{ background: `${statusColor}1a`, color: statusColor }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                {STATUS_LABELS[candidature.statut]}
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                {candidature.plateforme} · {candidature.type}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1 truncate">
              <Building2 size={20} className="inline mr-2 text-[var(--accent-blue)]" />
              {candidature.entreprise}
            </h1>
            <p className="text-lg text-[var(--text-secondary)] truncate">
              <Briefcase size={16} className="inline mr-2 text-[var(--text-tertiary)]" />
              {candidature.poste}
            </p>
            <div className="flex items-center gap-4 mt-3 text-sm text-[var(--text-tertiary)] flex-wrap">
              {candidature.localisation && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} /> {candidature.localisation}
                </span>
              )}
              {candidature.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail size={14} /> {candidature.email}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar size={14} />{" "}
                {new Date(candidature.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              {candidature.url && (
                <a
                  href={candidature.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 text-[var(--accent-info)] hover:underline"
                >
                  <ExternalLink size={14} /> Annonce
                </a>
              )}
            </div>
          </div>

          {/* Status switcher */}
          <select
            value={candidature.statut}
            onChange={(e) => updateField({ statut: e.target.value as CandidatureStatut })}
            className="bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]"
          >
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: échanges + lettres + emails */}
        <div className="lg:col-span-2 space-y-6">
          {/* Échanges : envois, réponses RH, auto-réponses IA (validation Telegram incluse) */}
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
            <ExchangeTimeline candidature={candidature} letter={candidature.lettre ?? ""} />
          </section>

          {/* Lettre actuelle */}
          {candidature.lettre && (
            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <FileText size={16} className="text-[var(--accent-orange)]" />
                Lettre de motivation
              </h2>
              <pre className="text-sm whitespace-pre-wrap bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md p-4 max-h-96 overflow-y-auto font-sans leading-relaxed">
                {candidature.lettre}
              </pre>
              {candidature.letters && candidature.letters.length > 1 && (
                <details className="mt-3">
                  <summary className="text-xs text-[var(--text-secondary)] cursor-pointer">
                    {candidature.letters.length} versions de lettre
                  </summary>
                  <div className="mt-2 space-y-2">
                    {candidature.letters.map((l, i) => (
                      <div key={i} className="rounded-md border border-[var(--border-soft)] p-3">
                        <p className="text-xs text-[var(--text-tertiary)] mb-2">
                          v{l.version} · {l.model} ·{" "}
                          {new Date(l.generatedAt).toLocaleDateString("fr-FR")}
                        </p>
                        <pre className="text-xs whitespace-pre-wrap font-sans">{l.content}</pre>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

          {/* Description */}
          {candidature.description && (
            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
              <h2 className="font-semibold mb-2">Description de l&apos;offre</h2>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                {candidature.description}
              </p>
            </section>
          )}

          {/* Notes */}
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Notes</h2>
              {!editingNotes ? (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-xs text-[var(--accent-info)] hover:underline"
                >
                  {candidature.notes ? "Modifier" : "Ajouter"}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingNotes(false);
                      setNotesDraft(candidature.notes ?? "");
                    }}
                    className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold disabled:opacity-50"
                  >
                    <Save size={11} /> Enregistrer
                  </button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={5}
                placeholder="Numéro du recruteur, infos de l'entretien, idées de relance…"
                className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)] resize-none"
                autoFocus
              />
            ) : (
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap min-h-[2rem]">
                {candidature.notes || (
                  <span className="text-[var(--text-tertiary)] italic">Aucune note</span>
                )}
              </p>
            )}
          </section>

          {/* Emails sent */}
          {candidature.emailsSent && candidature.emailsSent.length > 0 && (
            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <Send size={16} className="text-[var(--accent-blue)]" />
                Historique d&apos;envoi
              </h2>
              <div className="space-y-2">
                {candidature.emailsSent.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-md border border-[var(--border-soft)] p-2.5 text-sm"
                  >
                    {e.status === "sent" ? (
                      <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle size={14} className="text-red-400 flex-shrink-0" />
                    )}
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">
                      {e.type}
                    </span>
                    <span className="flex-1 truncate text-[var(--text-secondary)]">{e.subject}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {new Date(e.date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column: relances + actions */}
        <div className="space-y-6">
          {/* Quick actions */}
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
            <h2 className="font-semibold mb-3">Actions</h2>
            <button
              onClick={() => setComposerMode({ kind: "create", candidature })}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] text-sm font-semibold mb-2"
            >
              <Plus size={14} /> Programmer une relance
            </button>
            {candidature.url && (
              <a
                href={candidature.url}
                target="_blank"
                rel="noopener"
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-[var(--border-soft)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                <ExternalLink size={14} /> Voir l&apos;annonce
              </a>
            )}
          </section>

          {/* Relances */}
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-[var(--accent-warning)]" />
              Relances
            </h2>
            {!candidature.relanceHistory || candidature.relanceHistory.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">Aucune relance.</p>
            ) : (
              <div className="space-y-3">
                {candidature.relanceHistory.map((r, idx) => {
                  const meta = statusMeta(r.status);
                  const due =
                    r.status === "programmée" && new Date(r.scheduledFor).getTime() <= Date.now();
                  return (
                    <div
                      key={idx}
                      className="rounded-md border border-[var(--border-soft)] p-3 text-sm"
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.bg} ${meta.color}`}
                        >
                          <meta.Icon size={11} />
                          {r.status}
                        </span>
                        {due && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]">
                            <AlertTriangle size={11} /> En retard
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mb-2">
                        {r.templateTitle ?? "Relance"} ·{" "}
                        {new Date(r.scheduledFor).toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {r.error && (
                        <p className="text-xs text-[var(--accent-danger)] mb-2">⚠ {r.error}</p>
                      )}
                      <details>
                        <summary className="text-xs text-[var(--text-tertiary)] cursor-pointer">
                          Message
                        </summary>
                        <pre className="text-xs whitespace-pre-wrap mt-2 p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-soft)] font-sans max-h-32 overflow-y-auto">
                          {r.message}
                        </pre>
                      </details>
                      {r.status === "programmée" && (
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => sendRelanceNow(r)}
                            className="text-xs px-2 py-1 rounded bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold"
                          >
                            Envoyer
                          </button>
                          <button
                            onClick={() =>
                              setComposerMode({
                                kind: "edit",
                                candidature,
                                index: idx,
                                entry: r,
                              })
                            }
                            className="text-xs px-2 py-1 rounded border border-[var(--border-soft)] text-[var(--text-secondary)]"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => cancelRelance(idx)}
                            className="text-xs px-2 py-1 rounded text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10"
                          >
                            <Ban size={11} className="inline" /> Annuler
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <RelanceComposer
        open={composerMode !== null}
        mode={composerMode}
        apiKey={apiKey}
        onClose={() => setComposerMode(null)}
        onSaved={load}
      />
    </div>
  );
}
