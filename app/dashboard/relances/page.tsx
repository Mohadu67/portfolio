"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Ban,
  Send,
  Pencil,
  Copy as CopyIcon,
  Plus,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import type { ICandidature, IRelanceLog, RelanceStatus } from "@/models/Candidature";
import { useApiKey } from "@/lib/contexts/AuthContext";
import { RelanceComposer } from "@/components/dashboard/relances/RelanceComposer";

type Filter = "all" | RelanceStatus;
type View = "timeline" | "byCandidature";

interface FlatRelance {
  candidature: ICandidature;
  log: IRelanceLog;
  index: number;
}

function statusMeta(status: RelanceStatus) {
  switch (status) {
    case "programmée":
      return { label: "Programmée", color: "text-amber-400", bg: "bg-amber-400/10", Icon: Clock };
    case "envoyée":
      return { label: "Envoyée", color: "text-emerald-400", bg: "bg-emerald-400/10", Icon: CheckCircle2 };
    case "annulée":
      return {
        label: "Annulée",
        color: "text-[var(--text-tertiary)]",
        bg: "bg-[var(--bg-secondary)]",
        Icon: Ban,
      };
    case "échouée":
      return { label: "Échouée", color: "text-red-400", bg: "bg-red-400/10", Icon: XCircle };
  }
}

export default function RelancesPage() {
  const apiKey = useApiKey();
  const [candidatures, setCandidatures] = useState<ICandidature[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("programmée");
  const [view, setView] = useState<View>("timeline");
  // Snapshot du temps au render — déterministe et partagé par toutes les RelanceCard.
  // Le re-render naturel (load des relances, changement de filtre) suffit pour rafraîchir.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<
    null | { kind: "create"; candidature: ICandidature } | { kind: "edit"; candidature: ICandidature; index: number; entry: IRelanceLog }
  >(null);

  // Picker for "Nouvelle relance" without context
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/candidatures", { headers: { "x-api-key": apiKey } });
      if (!res.ok) throw new Error("Échec du chargement");
      const data = await res.json();
      setCandidatures(data.candidatures ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  const flat: FlatRelance[] = candidatures.flatMap((c) =>
    (c.relanceHistory ?? []).map((log, index) => ({ candidature: c, log, index }))
  );

  const filtered = flat
    .filter((r) => (filter === "all" ? true : r.log.status === filter))
    .sort((a, b) => new Date(b.log.scheduledFor).getTime() - new Date(a.log.scheduledFor).getTime());

  const counts = flat.reduce(
    (acc, r) => {
      acc[r.log.status] = (acc[r.log.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<RelanceStatus, number>
  );

  const handleCancel = async (candidatureId: string, index: number) => {
    if (!confirm("Annuler cette relance programmée ?")) return;
    try {
      const res = await fetch(`/api/candidatures/${candidatureId}/relances`, {
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

  const handleDuplicate = async (candidatureId: string, index: number) => {
    try {
      const res = await fetch(`/api/candidatures/${candidatureId}/relances`, {
        method: "PATCH",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ index, action: "duplicate" }),
      });
      if (!res.ok) throw new Error("Échec");
      toast.success("Relance dupliquée (+7j)");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleSendNow = async (r: FlatRelance) => {
    if (!confirm("Envoyer cette relance maintenant ?")) return;
    try {
      const res = await fetch("/api/send-relance", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          candidature_id: r.candidature._id,
          message: r.log.message,
          templateTitle: r.log.templateTitle ?? "Relance",
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

  const openCreate = (candidature: ICandidature) => {
    setComposerMode({ kind: "create", candidature });
    setComposerOpen(true);
    setPickerOpen(false);
  };

  const openEdit = (r: FlatRelance) => {
    setComposerMode({ kind: "edit", candidature: r.candidature, index: r.index, entry: r.log });
    setComposerOpen(true);
  };

  const filters: Array<{ key: Filter; label: string; count: number; tone: string }> = [
    { key: "programmée", label: "Programmées", count: counts.programmée ?? 0, tone: "text-amber-400" },
    { key: "envoyée", label: "Envoyées", count: counts.envoyée ?? 0, tone: "text-emerald-400" },
    { key: "échouée", label: "Échouées", count: counts.échouée ?? 0, tone: "text-red-400" },
    { key: "annulée", label: "Annulées", count: counts.annulée ?? 0, tone: "text-[var(--text-tertiary)]" },
    { key: "all", label: "Toutes", count: flat.length, tone: "text-[var(--text-secondary)]" },
  ];

  // Group by candidature view
  const grouped = candidatures
    .filter((c) => (c.relanceHistory ?? []).length > 0)
    .map((c) => ({
      candidature: c,
      relances: (c.relanceHistory ?? [])
        .map((log, index) => ({ log, index }))
        .filter((r) => filter === "all" || r.log.status === filter)
        .sort((a, b) => new Date(b.log.scheduledFor).getTime() - new Date(a.log.scheduledFor).getTime()),
    }))
    .filter((g) => g.relances.length > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-[var(--accent-orange)] text-[var(--bg-primary)]"
                  : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-soft)]"
              }`}
            >
              {f.label} <span className="opacity-60">({f.count})</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border border-[var(--border-soft)] rounded-lg overflow-hidden text-sm">
            <button
              onClick={() => setView("timeline")}
              className={`px-3 py-1.5 ${view === "timeline" ? "bg-[var(--bg-active)] text-[var(--accent-orange)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}`}
            >
              Timeline
            </button>
            <button
              onClick={() => setView("byCandidature")}
              className={`px-3 py-1.5 ${view === "byCandidature" ? "bg-[var(--bg-active)] text-[var(--accent-orange)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}`}
            >
              Par candidature
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] text-sm font-semibold"
            >
              <Plus size={14} /> Nouvelle relance <ChevronDown size={14} />
            </button>
            {pickerOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-40 w-80 max-h-80 overflow-y-auto rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] shadow-xl shadow-black/40">
                  <div className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] border-b border-[var(--border-soft)]">
                    Choisir une candidature
                  </div>
                  {candidatures.length === 0 ? (
                    <p className="p-3 text-sm text-[var(--text-tertiary)]">Aucune candidature</p>
                  ) : (
                    candidatures.map((c) => (
                      <button
                        key={String(c._id)}
                        onClick={() => openCreate(c)}
                        className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] border-b border-[var(--border-soft)] last:border-b-0"
                      >
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{c.entreprise}</p>
                        <p className="text-xs text-[var(--text-tertiary)] truncate">{c.poste}</p>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {loading && <p className="text-center text-[var(--text-secondary)] py-12">Chargement…</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-[var(--border-soft)] p-10 text-center">
          <Calendar size={32} className="mx-auto text-[var(--text-tertiary)] mb-4" />
          <p className="text-[var(--text-secondary)]">Aucune relance dans cette catégorie.</p>
        </div>
      )}

      {/* Timeline view */}
      {!loading && view === "timeline" && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((r) => (
            <RelanceCard
              key={`${String(r.candidature._id)}-${r.index}`}
              relance={r}
              now={now}
              onCancel={() => handleCancel(String(r.candidature._id), r.index)}
              onDuplicate={() => handleDuplicate(String(r.candidature._id), r.index)}
              onSendNow={() => handleSendNow(r)}
              onEdit={() => openEdit(r)}
            />
          ))}
        </div>
      )}

      {/* By candidature view */}
      {!loading && view === "byCandidature" && grouped.length > 0 && (
        <div className="space-y-6">
          {grouped.map(({ candidature, relances }) => (
            <div key={String(candidature._id)} className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold text-[var(--text-primary)]">
                  {candidature.entreprise}{" "}
                  <span className="text-[var(--text-tertiary)] font-normal">— {candidature.poste}</span>
                </h3>
                <button
                  onClick={() => openCreate(candidature)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/10"
                >
                  <Plus size={12} /> Programmer
                </button>
              </div>
              <div className="space-y-2 ml-3 pl-3 border-l border-[var(--border-soft)]">
                {relances.map((r) => (
                  <RelanceCard
                    key={r.index}
                    relance={{ candidature, log: r.log, index: r.index }}
                    now={now}
                    onCancel={() => handleCancel(String(candidature._id), r.index)}
                    onDuplicate={() => handleDuplicate(String(candidature._id), r.index)}
                    onSendNow={() =>
                      handleSendNow({ candidature, log: r.log, index: r.index })
                    }
                    onEdit={() => openEdit({ candidature, log: r.log, index: r.index })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <RelanceComposer
        open={composerOpen}
        mode={composerMode}
        apiKey={apiKey}
        onClose={() => {
          setComposerOpen(false);
          setComposerMode(null);
        }}
        onSaved={load}
      />
    </div>
  );
}

interface RelanceCardProps {
  relance: FlatRelance;
  now: number;
  onCancel: () => void;
  onDuplicate: () => void;
  onSendNow: () => void;
  onEdit: () => void;
}

function RelanceCard({ relance: r, now, onCancel, onDuplicate, onSendNow, onEdit }: RelanceCardProps) {
  const meta = statusMeta(r.log.status);
  const due = r.log.status === "programmée" && new Date(r.log.scheduledFor).getTime() <= now;

  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-3.5 hover:border-[var(--accent-orange)]/40 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.bg} ${meta.color}`}
            >
              <meta.Icon size={11} />
              {meta.label}
            </span>
            {due && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]">
                <AlertTriangle size={11} /> En retard
              </span>
            )}
            <span className="text-xs text-[var(--text-tertiary)]">{r.log.templateTitle ?? "Relance"}</span>
          </div>
          <h3 className="font-semibold truncate text-sm">
            {r.candidature.entreprise} <span className="text-[var(--text-tertiary)] font-normal">— {r.candidature.poste}</span>
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            <Calendar size={11} className="inline mr-1" />
            {new Date(r.log.scheduledFor).toLocaleString("fr-FR", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {r.log.sentAt && (
              <span className="ml-2 text-emerald-400">
                · envoyée le {new Date(r.log.sentAt).toLocaleDateString("fr-FR")}
              </span>
            )}
          </p>
          {r.log.error && <p className="text-xs text-[var(--accent-danger)] mt-1">⚠ {r.log.error}</p>}
          <details className="mt-2">
            <summary className="text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
              Voir le message
            </summary>
            <pre className="text-xs whitespace-pre-wrap bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded p-3 mt-2 max-h-48 overflow-y-auto font-sans">
              {r.log.message}
            </pre>
          </details>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {r.log.status === "programmée" && (
            <>
              <button
                onClick={onSendNow}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] text-xs font-semibold"
                title="Envoyer maintenant"
              >
                <Send size={12} /> Envoyer
              </button>
              <button
                onClick={onEdit}
                className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--accent-info)]"
                title="Modifier"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={onDuplicate}
                className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                title="Dupliquer +7j"
              >
                <CopyIcon size={14} />
              </button>
              <button
                onClick={onCancel}
                className="p-1.5 rounded-md hover:bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]"
                title="Annuler"
              >
                <Ban size={14} />
              </button>
            </>
          )}
          {r.log.status === "envoyée" && (
            <button
              onClick={onDuplicate}
              className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              title="Dupliquer (créer une nouvelle relance similaire)"
            >
              <CopyIcon size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
