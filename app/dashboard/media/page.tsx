"use client";

import Link from "next/link";
import { Image as ImageIcon, ArrowRight } from "lucide-react";

export default function MediaPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent-violet)]/20 to-[var(--accent-orange)]/20 flex items-center justify-center mx-auto mb-4">
          <ImageIcon size={22} className="text-[var(--accent-violet)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Media Manager — bientôt</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-6">
          Photo de profil portfolio, CVs PDF, images de projets — tout au même endroit.
          Drag-and-drop, scope, défaut, preview. Arrive au Lot&nbsp;3.
        </p>
        <Link
          href="/dashboard/cv-files"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold text-sm"
        >
          Mes CVs (existant) <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
