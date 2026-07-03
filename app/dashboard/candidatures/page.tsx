"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, MotionConfig, type Variants } from "framer-motion";
import { AlertTriangle, Inbox, RefreshCw, Search, SearchX, X } from "lucide-react";
import { useApiKey } from "@/lib/contexts/AuthContext";
import { useDashboardData } from "@/lib/hooks/useDashboardData";
import { PipelineFilters } from "@/components/dashboard/candidatures/PipelineFilters";
import { CandidatureRow } from "@/components/dashboard/candidatures/CandidatureRow";
import { PIPELINE_ORDER, SECTION_LABEL, STATUS_CSS_VAR } from "@/components/dashboard/candidatures/status";
import { EmptyState } from "@/components/ui/EmptyState";
import { LetterModal } from "@/components/dashboard/LetterModal";
import { GenerateLetterModal } from "@/components/dashboard/GenerateLetterModal";
import { RelanceComposer } from "@/components/dashboard/relances/RelanceComposer";
import type { ICandidature, CandidatureStatut } from "@/models/Candidature";

type SortKey = "activity" | "created" | "company";
type ModalKind = "letter" | "generate" | "followup" | null;

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "activity", label: "Activité récente" },
  { key: "created", label: "Ajout récent" },
  { key: "company", label: "Entreprise A→Z" },
];

function compare(a: ICandidature, b: ICandidature, key: SortKey): number {
  switch (key) {
    case "activity":
      return new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime();
    case "created":
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    case "company":
      return a.entreprise.localeCompare(b.entreprise, "fr");
  }
}

// Stagger léger : perceptible sans ralentir la lecture des longues listes.
const listContainer: Variants = {
  animate: { transition: { staggerChildren: 0.03 } },
};
const listItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

export default function CandidaturesPage() {
  const apiKey = useApiKey();
  const data = useDashboardData(apiKey);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<CandidatureStatut | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("activity");
  const [selected, setSelected] = useState<ICandidature | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  const reload = () => {
    setLoading(true);
    data.load().finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = () => {
    setModal(null);
    setSelected(null);
  };

  const openModal = (kind: Exclude<ModalKind, null>) => (c: ICandidature) => {
    setSelected(c);
    setModal(kind);
  };

  // Version fraîche de la candidature sélectionnée : après un load() déclenché par une
  // mutation dans un modal, l'objet capturé au clic est périmé (timeline vide juste après
  // envoi, etc.) — on repasse toujours la version courante du store aux modals.
  const current = useMemo(
    () =>
      selected
        ? data.candidatures.find((c) => String(c._id) === String(selected._id)) ?? selected
        : null,
    [selected, data.candidatures]
  );

  // Identité stable : RelanceComposer reset ses champs sur changement de `mode` — un objet
  // inline recréé à chaque render effacerait le brouillon en cours de frappe.
  const composerMode = useMemo(
    () => (current ? { kind: "create" as const, candidature: current } : null),
    [current]
  );

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = data.candidatures;
    if (q) {
      list = list.filter((c) =>
        [c.entreprise, c.poste, c.localisation, c.email, c.notes, c.plateforme]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    if (filterStatus) list = list.filter((c) => c.statut === filterStatus);
    return [...list].sort((a, b) => compare(a, b, sortKey));
  }, [data.candidatures, searchQuery, filterStatus, sortKey]);

  // Toujours groupé par étape du pipeline (une seule section quand un filtre est actif).
  const sections = useMemo(
    () =>
      PIPELINE_ORDER.map((status) => ({
        status,
        items: visible.filter((c) => c.statut === status),
      })).filter((s) => s.items.length > 0),
    [visible]
  );

  const isSearching = searchQuery.trim().length > 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* En-tête — même langage que le War Room */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--accent-orange)]">
              Pipeline{!loading && ` · ${data.total} candidature${data.total > 1 ? "s" : ""}`}
            </p>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Mes candidatures</h1>
          </div>
          <Link
            href="/dashboard/recherche"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-orange)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90"
          >
            <Search size={14} /> Trouver des offres
          </Link>
        </header>

        {/* Filtres pipeline */}
        <PipelineFilters
          stats={data.stats}
          total={data.total}
          active={filterStatus}
          onChange={setFilterStatus}
        />

        {/* Recherche + tri */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1 sm:max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher (entreprise, poste, ville…)"
              aria-label="Rechercher une candidature"
              className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] py-2 pl-9 pr-9 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] transition-colors focus:border-[var(--accent-orange)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Trier les candidatures"
            className="cursor-pointer rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors focus:border-[var(--accent-orange)] focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>

          {isSearching && (
            <span className="text-sm tabular-nums text-[var(--text-tertiary)]">
              {visible.length} résultat{visible.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Liste groupée par étape */}
        {loading ? (
          <div className="space-y-2" role="status" aria-label="Chargement des candidatures">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[62px] animate-pulse rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)]"
              />
            ))}
          </div>
        ) : data.loadError && data.candidatures.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Impossible de charger le pipeline"
            description={`Le chargement a échoué (${data.loadError}). Vérifie la connexion au serveur puis réessaie.`}
            action={
              <button
                onClick={reload}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent-orange)]"
              >
                <RefreshCw size={14} /> Réessayer
              </button>
            }
          />
        ) : data.candidatures.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Aucune candidature pour l'instant"
            description="Lance une recherche d'offres pour alimenter ton pipeline, ou laisse l'auto-apply prospecter pour toi."
            action={
              <Link
                href="/dashboard/recherche"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-orange)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90"
              >
                <Search size={14} /> Lancer une recherche
              </Link>
            }
          />
        ) : sections.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Aucun résultat"
            description={
              isSearching
                ? `Aucune candidature ne correspond à « ${searchQuery.trim()} »${filterStatus ? " dans ce statut" : ""}.`
                : "Aucune candidature dans ce statut pour l'instant."
            }
          />
        ) : (
          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.status} aria-label={SECTION_LABEL[section.status]}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: STATUS_CSS_VAR[section.status] }}
                  />
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    {SECTION_LABEL[section.status]}
                  </h2>
                  <span className="text-xs tabular-nums text-[var(--text-tertiary)]">
                    {section.items.length}
                  </span>
                </div>
                <motion.div
                  className="space-y-2"
                  variants={listContainer}
                  initial="initial"
                  animate="animate"
                >
                  {section.items.map((c) => (
                    <motion.div key={String(c._id)} variants={listItem}>
                      <CandidatureRow
                        candidature={c}
                        onGenerateLetter={openModal("generate")}
                        onOpenLetter={openModal("letter")}
                        onFollowUp={openModal("followup")}
                        onDelete={data.remove}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </section>
            ))}
          </div>
        )}

        {current && (
          <>
            <GenerateLetterModal
              candidature={current}
              isOpen={modal === "generate"}
              onClose={closeModal}
              apiKey={apiKey}
              onSend={data.sendCandidature}
              onUpdate={data.update}
            />
            <RelanceComposer
              open={modal === "followup"}
              mode={composerMode}
              apiKey={apiKey}
              onClose={closeModal}
              onSaved={data.load}
            />
            <LetterModal
              candidature={current}
              isOpen={modal === "letter"}
              onClose={closeModal}
              apiKey={apiKey}
              onUpdate={data.update}
              onRequestGenerate={() => setModal("generate")}
            />
          </>
        )}
      </div>
    </MotionConfig>
  );
}
