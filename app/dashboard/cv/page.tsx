"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Database, Eye } from "lucide-react";
import { toast } from "sonner";
import type { ICVSection } from "@/models/CVSection";
import { useApiKey } from "@/lib/contexts/AuthContext";
import { CVSectionList } from "@/components/dashboard/cv/CVSectionList";
import { CVSectionEditor } from "@/components/dashboard/cv/CVSectionEditor";
import { AddCustomSectionModal } from "@/components/dashboard/cv/AddCustomSectionModal";

export default function CVDashboard() {
  const apiKey = useApiKey();
  const [sections, setSections] = useState<ICVSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cv-sections");
      if (!res.ok) throw new Error("Échec du chargement");
      const data = await res.json();
      setSections(data.sections ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSeed = async () => {
    if (!confirm("Initialiser la collection à partir de portfolio.json ? Ne fonctionne que si la base est vide.")) return;
    try {
      const res = await fetch("/api/cv-sections/seed", { method: "POST", headers: { "x-api-key": apiKey } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      toast.success(`${data.inserted} sections insérées`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleReorder = async (order: Array<{ id: string; order: number }>) => {
    setSections((prev) =>
      [...prev]
        .map((s) => {
          const found = order.find((o) => o.id === String(s._id));
          return found ? { ...s, order: found.order } : s;
        })
        .sort((a, b) => a.order - b.order)
    );
    try {
      const res = await fetch("/api/cv-sections/reorder", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error("Échec du réordonnancement");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      load();
    }
  };

  const handleToggle = async (id: string, next: boolean) => {
    setSections((prev) => prev.map((s) => (String(s._id) === id ? { ...s, isVisible: next } : s)));
    try {
      const res = await fetch(`/api/cv-sections/${id}`, {
        method: "PATCH",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ isVisible: next }),
      });
      if (!res.ok) throw new Error("Échec de la mise à jour");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      load();
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/cv-sections/${id}`, { method: "DELETE", headers: { "x-api-key": apiKey } });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur");
      }
      toast.success("Section supprimée");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const editingSection = sections.find((s) => String(s._id) === editingId) ?? null;
  const isEmpty = !loading && sections.length === 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-[var(--text-tertiary)]">
          Glisser pour réordonner · Clic œil pour masquer · Clic crayon pour éditer
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-[var(--border-soft)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Eye size={14} /> Portfolio
          </Link>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] text-sm font-semibold"
          >
            <Plus size={14} /> Ajouter une section
          </button>
        </div>
      </div>

      {loading && <p className="text-center text-[var(--text-secondary)] py-12">Chargement…</p>}

      {isEmpty && (
        <div className="rounded-2xl border-2 border-dashed border-[var(--border-color)] p-10 text-center">
          <Database size={32} className="mx-auto text-[var(--text-tertiary)] mb-4" />
          <h2 className="text-lg font-bold mb-2">La base est vide</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
            Initialise tes sections à partir de <code>data/portfolio.json</code>. Tu pourras tout éditer ensuite.
          </p>
          <button
            onClick={handleSeed}
            className="px-5 py-2 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold"
          >
            Initialiser depuis portfolio.json
          </button>
        </div>
      )}

      {!loading && sections.length > 0 && (
        <CVSectionList
          sections={sections.map((s) => ({
            _id: String(s._id),
            key: s.key,
            type: s.type,
            title: s.title,
            order: s.order,
            isVisible: s.isVisible,
          }))}
          onReorder={handleReorder}
          onEdit={(id) => setEditingId(id)}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      )}

      {editingSection && (
        <CVSectionEditor
          section={editingSection}
          apiKey={apiKey}
          onClose={() => setEditingId(null)}
          onSaved={load}
        />
      )}

      {showAdd && (
        <AddCustomSectionModal apiKey={apiKey} onClose={() => setShowAdd(false)} onCreated={load} />
      )}
    </div>
  );
}
