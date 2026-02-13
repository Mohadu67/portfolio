"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CandidatureCard } from "./CandidatureCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Inbox, MapPin, Filter, X } from "lucide-react";
import { staggerContainer, staggerItem } from "@/lib/animations";
import type { ICandidature, CandidatureStatut } from "@/models/Candidature";

interface CandidatureListProps {
  candidatures: ICandidature[];
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onGenerateLetter?: (candidature: ICandidature) => void;
  onFollowUp?: (candidature: ICandidature) => void;
  onUpdate?: (id: string, updates: Partial<ICandidature>) => Promise<void>;
  apiKey: string;
}

export function CandidatureList({
  candidatures,
  onSelect,
  onDelete,
  onGenerateLetter,
  onFollowUp,
  onUpdate,
  apiKey,
}: CandidatureListProps) {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<CandidatureStatut | null>(null);

  // Get unique locations and statuses
  const locations = Array.from(new Set(candidatures.map((c) => c.localisation))).sort();
  const statuses = Array.from(new Set(candidatures.map((c) => c.statut))) as CandidatureStatut[];

  // Filter candidatures
  const filteredCandidatures = candidatures.filter((cand) => {
    const locationMatch = !selectedLocation || cand.localisation === selectedLocation;
    const statusMatch = !selectedStatus || cand.statut === selectedStatus;
    return locationMatch && statusMatch;
  });

  if (candidatures.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Aucune candidature"
        description="Lancez une recherche d'offres pour voir les résultats ici. Vous pourrez ensuite générer des lettres de motivation et suivre vos candidatures."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <motion.div
        className="card p-4 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Filter size={18} className="text-[var(--accent-orange)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">Filtres</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Location filter */}
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-2 flex items-center gap-1">
              <MapPin size={14} />
              Localisation
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedLocation && (
                <motion.button
                  onClick={() => setSelectedLocation(null)}
                  className="px-3 py-1.5 text-xs rounded-full bg-[var(--accent-orange)] text-[var(--bg-primary)] font-medium flex items-center gap-1 hover:opacity-90 transition-opacity"
                  whileHover={{ scale: 1.05 }}
                >
                  {selectedLocation}
                  <X size={12} />
                </motion.button>
              )}
              {locations.map((location) => (
                <motion.button
                  key={location}
                  onClick={() => setSelectedLocation(location === selectedLocation ? null : location)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                    location === selectedLocation
                      ? "bg-[var(--accent-orange)] border-[var(--accent-orange)] text-[var(--bg-primary)]"
                      : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-orange)]"
                  }`}
                  whileHover={{ scale: 1.05 }}
                >
                  {location}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Statut</p>
            <div className="flex flex-wrap gap-2">
              {selectedStatus && (
                <motion.button
                  onClick={() => setSelectedStatus(null)}
                  className="px-3 py-1.5 text-xs rounded-full bg-[var(--accent-blue)] text-white font-medium flex items-center gap-1 hover:opacity-90 transition-opacity"
                  whileHover={{ scale: 1.05 }}
                >
                  {selectedStatus}
                  <X size={12} />
                </motion.button>
              )}
              {statuses.map((status) => (
                <motion.button
                  key={status}
                  onClick={() => setSelectedStatus(status === selectedStatus ? null : status)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all capitalize ${
                    status === selectedStatus
                      ? "bg-[var(--accent-blue)] border-[var(--accent-blue)] text-white"
                      : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-blue)]"
                  }`}
                  whileHover={{ scale: 1.05 }}
                >
                  {status}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="text-xs text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-color)]">
          {filteredCandidatures.length} / {candidatures.length} résultats
        </div>
      </motion.div>

      {/* Candidatures grid */}
      {filteredCandidatures.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aucun résultat"
          description="Aucune candidature ne correspond aux filtres sélectionnés."
        />
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {filteredCandidatures.map((cand) => (
            <motion.div key={cand._id?.toString()} variants={staggerItem}>
              <CandidatureCard
                candidature={cand}
                onSelect={onSelect}
                onDelete={onDelete}
                onGenerateLetter={onGenerateLetter}
                onFollowUp={onFollowUp}
                apiKey={apiKey}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
