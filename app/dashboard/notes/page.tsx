"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  StickyNote,
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Tag as TagIcon,
  Save,
  Eye,
  Pencil,
  X,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { useApiKey } from "@/lib/contexts/AuthContext";
import { NotePreview } from "@/components/dashboard/notes/NotePreview";
import type { INote, NoteColor } from "@/models/Note";

interface TagItem {
  name: string;
  count: number;
}

const COLOR_CONFIG: Record<NoteColor, { label: string; bg: string; border: string; dot: string }> = {
  default: {
    label: "Neutre",
    bg: "bg-[var(--bg-card)]",
    border: "border-[var(--border-soft)]",
    dot: "bg-[var(--text-tertiary)]",
  },
  orange: {
    label: "Orange",
    bg: "bg-[var(--accent-orange)]/5",
    border: "border-[var(--accent-orange)]/30",
    dot: "bg-[var(--accent-orange)]",
  },
  blue: {
    label: "Bleu",
    bg: "bg-[var(--accent-blue)]/5",
    border: "border-[var(--accent-blue)]/30",
    dot: "bg-[var(--accent-blue)]",
  },
  green: {
    label: "Vert",
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  violet: {
    label: "Violet",
    bg: "bg-[var(--accent-violet)]/5",
    border: "border-[var(--accent-violet)]/30",
    dot: "bg-[var(--accent-violet)]",
  },
  danger: {
    label: "Rouge",
    bg: "bg-[var(--accent-danger)]/5",
    border: "border-[var(--accent-danger)]/30",
    dot: "bg-[var(--accent-danger)]",
  },
};

export default function NotesPage() {
  const apiKey = useApiKey();
  const [notes, setNotes] = useState<INote[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [draft, setDraft] = useState<{
    title: string;
    content: string;
    tagsInput: string;
    color: NoteColor;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (selectIdAfter?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());
        if (activeTag) params.set("tag", activeTag);
        const res = await fetch(`/api/notes?${params}`, { headers: { "x-api-key": apiKey } });
        if (!res.ok) throw new Error("Échec");
        const data = await res.json();
        setNotes(data.notes ?? []);
        setTags(data.tags ?? []);
        if (selectIdAfter) setSelectedId(selectIdAfter);
        else if (!selectedId && (data.notes ?? []).length > 0) setSelectedId(String(data.notes[0]._id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur");
      } finally {
        setLoading(false);
      }
    },
    [apiKey, search, activeTag, selectedId]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeTag]);

  const selected = notes.find((n) => String(n._id) === selectedId) ?? null;

  // Reset draft when selection changes
  useEffect(() => {
    if (selected) {
      setDraft({
        title: selected.title,
        content: selected.content,
        tagsInput: selected.tags.join(", "),
        color: selected.color,
      });
      setMode("preview");
      setSavedAt(null);
    } else {
      setDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const persist = useCallback(
    async (overrides: Partial<{ title: string; content: string; tags: string[]; isPinned: boolean; color: NoteColor }>) => {
      if (!selected || !draft) return;
      setSaving(true);
      try {
        const tagsArray = draft.tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        const payload = {
          title: draft.title,
          content: draft.content,
          tags: tagsArray,
          color: draft.color,
          ...overrides,
        };
        const res = await fetch(`/api/notes/${selected._id}`, {
          method: "PATCH",
          headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Échec sauvegarde");
        const updated = await res.json();
        setNotes((prev) => prev.map((n) => (String(n._id) === String(updated._id) ? updated : n)));
        setSavedAt(new Date());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur");
      } finally {
        setSaving(false);
      }
    },
    [apiKey, draft, selected]
  );

  // Debounced auto-save when draft changes
  useEffect(() => {
    if (!draft || !selected) return;
    const isChanged =
      draft.title !== selected.title ||
      draft.content !== selected.content ||
      draft.tagsInput !== selected.tags.join(", ") ||
      draft.color !== selected.color;
    if (!isChanged) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persist({});
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const handleNew = async () => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Nouvelle note",
          content: "",
          tags: activeTag ? [activeTag] : [],
        }),
      });
      if (!res.ok) throw new Error("Échec");
      const created = await res.json();
      await load(String(created._id));
      setMode("edit");
      toast.success("Note créée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Supprimer "${selected.title}" ?`)) return;
    try {
      const res = await fetch(`/api/notes/${selected._id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) throw new Error("Échec");
      const remaining = notes.filter((n) => String(n._id) !== String(selected._id));
      setNotes(remaining);
      setSelectedId(remaining.length > 0 ? String(remaining[0]._id) : null);
      toast.success("Supprimée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const togglePin = async () => {
    if (!selected) return;
    await persist({ isPinned: !selected.isPinned });
    setNotes((prev) =>
      [...prev]
        .map((n) =>
          String(n._id) === String(selected._id) ? { ...n, isPinned: !selected.isPinned } : n
        )
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        })
    );
  };

  return (
    <div className="h-[calc(100vh-var(--topbar-height)-3rem)] grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
      {/* LEFT: list */}
      <aside className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[var(--border-soft)] space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <StickyNote size={14} className="text-[var(--accent-orange)]" />
              Notes ({notes.length})
            </h2>
            <button
              onClick={handleNew}
              className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] text-xs font-semibold"
              title="Nouvelle note"
            >
              <Plus size={12} /> Nouvelle
            </button>
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-7 pr-2 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-soft)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]"
            />
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {activeTag && (
                <button
                  onClick={() => setActiveTag(null)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10 inline-flex items-center gap-1"
                >
                  <X size={10} /> {activeTag}
                </button>
              )}
              {!activeTag &&
                tags.slice(0, 8).map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setActiveTag(t.name)}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  >
                    #{t.name}{" "}
                    <span className="text-[var(--text-tertiary)]">{t.count}</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-center text-xs text-[var(--text-tertiary)] py-8">Chargement…</p>}
          {!loading && notes.length === 0 && (
            <p className="text-center text-xs text-[var(--text-tertiary)] py-8 px-3">
              Aucune note. Clique sur « Nouvelle » pour commencer.
            </p>
          )}
          <ul className="divide-y divide-[var(--border-soft)]">
            {notes.map((n) => {
              const colorCfg = COLOR_CONFIG[n.color];
              const isActive = String(n._id) === selectedId;
              return (
                <li key={String(n._id)}>
                  <button
                    onClick={() => setSelectedId(String(n._id))}
                    className={`w-full text-left p-3 hover:bg-[var(--bg-hover)] transition-colors border-l-2 ${
                      isActive
                        ? "bg-[var(--bg-active)] border-l-[var(--accent-orange)]"
                        : "border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${colorCfg.dot} flex-shrink-0`} />
                      {n.isPinned && <Pin size={10} className="text-[var(--accent-orange)] flex-shrink-0" />}
                      <span className="font-medium text-sm text-[var(--text-primary)] truncate">{n.title}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] line-clamp-2">
                      {n.content.slice(0, 120) || "(vide)"}
                    </p>
                    {n.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {n.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[9px] px-1 rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* RIGHT: editor */}
      <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] flex flex-col overflow-hidden">
        {!selected || !draft ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <StickyNote size={32} className="text-[var(--text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--text-secondary)] mb-1">Aucune note sélectionnée</p>
            <p className="text-xs text-[var(--text-tertiary)] mb-4">
              Sélectionne une note dans la colonne de gauche, ou crée-en une.
            </p>
            <button
              onClick={handleNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] text-sm font-semibold"
            >
              <Plus size={14} /> Nouvelle note
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-[var(--border-soft)] p-3 flex items-center gap-2">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="flex-1 bg-transparent text-base font-semibold text-[var(--text-primary)] focus:outline-none"
                placeholder="Titre…"
              />

              <button
                onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
                className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                title={mode === "edit" ? "Aperçu" : "Éditer"}
              >
                {mode === "edit" ? <Eye size={14} /> : <Pencil size={14} />}
              </button>

              <ColorPicker color={draft.color} onChange={(c) => setDraft({ ...draft, color: c })} />

              <button
                onClick={togglePin}
                className={`p-1.5 rounded hover:bg-[var(--bg-hover)] ${
                  selected.isPinned ? "text-[var(--accent-orange)]" : "text-[var(--text-secondary)]"
                }`}
                title={selected.isPinned ? "Désépingler" : "Épingler"}
              >
                {selected.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>

              <button
                onClick={() => persist({})}
                disabled={saving}
                className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--accent-info)] disabled:opacity-50"
                title="Sauvegarder maintenant"
              >
                <Save size={14} />
              </button>

              <button
                onClick={handleDelete}
                className="p-1.5 rounded hover:bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]"
                title="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Tags + status */}
            <div className="border-b border-[var(--border-soft)] px-3 py-2 flex items-center gap-3 text-xs">
              <TagIcon size={11} className="text-[var(--text-tertiary)]" />
              <input
                value={draft.tagsInput}
                onChange={(e) => setDraft({ ...draft, tagsInput: e.target.value })}
                placeholder="tags séparés par des virgules"
                className="flex-1 bg-transparent text-xs text-[var(--text-secondary)] focus:outline-none"
              />
              <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">
                {saving ? "Sauvegarde…" : savedAt ? `Sauvegardé · ${savedAt.toLocaleTimeString("fr-FR")}` : ""}
              </span>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {mode === "edit" ? (
                <textarea
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  placeholder="Markdown supporté. Bloc de code avec ``` pour la copie 1-clic.&#10;&#10;Exemple :&#10;## SSH VPS&#10;```bash&#10;ssh vpsHarmo&#10;```"
                  className="w-full h-full p-4 bg-transparent text-sm text-[var(--text-primary)] font-mono leading-relaxed resize-none focus:outline-none"
                />
              ) : (
                <div className="p-4">
                  <NotePreview content={draft.content} />
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ColorPicker({ color, onChange }: { color: NoteColor; onChange: (c: NoteColor) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
        title="Couleur"
      >
        <Palette size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-2 shadow-xl shadow-black/40">
            <div className="grid grid-cols-3 gap-1 w-32">
              {(Object.entries(COLOR_CONFIG) as [NoteColor, (typeof COLOR_CONFIG)[NoteColor]][]).map(
                ([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                    className={`p-2 rounded-md hover:bg-[var(--bg-hover)] flex items-center justify-center ${
                      color === key ? "ring-2 ring-[var(--accent-orange)]" : ""
                    }`}
                    title={cfg.label}
                  >
                    <span className={`w-4 h-4 rounded-full ${cfg.dot}`} />
                  </button>
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
