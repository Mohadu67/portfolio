"use client";

import { motion } from "framer-motion";
import { CandidatureCard } from "./CandidatureCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Inbox } from "lucide-react";
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
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {candidatures.map((cand) => (
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
  );
}
