"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Upload,
  Image as ImageIcon,
  FileText,
  Trash2,
  Star,
  Check,
  ArrowRight,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useApiKey } from "@/lib/contexts/AuthContext";

type MediaKind = "photo" | "project" | "asset";

interface MediaItem {
  _id: string;
  name: string;
  filename: string;
  mime: string;
  size: number;
  kind: MediaKind;
  isActive: boolean;
  created_at: string;
}

interface CVFileItem {
  _id: string;
  name: string;
  filename: string;
  size: number;
  scope: "default" | "stage" | "alternance" | "cdi";
  isDefault: boolean;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ko`;
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
}

export default function MediaPage() {
  const apiKey = useApiKey();
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [cvs, setCvs] = useState<CVFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cvRes] = await Promise.all([
        fetch("/api/media?kind=photo", { headers: { "x-api-key": apiKey } }),
        fetch("/api/cv-files", { headers: { "x-api-key": apiKey } }),
      ]);
      const pData = pRes.ok ? await pRes.json() : { items: [] };
      const cvData = cvRes.ok ? await cvRes.json() : { files: [] };
      setPhotos(pData.items ?? []);
      setCvs(cvData.files ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadPhoto = async (file: File, setActive: boolean) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Le fichier doit être une image");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "photo");
      fd.append("isActive", setActive ? "true" : "false");

      const res = await fetch("/api/media", { method: "POST", headers: { "x-api-key": apiKey }, body: fd });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Échec");
      }
      toast.success("Photo importée" + (setActive ? " (définie comme photo de profil)" : ""));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const useAsPhoto = async (id: string) => {
    try {
      const res = await fetch(`/api/media/${id}/use-as-photo`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Échec");
      }
      toast.success("Photo de profil mise à jour ! Le portfolio se rafraîchit dans 1 min (cache ISR).");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const deletePhoto = async (id: string, name: string) => {
    if (!confirm(`Supprimer la photo "${name}" ?`)) return;
    try {
      const res = await fetch(`/api/media/${id}`, { method: "DELETE", headers: { "x-api-key": apiKey } });
      if (!res.ok) throw new Error("Échec");
      toast.success("Photo supprimée");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <p className="text-sm text-[var(--text-secondary)]">
        Gère ta photo de portfolio, tes CVs et tous tes médias depuis un seul endroit.
      </p>

      {/* Photos section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <ImageIcon size={16} className="text-[var(--accent-violet)]" />
            Photo de profil portfolio
          </h2>
          <span className="text-xs text-[var(--text-tertiary)]">{photos.length} photo{photos.length > 1 ? "s" : ""}</span>
        </div>

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
            const f = e.dataTransfer.files[0];
            if (f) uploadPhoto(f, photos.length === 0);
          }}
          className={`rounded-2xl border-2 border-dashed p-6 transition-colors ${
            dragOver
              ? "border-[var(--accent-orange)] bg-[var(--accent-orange)]/5"
              : "border-[var(--border-soft)] bg-[var(--bg-card)]"
          }`}
        >
          <div className="flex flex-col items-center justify-center text-center py-2">
            <Upload size={26} className="text-[var(--text-tertiary)] mb-2" />
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Glisse une image (JPG, PNG, WebP, max 5 Mo) ou clique pour choisir
            </p>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold text-sm disabled:opacity-50"
            >
              {uploading ? "Import..." : "Choisir une image"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPhoto(f, photos.length === 0);
              }}
              className="hidden"
            />
          </div>
        </div>

        {/* Photo grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {photos.map((p) => (
              <div
                key={p._id}
                className={`group rounded-lg border overflow-hidden bg-[var(--bg-card)] ${
                  p.isActive ? "border-[var(--accent-orange)]" : "border-[var(--border-soft)]"
                }`}
              >
                <div className="aspect-square relative bg-[var(--bg-primary)]">
                  <Image
                    src={`/api/media/${p._id}`}
                    alt={p.name}
                    fill
                    sizes="200px"
                    className="object-cover"
                    unoptimized
                  />
                  {p.isActive && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--accent-orange)] text-[var(--bg-primary)]">
                      <Check size={10} /> Active
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPreviewUrl(`/api/media/${p._id}`)}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                      title="Prévisualiser"
                    >
                      <Eye size={16} />
                    </button>
                    {!p.isActive && (
                      <button
                        onClick={() => useAsPhoto(p._id)}
                        className="p-2 rounded-full bg-[var(--accent-orange)] hover:opacity-90 text-[var(--bg-primary)]"
                        title="Définir comme photo de profil"
                      >
                        <Star size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => deletePhoto(p._id, p.name)}
                      className="p-2 rounded-full bg-red-500/90 hover:bg-red-500 text-white"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">{formatBytes(p.size)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CVs section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText size={16} className="text-[var(--accent-orange)]" />
            CVs PDF
          </h2>
          <Link
            href="/dashboard/cv-files"
            className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-orange)]"
          >
            Gérer en détail <ArrowRight size={12} />
          </Link>
        </div>
        {cvs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-soft)] p-6 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">Aucun CV. Ajoute-en depuis "Gérer en détail".</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cvs.map((cv) => (
              <Link
                key={cv._id}
                href="/dashboard/cv-files"
                className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] hover:border-[var(--accent-orange)]/40"
              >
                <FileText size={20} className="text-[var(--accent-orange)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-2">
                    {cv.isDefault && <Star size={12} className="text-[var(--accent-orange)]" />}
                    {cv.name}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">{cv.scope} · {formatBytes(cv.size)}</p>
                </div>
                <ArrowRight size={14} className="text-[var(--text-tertiary)]" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Aperçu" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
