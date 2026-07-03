"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { ICandidature, IRelance } from "@/models/Candidature";

export function useDashboardData(apiKey: string) {
  const [candidatures, setCandidatures] = useState<ICandidature[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);

  const load = useCallback(async () => {
    if (!apiKey) return;
    try {
      const res = await fetch("/api/candidatures", { headers: { "x-api-key": apiKey } });
      if (!res.ok) throw new Error("Échec du chargement");
      const data = await res.json();
      setCandidatures(data.candidatures);
      setStats(data.stats);
      setTotal(data.total);
      setLoadError(null);
    } catch (err) {
      // Exposé via loadError pour que les pages distinguent « vide » de « échec de chargement ».
      console.error("[useDashboardData] load:", err);
      setLoadError(err instanceof Error ? err.message : "Erreur de chargement");
    }
  }, [apiKey]);

  const search = useCallback(
    async (keywords: string, location: string) => {
      setSearching(true);
      setSearchProgress(0);
      const tick = setInterval(() => {
        setSearchProgress((p) => (p >= 90 ? p : p + Math.random() * 30));
      }, 300);

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ keywords, location, nb_results: 10 }),
        });
        if (!res.ok) throw new Error("Erreur lors de la recherche");
        const data = await res.json();
        setSearchProgress(100);
        await new Promise((r) => setTimeout(r, 400));
        await load();
        toast.success(`${data.nouvelles} nouvelles offres trouvées`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur");
      } finally {
        clearInterval(tick);
        setSearching(false);
        setSearchProgress(0);
      }
    },
    [apiKey, load]
  );

  const sendCandidature = useCallback(
    async (candidature: ICandidature, lettre: string, email: string) => {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ candidature_id: candidature._id, email_destinataire: email, lettre }),
      });
      if (!res.ok) throw new Error("Erreur lors de l'envoi");
      await load();
    },
    [apiKey, load]
  );

  const update = useCallback(
    async (id: string, updates: Partial<ICandidature>) => {
      const res = await fetch(`/api/candidatures/${id}`, {
        method: "PATCH",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Échec de la mise à jour");
      await load();
    },
    [apiKey, load]
  );

  const remove = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/candidatures/${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) throw new Error("Échec de la suppression");
      await load();
    },
    [apiKey, load]
  );

  const scheduleFollowUp = useCallback(
    async (candidature: ICandidature, relance: IRelance) => {
      if (!candidature._id) return;
      await update(candidature._id, { relance });
    },
    [update]
  );

  const sendRelanceNow = useCallback(
    async (candidature: ICandidature, message: string, templateTitle: string) => {
      const res = await fetch("/api/send-relance", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ candidature_id: candidature._id, message, templateTitle }),
      });
      if (!res.ok) throw new Error("Erreur lors de l'envoi de la relance");
      await load();
    },
    [apiKey, load]
  );

  const cancelRelance = useCallback(
    async (candidature: ICandidature) => {
      if (!candidature._id) return;
      await update(candidature._id, { relance: null });
    },
    [update]
  );

  return {
    candidatures,
    stats,
    total,
    loadError,
    searching,
    searchProgress,
    load,
    search,
    sendCandidature,
    update,
    remove,
    scheduleFollowUp,
    sendRelanceNow,
    cancelRelance,
  };
}
