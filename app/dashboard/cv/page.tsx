"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Lock, Database, Eye } from "lucide-react";
import { toast, Toaster } from "sonner";
import type { ICVSection } from "@/models/CVSection";
import { CVSectionList } from "@/components/dashboard/cv/CVSectionList";
import { CVSectionEditor } from "@/components/dashboard/cv/CVSectionEditor";
import { AddCustomSectionModal } from "@/components/dashboard/cv/AddCustomSectionModal";

export default function CVDashboard() {
  const [apiKey, setApiKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);

  const [sections, setSections] = useState<ICVSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const k = sessionStorage.getItem("api-key");
    if (k) {
      setApiKey(k);
      setAuthed(true);
    }
    setBootLoading(false);
  }, []);

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
    if (authed) load();
  }, [authed, load]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    sessionStorage.setItem("api-key", apiKey);
    setAuthed(true);
  };

  const handleSeed = async () => {
    if (!confirm("Initialiser la collection à partir de portfolio.json ? Ne fonctionne que si la base est vide.")) return;
    try {
      const res = await fetch("/api/cv-sections/seed", {
        method: "POST",
        headers: { "x-api-key": apiKey },
      });
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
      const res = await fetch(`/api/cv-sections/${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
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

  if (bootLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-secondary)]">
        Chargement…
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-[var(--accent-orange)]">
            <Lock size={20} />
            <h1 className="text-lg font-bold text-[var(--text-primary)]">Accès dashboard CV</h1>
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Clé API"
            className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
            autoFocus
          />
          <button
            type="submit"
            className="w-full py-2 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold"
          >
            Entrer
          </button>
        </form>
      </main>
    );
  }

  const editingSection = sections.find((s) => String(s._id) === editingId) ?? null;
  const isEmpty = !loading && sections.length === 0;

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Toaster richColors position="top-right" />

      <header className="border-b border-[var(--border-color)] bg-[var(--bg-card)]/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Éditeur CV</h1>
              <p className="text-xs text-[var(--text-tertiary)]">
                Glisser pour réordonner · Clic œil pour masquer · Clic crayon pour éditer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border border-[var(--border-color)] hover:bg-[var(--bg-secondary)]"
            >
              <Eye size={16} />
              Voir le portfolio
            </Link>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] text-sm font-semibold"
            >
              <Plus size={16} />
              Ajouter une section
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading && (
          <p className="text-center text-[var(--text-secondary)] py-12">Chargement…</p>
        )}

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
      </section>

      {editingSection && (
        <CVSectionEditor
          section={editingSection}
          apiKey={apiKey}
          onClose={() => setEditingId(null)}
          onSaved={load}
        />
      )}

      {showAdd && (
        <AddCustomSectionModal
          apiKey={apiKey}
          onClose={() => setShowAdd(false)}
          onCreated={load}
        />
      )}
    </main>
  );
}
