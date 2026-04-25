"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

interface AddCustomSectionModalProps {
  apiKey: string;
  onClose: () => void;
  onCreated: () => void;
}

export function AddCustomSectionModal({ apiKey, onClose, onCreated }: AddCustomSectionModalProps) {
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("");
  const [creating, setCreating] = useState(false);

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Titre requis");
      return;
    }
    const finalKey = key.trim() || `custom-${slugify(title)}-${Date.now().toString(36)}`;
    setCreating(true);
    try {
      const res = await fetch("/api/cv-sections", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          key: finalKey,
          type: "custom",
          title: title.trim(),
          isVisible: true,
          content: { subtitle: "", body: "", items: [] },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur");
      }
      toast.success("Section créée");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Nouvelle section</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Titre affiché
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mes certifications"
              className="w-full px-3 py-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Identifiant (optionnel — auto-généré sinon)
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="certifications"
              className="w-full px-3 py-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
          >
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !title.trim()}
            className="px-5 py-2 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold disabled:opacity-60"
          >
            {creating ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
