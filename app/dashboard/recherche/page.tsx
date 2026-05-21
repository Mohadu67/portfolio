"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  Building2,
  Loader2,
  Plus,
  Check,
  X,
  BookmarkPlus,
  ExternalLink,
  RotateCcw,
  Download,
  AlertCircle,
  MapPin,
  Briefcase,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";
import { useApiKey } from "@/lib/contexts/AuthContext";
import { GenerateLetterModal } from "@/components/dashboard/GenerateLetterModal";
import type { ICandidature } from "@/models/Candidature";

// ─── Types ───────────────────────────────────────────────

interface OffreResult {
  entreprise: string;
  poste: string;
  localisation: string;
  description: string;
  url: string;
  plateforme: "JSearch" | "Adzuna" | "France Travail" | "Indeed";
  already_saved: boolean;
  candidature?: ICandidature;
}

interface CompanyResult {
  name: string;
  url: string;
  snippet: string;
  displayUrl: string;
}

interface SavedCompany {
  _id: string;
  url: string;
  companyName: string;
  type: string;
}

type QueryFrequency = "manual" | "daily" | "weekly" | "biweekly";

interface SavedQuery {
  _id: string;
  keywords: string;
  location: string;
  frequency: QueryFrequency;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunNewCount: number;
}

const FREQUENCY_LABEL: Record<QueryFrequency, string> = {
  manual: "Manuelle",
  daily: "Quotidienne",
  weekly: "Hebdomadaire",
  biweekly: "Bi-hebdo",
};

type Platform = OffreResult["plateforme"];

const PLATFORM_STYLES: Record<Platform, { bg: string; text: string; label: string }> = {
  JSearch:          { bg: "bg-[var(--accent-blue)]/15",    text: "text-[var(--accent-blue)]",    label: "JSearch" },
  Adzuna:           { bg: "bg-[var(--accent-orange)]/15",  text: "text-[var(--accent-orange)]",  label: "Adzuna" },
  "France Travail": { bg: "bg-[var(--accent-violet)]/15",  text: "text-[var(--accent-violet)]",  label: "France Travail" },
  Indeed:           { bg: "bg-[var(--accent-success)]/15", text: "text-[var(--accent-success)]", label: "Indeed" },
};

// ─── Composants locaux ───────────────────────────────────

function PlatformBadge({ platform }: { platform: Platform }) {
  const s = PLATFORM_STYLES[platform];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────

export default function RecherchePage() {
  const apiKey = useApiKey();

  // Tabs
  const [tab, setTab] = useState<"offres" | "entreprises">("offres");

  // ── Offres state ──
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [offresLoading, setOffresLoading] = useState(false);
  const [offresError, setOffresError] = useState("");
  const [offresResults, setOffresResults] = useState<OffreResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingUrls, setAddingUrls] = useState<Set<string>>(new Set());
  const [importingAll, setImportingAll] = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);

  // ── Entreprises state ──
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [companyResults, setCompanyResults] = useState<CompanyResult[]>([]);
  const [savedCompanies, setSavedCompanies] = useState<SavedCompany[]>([]);
  const [savingUrls, setSavingUrls] = useState<Set<string>>(new Set());

  // ── Letter modal state ──
  const [letterTarget, setLetterTarget] = useState<ICandidature | null>(null);

  const keywordsRef = useRef<HTMLInputElement>(null);

  // Load saved queries from DB
  useEffect(() => {
    if (!apiKey) return;
    fetchSavedQueries();
  }, [apiKey]);

  async function fetchSavedQueries() {
    if (!apiKey) return;
    try {
      const res = await fetch("/api/saved-queries", {
        headers: { "x-api-key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setSavedQueries(data.queries ?? []);
      }
    } catch {}
  }

  // Load saved companies from DB
  useEffect(() => {
    if (tab !== "entreprises" || !apiKey) return;
    fetchSavedCompanies();
  }, [tab, apiKey]);

  async function fetchSavedCompanies() {
    if (!apiKey) return;
    try {
      const res = await fetch("/api/saved-searches", {
        headers: { "x-api-key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setSavedCompanies(data.searches ?? []);
      }
    } catch {}
  }

  // ── Offres actions ──

  async function searchOffres(e?: React.FormEvent, kwArg?: string, locArg?: string) {
    e?.preventDefault();
    const kw = (kwArg ?? keywords).trim();
    const loc = (locArg ?? location).trim();
    if (!kw || !loc) {
      setOffresError("Mots-clés et localisation requis.");
      return;
    }
    if (!apiKey) return;
    setOffresLoading(true);
    setOffresError("");
    setHasSearched(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: kw, location: loc, nb_results: 10, preview: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }
      const data = await res.json();
      setOffresResults(data.results ?? []);
    } catch (err) {
      setOffresError(err instanceof Error ? err.message : "Erreur de recherche");
      setOffresResults([]);
    } finally {
      setOffresLoading(false);
    }
  }

  async function addOffre(offre: OffreResult): Promise<ICandidature | null> {
    if (!apiKey) return null;
    setAddingUrls((prev) => new Set(prev).add(offre.url));
    try {
      const res = await fetch("/api/candidatures", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          entreprise: offre.entreprise,
          poste: offre.poste,
          plateforme: offre.plateforme,
          localisation: offre.localisation,
          url: offre.url,
          description: offre.description,
          statut: "identifiée",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) {
        throw new Error(data.error ?? "Erreur");
      }
      const candidature: ICandidature | undefined =
        res.status === 409 ? data.candidature : data;
      if (res.status !== 409) {
        toast.success(`${offre.entreprise} ajoutée`);
      }
      setOffresResults((prev) =>
        prev.map((r) =>
          r.url === offre.url ? { ...r, already_saved: true, candidature: candidature ?? r.candidature } : r
        )
      );
      return candidature ?? null;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      return null;
    } finally {
      setAddingUrls((prev) => {
        const next = new Set(prev);
        next.delete(offre.url);
        return next;
      });
    }
  }

  async function importAll() {
    const toAdd = offresResults.filter((r) => !r.already_saved);
    if (toAdd.length === 0 || !apiKey) return;
    setImportingAll(true);
    const results = await Promise.all(
      toAdd.map((offre) =>
        fetch("/api/candidatures", {
          method: "POST",
          headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            entreprise: offre.entreprise,
            poste: offre.poste,
            plateforme: offre.plateforme,
            localisation: offre.localisation,
            url: offre.url,
            description: offre.description,
            statut: "identifiée",
          }),
        })
          .then((r) => r.ok || r.status === 409)
          .catch(() => false)
      )
    );
    const added = results.filter(Boolean).length;
    setOffresResults((prev) => prev.map((r) => ({ ...r, already_saved: true })));
    toast.success(`${added} offres importées`);
    setImportingAll(false);
  }

  async function saveQuery(frequency: QueryFrequency = "manual") {
    if (!apiKey) return;
    const kw = keywords.trim();
    const loc = location.trim();
    if (!kw || !loc) return;
    try {
      const res = await fetch("/api/saved-queries", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: kw, location: loc, frequency }),
      });
      if (!res.ok) throw new Error("Erreur");
      await fetchSavedQueries();
      toast.success(
        frequency === "manual"
          ? "Recherche sauvegardée"
          : `Recherche planifiée (${FREQUENCY_LABEL[frequency].toLowerCase()})`
      );
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
  }

  async function removeQuery(id: string) {
    if (!apiKey) return;
    try {
      await fetch(`/api/saved-queries?id=${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      setSavedQueries((prev) => prev.filter((q) => q._id !== id));
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }

  async function setQueryFrequency(id: string, frequency: QueryFrequency) {
    if (!apiKey) return;
    try {
      const res = await fetch(`/api/saved-queries/${id}`, {
        method: "PATCH",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ frequency }),
      });
      if (!res.ok) throw new Error();
      await fetchSavedQueries();
      toast.success(
        frequency === "manual"
          ? "Planification désactivée"
          : `Planifié en ${FREQUENCY_LABEL[frequency].toLowerCase()}`
      );
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  }

  function rerunQuery(q: SavedQuery) {
    setKeywords(q.keywords);
    setLocation(q.location);
    searchOffres(undefined, q.keywords, q.location);
  }

  // ── Entreprises actions ──

  async function searchCompanies(e?: React.FormEvent) {
    e?.preventDefault();
    const q = companyQuery.trim();
    if (!q) {
      setCompanyError("Requête requise.");
      return;
    }
    if (!apiKey) return;
    setCompanyLoading(true);
    setCompanyError("");
    try {
      const res = await fetch("/api/search-companies", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, location: companyLocation.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }
      const data = await res.json();
      setCompanyResults(data.results ?? []);
    } catch (err) {
      setCompanyError(err instanceof Error ? err.message : "Erreur de recherche");
      setCompanyResults([]);
    } finally {
      setCompanyLoading(false);
    }
  }

  async function saveCompany(result: CompanyResult) {
    if (!apiKey) return;
    setSavingUrls((prev) => new Set(prev).add(result.url));
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url, companyName: result.name, type: "url" }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success(`${result.name} sauvegardée`);
      await fetchSavedCompanies();
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSavingUrls((prev) => {
        const next = new Set(prev);
        next.delete(result.url);
        return next;
      });
    }
  }

  async function deleteCompany(id: string) {
    if (!apiKey) return;
    try {
      await fetch(`/api/saved-searches?id=${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      setSavedCompanies((prev) => prev.filter((c) => c._id !== id));
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }

  const savedCompanyUrls = new Set(savedCompanies.map((c) => c.url));
  const newOffres = offresResults.filter((r) => !r.already_saved).length;

  // ── Letter actions ──

  async function openLetterFor(offre: OffreResult) {
    if (offre.candidature) {
      setLetterTarget(offre.candidature);
      return;
    }
    // Pas encore en mémoire → on l'ajoute d'abord puis on ouvre la modale.
    const created = await addOffre(offre);
    if (created) setLetterTarget(created);
  }

  async function updateCandidature(id: string, updates: Partial<ICandidature>) {
    if (!apiKey) return;
    const res = await fetch(`/api/candidatures/${id}`, {
      method: "PATCH",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Échec de la mise à jour");
    const updated: ICandidature = await res.json();
    setLetterTarget((prev) => (prev && prev._id === id ? { ...prev, ...updated } : prev));
    setOffresResults((prev) =>
      prev.map((r) =>
        r.candidature && r.candidature._id === id
          ? { ...r, candidature: { ...r.candidature, ...updated } }
          : r
      )
    );
  }

  async function sendCandidature(candidature: ICandidature, lettre: string, email: string) {
    if (!apiKey) return;
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ candidature_id: candidature._id, email_destinataire: email, lettre }),
    });
    if (!res.ok) throw new Error("Erreur lors de l'envoi");
  }

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Recherche unifiée</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Offres d&apos;emploi multi-sources + suivi d&apos;entreprises
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)] w-fit">
        {(["offres", "entreprises"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t
                ? "bg-[var(--accent-orange)] text-[var(--bg-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {t === "offres" ? <Briefcase size={14} /> : <Building2 size={14} />}
            {t === "offres" ? "Offres" : "Entreprises"}
            {t === "offres" && offresResults.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === "offres" ? "bg-white/25" : "bg-[var(--accent-orange)]/20 text-[var(--accent-orange)]"}`}>
                {offresResults.length}
              </span>
            )}
            {t === "entreprises" && savedCompanies.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === "entreprises" ? "bg-white/25" : "bg-[var(--accent-orange)]/20 text-[var(--accent-orange)]"}`}>
                {savedCompanies.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Onglet Offres ── */}
      {tab === "offres" && (
        <div className="space-y-5">
          {/* Search form */}
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
            <form onSubmit={searchOffres} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  ref={keywordsRef}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Mots-clés (ex: stage développeur fullstack)"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)]"
                />
              </div>
              <div className="relative sm:w-48">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ville (ex: Strasbourg)"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)]"
                />
              </div>
              <button
                type="submit"
                disabled={offresLoading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {offresLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                {offresLoading ? "Recherche…" : "Rechercher"}
              </button>
              {hasSearched && keywords.trim() && location.trim() && (
                <button
                  type="button"
                  onClick={() => saveQuery("manual")}
                  title="Sauvegarder cette recherche"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--accent-orange)] hover:border-[var(--accent-orange)]/40 transition-colors"
                >
                  <BookmarkPlus size={14} />
                </button>
              )}
            </form>

            {/* Saved queries */}
            {savedQueries.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {savedQueries.map((q) => (
                  <div
                    key={q._id}
                    className={`inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full border text-xs ${
                      q.frequency !== "manual"
                        ? "border-[var(--accent-orange)]/40 bg-[var(--accent-orange)]/10 text-[var(--accent-orange)]"
                        : "border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                    }`}
                    title={
                      q.frequency !== "manual"
                        ? `Planifiée — prochaine exécution ${q.nextRunAt ? new Date(q.nextRunAt).toLocaleString("fr-FR") : "à définir"}`
                        : "Recherche manuelle"
                    }
                  >
                    <span>{q.keywords} · {q.location}</span>
                    <select
                      value={q.frequency}
                      onChange={(e) => setQueryFrequency(q._id, e.target.value as QueryFrequency)}
                      className="bg-transparent text-[10px] uppercase tracking-wide font-semibold focus:outline-none cursor-pointer pr-1"
                      title="Fréquence d'exécution"
                    >
                      <option value="manual">Manuelle</option>
                      <option value="daily">Quotidienne</option>
                      <option value="weekly">Hebdomadaire</option>
                      <option value="biweekly">Bi-hebdo</option>
                    </select>
                    <button
                      onClick={() => rerunQuery(q)}
                      className="p-0.5 rounded-full hover:text-[var(--accent-orange)] transition-colors"
                      title="Relancer"
                    >
                      <RotateCcw size={11} />
                    </button>
                    <button
                      onClick={() => removeQuery(q._id)}
                      className="p-0.5 rounded-full hover:text-[var(--accent-danger)] transition-colors"
                      title="Supprimer"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {offresError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/30 text-sm text-[var(--accent-danger)]">
              <AlertCircle size={14} /> {offresError}
            </div>
          )}

          {/* Loading skeleton */}
          {offresLoading && (
            <div className="grid sm:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 animate-pulse">
                  <div className="h-3 w-16 bg-[var(--bg-hover)] rounded-full mb-3" />
                  <div className="h-4 w-3/4 bg-[var(--bg-hover)] rounded mb-2" />
                  <div className="h-3 w-1/2 bg-[var(--bg-hover)] rounded mb-3" />
                  <div className="h-3 w-full bg-[var(--bg-hover)] rounded mb-1" />
                  <div className="h-3 w-2/3 bg-[var(--bg-hover)] rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          {!offresLoading && hasSearched && (
            <>
              {offresResults.length === 0 ? (
                <div className="text-center py-12 text-sm text-[var(--text-tertiary)]">
                  Aucune offre trouvée. Essaie des mots-clés différents.
                </div>
              ) : (
                <>
                  {/* Toolbar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">{offresResults.length}</span> offres
                        {offresResults.filter((r) => r.already_saved).length > 0 && (
                          <span className="text-[var(--text-tertiary)]"> · {offresResults.filter((r) => r.already_saved).length} déjà enregistrées</span>
                        )}
                      </p>
                      {/* Platform breakdown */}
                      <div className="hidden sm:flex gap-1.5">
                        {(["JSearch", "Adzuna", "France Travail", "Indeed"] as const).map((p) => {
                          const count = offresResults.filter((r) => r.plateforme === p).length;
                          if (!count) return null;
                          return <PlatformBadge key={p} platform={p} />;
                        })}
                      </div>
                    </div>
                    {newOffres > 0 && (
                      <button
                        onClick={importAll}
                        disabled={importingAll}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-success)]/10 border border-[var(--accent-success)]/30 text-[var(--accent-success)] text-sm font-semibold disabled:opacity-50 hover:bg-[var(--accent-success)]/20 transition-colors"
                      >
                        {importingAll ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        Tout importer ({newOffres})
                      </button>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {offresResults.map((offre, i) => (
                      <OffreCard
                        key={i}
                        offre={offre}
                        adding={addingUrls.has(offre.url)}
                        onAdd={() => addOffre(offre)}
                        onWriteLetter={() => openLetterFor(offre)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Empty state */}
          {!offresLoading && !hasSearched && (
            <div className="text-center py-16 text-sm text-[var(--text-tertiary)]">
              Lance une recherche pour voir les offres de JSearch, Adzuna, France Travail et Indeed.
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Entreprises ── */}
      {tab === "entreprises" && (
        <div className="space-y-5">
          {/* Search form */}
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
            <form onSubmit={searchCompanies} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder="Nom ou secteur (ex: agence web Strasbourg)"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)]"
                />
              </div>
              <div className="relative sm:w-48">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  value={companyLocation}
                  onChange={(e) => setCompanyLocation(e.target.value)}
                  placeholder="Ville (optionnel)"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)]"
                />
              </div>
              <button
                type="submit"
                disabled={companyLoading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {companyLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                {companyLoading ? "Recherche…" : "Chercher"}
              </button>
            </form>
          </div>

          {/* Saved companies */}
          {savedCompanies.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-3">
                Entreprises suivies ({savedCompanies.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {savedCompanies.map((c) => (
                  <div
                    key={c._id}
                    className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--bg-primary)] text-xs text-[var(--text-secondary)]"
                  >
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--accent-orange)] transition-colors flex items-center gap-1"
                    >
                      {c.companyName} <ExternalLink size={9} />
                    </a>
                    <button
                      onClick={() => deleteCompany(c._id)}
                      className="p-0.5 rounded-full hover:text-[var(--accent-danger)] transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {companyError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/30 text-sm text-[var(--accent-danger)]">
              <AlertCircle size={14} /> {companyError}
            </div>
          )}

          {/* Results */}
          {companyLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 animate-pulse">
                  <div className="h-4 w-1/3 bg-[var(--bg-hover)] rounded mb-2" />
                  <div className="h-3 w-1/4 bg-[var(--bg-hover)] rounded mb-3" />
                  <div className="h-3 w-full bg-[var(--bg-hover)] rounded" />
                </div>
              ))}
            </div>
          )}

          {!companyLoading && companyResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">{companyResults.length}</span> résultats
              </p>
              {companyResults.map((r, i) => (
                <CompanyCard
                  key={i}
                  result={r}
                  alreadySaved={savedCompanyUrls.has(r.url)}
                  saving={savingUrls.has(r.url)}
                  onSave={() => saveCompany(r)}
                />
              ))}
            </div>
          )}

          {!companyLoading && companyResults.length === 0 && companyQuery && (
            <div className="text-center py-12 text-sm text-[var(--text-tertiary)]">
              Aucun résultat. Affine ta recherche.
            </div>
          )}

          {!companyLoading && !companyQuery && companyResults.length === 0 && savedCompanies.length === 0 && (
            <div className="text-center py-16 text-sm text-[var(--text-tertiary)]">
              Recherche des entreprises à suivre et sauvegarde celles qui t&apos;intéressent.
            </div>
          )}
        </div>
      )}

      {/* Letter modal */}
      <GenerateLetterModal
        candidature={letterTarget}
        isOpen={letterTarget !== null}
        onClose={() => setLetterTarget(null)}
        apiKey={apiKey ?? ""}
        onSend={sendCandidature}
        onUpdate={updateCandidature}
      />
    </div>
  );
}

// ─── OffreCard ────────────────────────────────────────────

function OffreCard({
  offre,
  adding,
  onAdd,
  onWriteLetter,
}: {
  offre: OffreResult;
  adding: boolean;
  onAdd: () => void;
  onWriteLetter: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border bg-[var(--bg-card)] p-4 flex flex-col gap-3 transition-colors ${
        offre.already_saved
          ? "border-[var(--accent-success)]/30 opacity-75"
          : "border-[var(--border-soft)] hover:border-[var(--accent-orange)]/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <PlatformBadge platform={offre.plateforme} />
        {offre.already_saved && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent-success)] bg-[var(--accent-success)]/10 px-2 py-0.5 rounded-full">
            <Check size={10} /> Enregistrée
          </span>
        )}
      </div>

      <div>
        <p className="font-semibold text-sm text-[var(--text-primary)] leading-tight line-clamp-2">
          {offre.poste || "Poste non précisé"}
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{offre.entreprise}</p>
        {offre.localisation && (
          <p className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 mt-0.5">
            <MapPin size={10} /> {offre.localisation}
          </p>
        )}
      </div>

      {offre.description && (
        <p className="text-xs text-[var(--text-tertiary)] line-clamp-2 leading-relaxed">
          {offre.description}
        </p>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1">
        {!offre.already_saved ? (
          <button
            onClick={onAdd}
            disabled={adding}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Ajouter
          </button>
        ) : null}
        <button
          onClick={onWriteLetter}
          disabled={adding}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent-orange)]/40 bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] text-xs font-semibold disabled:opacity-50 hover:bg-[var(--accent-orange)]/20 transition-colors"
        >
          <PenLine size={11} />
          {offre.already_saved ? "Rédiger la lettre" : "Ajouter & rédiger"}
        </button>
        {offre.url && (
          <a
            href={offre.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[var(--border-soft)] text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ExternalLink size={11} /> Offre
          </a>
        )}
      </div>
    </div>
  );
}

// ─── CompanyCard ──────────────────────────────────────────

function CompanyCard({
  result,
  alreadySaved,
  saving,
  onSave,
}: {
  result: CompanyResult;
  alreadySaved: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-[var(--text-primary)]">{result.name}</p>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-orange)] flex items-center gap-0.5 transition-colors truncate max-w-[200px]"
          >
            {result.displayUrl || result.url} <ExternalLink size={10} />
          </a>
        </div>
        {result.snippet && (
          <p className="text-xs text-[var(--text-tertiary)] mt-1 line-clamp-2 leading-relaxed">
            {result.snippet}
          </p>
        )}
      </div>
      <button
        onClick={onSave}
        disabled={alreadySaved || saving}
        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          alreadySaved
            ? "bg-[var(--accent-success)]/10 text-[var(--accent-success)] border border-[var(--accent-success)]/30 cursor-default"
            : "border border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--accent-orange)] hover:border-[var(--accent-orange)]/40 disabled:opacity-50"
        }`}
      >
        {saving ? (
          <Loader2 size={11} className="animate-spin" />
        ) : alreadySaved ? (
          <><Check size={11} /> Suivie</>
        ) : (
          <><BookmarkPlus size={11} /> Suivre</>
        )}
      </button>
    </div>
  );
}
