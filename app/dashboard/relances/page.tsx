"use client";

import { useEffect, useState, useCallback } from "react";
import { Calendar, CheckCircle2, XCircle, Clock, AlertTriangle, Ban } from "lucide-react";
import { toast } from "sonner";
import type { ICandidature, IRelanceLog, RelanceStatus } from "@/models/Candidature";
import { useApiKey } from "@/lib/contexts/AuthContext";

type Filter = "all" | RelanceStatus;

interface FlatRelance {
  candidatureId: string;
  candidatureIndex: number;
  entreprise: string;
  poste: string;
  email: string;
  log: IRelanceLog;
  index: number;
}

function statusMeta(status: RelanceStatus) {
  switch (status) {
    case "programmée":
      return { label: "Programmée", color: "text-amber-500", bg: "bg-amber-500/10", Icon: Clock };
    case "envoyée":
      return { label: "Envoyée", color: "text-emerald-500", bg: "bg-emerald-500/10", Icon: CheckCircle2 };
    case "annulée":
      return { label: "Annulée", color: "text-[var(--text-tertiary)]", bg: "bg-[var(--bg-secondary)]", Icon: Ban };
    case "échouée":
      return { label: "Échouée", color: "text-red-500", bg: "bg-red-500/10", Icon: XCircle };
  }
}

export default function RelancesDashboard() {
  const apiKey = useApiKey();
  const [candidatures, setCandidatures] = useState<ICandidature[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("programmée");

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

  const flat: FlatRelance[] = candidatures.flatMap((c, ci) =>
    (c.relanceHistory ?? []).map((log, index) => ({
      candidatureId: String(c._id),
      candidatureIndex: ci,
      entreprise: c.entreprise,
      poste: c.poste,
      email: c.email ?? "",
      log,
      index,
    }))
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

  const handleSendNow = async (candidatureId: string, log: IRelanceLog) => {
    if (!confirm("Envoyer cette relance maintenant ?")) return;
    try {
      const res = await fetch("/api/send-relance", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          candidature_id: candidatureId,
          message: log.message,
          templateTitle: log.templateTitle ?? "Relance",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Échec");
      }
      toast.success("Relance envoyée");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: "programmée", label: "Programmées", count: counts.programmée ?? 0 },
    { key: "envoyée", label: "Envoyées", count: counts.envoyée ?? 0 },
    { key: "échouée", label: "Échouées", count: counts.échouée ?? 0 },
    { key: "annulée", label: "Annulées", count: counts.annulée ?? 0 },
    { key: "all", label: "Toutes", count: flat.length },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <p className="text-sm text-[var(--text-secondary)]">
        Vue centralisée des relances. Refonte complète avec calendrier, composer libre et drag-and-drop arrive au Lot&nbsp;1.
      </p>

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
            {f.label} <span className="opacity-70">({f.count})</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-[var(--text-secondary)] py-12">Chargement…</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-[var(--border-color)] p-10 text-center">
          <Calendar size={32} className="mx-auto text-[var(--text-tertiary)] mb-4" />
          <p className="text-[var(--text-secondary)]">Aucune relance dans cette catégorie.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((r) => {
          const meta = statusMeta(r.log.status);
          const due = r.log.status === "programmée" && new Date(r.log.scheduledFor).getTime() <= Date.now();
          return (
            <div key={`${r.candidatureId}-${r.index}`} className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.bg} ${meta.color}`}>
                      <meta.Icon size={12} />
                      {meta.label}
                    </span>
                    {due && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-500">
                        <AlertTriangle size={12} /> En retard
                      </span>
                    )}
                    <span className="text-xs text-[var(--text-tertiary)]">{r.log.templateTitle ?? "Relance"}</span>
                  </div>
                  <h3 className="font-semibold truncate">
                    {r.entreprise} — {r.poste}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    <Calendar size={12} className="inline mr-1" />
                    {new Date(r.log.scheduledFor).toLocaleString("fr-FR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {r.log.sentAt && (
                      <span className="ml-2 text-emerald-500">
                        · envoyée le {new Date(r.log.sentAt).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </p>
                  {r.log.error && <p className="text-xs text-red-500 mt-2">⚠ {r.log.error}</p>}
                  <details className="mt-2">
                    <summary className="text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
                      Voir le message
                    </summary>
                    <pre className="text-xs whitespace-pre-wrap bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded p-3 mt-2 max-h-48 overflow-y-auto">
                      {r.log.message}
                    </pre>
                  </details>
                </div>

                {r.log.status === "programmée" && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleSendNow(r.candidatureId, r.log)}
                      className="px-3 py-1.5 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] text-xs font-semibold"
                    >
                      Envoyer maintenant
                    </button>
                    <button
                      onClick={() => handleCancel(r.candidatureId, r.index)}
                      className="px-3 py-1.5 rounded-md border border-[var(--border-soft)] text-[var(--text-secondary)] text-xs hover:bg-[var(--bg-hover)]"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
