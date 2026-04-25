"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Lock,
  Upload,
  FileText,
  Trash2,
  Star,
  Download,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";

type CVScope = "default" | "stage" | "alternance" | "cdi";

interface CVFileMeta {
  _id: string;
  name: string;
  filename: string;
  mime: string;
  size: number;
  scope: CVScope;
  isDefault: boolean;
  created_at: string;
}

const SCOPE_LABEL: Record<CVScope, string> = {
  default: "Par défaut",
  stage: "Stage",
  alternance: "Alternance",
  cdi: "CDI",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ko`;
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
}

export default function CVFilesPage() {
  const [apiKey, setApiKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);

  const [files, setFiles] = useState<CVFileMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const [uploadName, setUploadName] = useState("");
  const [uploadScope, setUploadScope] = useState<CVScope>("default");
  const [uploadIsDefault, setUploadIsDefault] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

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
      const res = await fetch("/api/cv-files", { headers: { "x-api-key": apiKey } });
      if (!res.ok) throw new Error("Échec du chargement");
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    sessionStorage.setItem("api-key", apiKey);
    setAuthed(true);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (file.type !== "application/pdf") {
      toast.error("Le fichier doit être un PDF");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (uploadName.trim()) fd.append("name", uploadName.trim());
      fd.append("scope", uploadScope);
      fd.append("isDefault", uploadIsDefault ? "true" : "false");

      const res = await fetch("/api/cv-files", {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Échec de l'upload");
      }
      toast.success("CV importé");
      setUploadName("");
      setUploadIsDefault(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const updateFile = async (id: string, patch: Partial<{ name: string; scope: CVScope; isDefault: boolean }>) => {
    try {
      const res = await fetch(`/api/cv-files/${id}`, {
        method: "PATCH",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Échec");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer le CV "${name}" ?`)) return;
    try {
      const res = await fetch(`/api/cv-files/${id}`, { method: "DELETE", headers: { "x-api-key": apiKey } });
      if (!res.ok) throw new Error("Échec");
      toast.success("CV supprimé");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleDownload = async (id: string, filename: string) => {
    try {
      const res = await fetch(`/api/cv-files/${id}/download`, { headers: { "x-api-key": apiKey } });
      if (!res.ok) throw new Error("Échec");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
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
            <h1 className="text-lg font-bold text-[var(--text-primary)]">Accès dashboard</h1>
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Clé API"
            className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
            autoFocus
          />
          <button type="submit" className="w-full py-2 rounded-md bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold">
            Entrer
          </button>
        </form>
      </main>
    );
  }

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
              <h1 className="text-xl font-bold flex items-center gap-2">
                <FileText size={20} className="text-[var(--accent-orange)]" />
                Mes CVs
              </h1>
              <p className="text-xs text-[var(--text-tertiary)]">
                Importe plusieurs CVs et choisis lequel attacher selon le type de candidature
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Upload zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`rounded-2xl border-2 border-dashed p-6 transition-colors ${
            dragOver
              ? "border-[var(--accent-orange)] bg-[var(--accent-orange)]/5"
              : "border-[var(--border-color)] bg-[var(--bg-card)]/40"
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nom (optionnel)</label>
              <input
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Ex: CV Stage Mars 2026"
                className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Type de candidature</label>
              <select
                value={uploadScope}
                onChange={(e) => setUploadScope(e.target.value as CVScope)}
                className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
              >
                <option value="default">Par défaut (tous types)</option>
                <option value="stage">Stage uniquement</option>
                <option value="alternance">Alternance uniquement</option>
                <option value="cdi">CDI uniquement</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={uploadIsDefault}
                  onChange={(e) => setUploadIsDefault(e.target.checked)}
                  className="accent-[var(--accent-orange)]"
                />
                Définir comme CV par défaut
              </label>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center text-center py-6">
            <Upload size={32} className="text-[var(--text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Glisse-dépose un PDF ou clique pour sélectionner (max 8 Mo)
            </p>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-5 py-2 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold disabled:opacity-60"
            >
              {uploading ? "Import en cours…" : "Choisir un fichier"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </div>
        </div>

        {/* List */}
        {loading && <p className="text-center text-[var(--text-secondary)] py-12">Chargement…</p>}

        {!loading && files.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-[var(--border-color)] p-10 text-center">
            <FileText size={32} className="mx-auto text-[var(--text-tertiary)] mb-4" />
            <p className="text-[var(--text-secondary)]">Aucun CV importé pour le moment.</p>
          </div>
        )}

        {!loading && files.length > 0 && (
          <div className="space-y-3">
            {files.map((f) => {
              const isEditing = editingId === f._id;
              return (
                <div
                  key={f._id}
                  className="flex items-center gap-3 p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]"
                >
                  <FileText size={24} className="text-[var(--accent-orange)] flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {isEditing ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2 py-1 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
                          autoFocus
                        />
                      ) : (
                        <span className="font-semibold truncate">{f.name}</span>
                      )}
                      {f.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-orange)]/10 text-[var(--accent-orange)]">
                          <Star size={10} /> Par défaut
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">
                        {SCOPE_LABEL[f.scope]}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {f.filename} · {formatBytes(f.size)} ·{" "}
                      {new Date(f.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <select
                      value={f.scope}
                      onChange={(e) => updateFile(f._id, { scope: e.target.value as CVScope })}
                      className="px-2 py-1 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none"
                    >
                      <option value="default">Défaut</option>
                      <option value="stage">Stage</option>
                      <option value="alternance">Alternance</option>
                      <option value="cdi">CDI</option>
                    </select>

                    {!f.isDefault && (
                      <button
                        onClick={() => updateFile(f._id, { isDefault: true })}
                        className="p-2 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                        title="Définir comme défaut"
                      >
                        <Star size={16} />
                      </button>
                    )}

                    {isEditing ? (
                      <>
                        <button
                          onClick={() => {
                            updateFile(f._id, { name: editName });
                            setEditingId(null);
                          }}
                          className="p-2 rounded hover:bg-emerald-500/10 text-emerald-500"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(f._id);
                          setEditName(f.name);
                        }}
                        className="p-2 rounded hover:bg-[var(--bg-secondary)] text-[var(--accent-orange)]"
                        title="Renommer"
                      >
                        <Pencil size={16} />
                      </button>
                    )}

                    <button
                      onClick={() => handleDownload(f._id, f.filename)}
                      className="p-2 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                      title="Télécharger"
                    >
                      <Download size={16} />
                    </button>

                    <button
                      onClick={() => handleDelete(f._id, f.name)}
                      className="p-2 rounded hover:bg-red-500/10 text-red-500"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-[var(--text-tertiary)] mt-4">
          💡 La résolution se fait dans cet ordre : CV explicite à l'envoi → CV par type de candidature →
          CV par défaut → fichier statique <code>candidatureModel/cv-mohammed.pdf</code>.
        </p>
      </section>
    </main>
  );
}
