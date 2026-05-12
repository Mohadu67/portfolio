"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useApiKey } from "@/lib/contexts/AuthContext";

export interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "textarea" | "url" | "email" | "tags" | "image";
  placeholder?: string;
  rows?: number;
}

function ImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const apiKey = useApiKey();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Le fichier doit être une image");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "project");
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Upload échoué");
        return;
      }
      const data = await res.json();
      onChange(`/api/media/${data._id}`);
      toast.success("Image uploadée");
    } catch (e) {
      toast.error("Upload impossible");
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/api/media/... ou URL externe"
          className="flex-1 px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--accent-orange)]/40 text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/10 text-xs font-medium disabled:opacity-50"
        >
          <Upload size={14} />
          {uploading ? "Upload..." : "Upload"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex items-center px-2 py-2 rounded-md border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent-danger)]"
            title="Retirer"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Aperçu"
          className="h-32 w-full max-w-xs rounded-md border border-[var(--border-color)] object-cover"
        />
      )}
    </div>
  );
}

interface ListItemEditorProps {
  items: Array<Record<string, unknown>>;
  fields: FieldConfig[];
  itemLabel: string;
  newItemTemplate: () => Record<string, unknown>;
  onChange: (items: Array<Record<string, unknown>>) => void;
}

export function ListItemEditor({ items, fields, itemLabel, newItemTemplate, onChange }: ListItemEditorProps) {
  const updateItem = (idx: number, field: string, value: unknown) => {
    const next = items.map((item, i) => (i === idx ? { ...item, [field]: value } : item));
    onChange(next);
  };

  const addItem = () => onChange([...items, newItemTemplate()]);
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">
              {itemLabel} #{idx + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => moveItem(idx, -1)}
                disabled={idx === 0}
                className="p-1.5 rounded hover:bg-[var(--bg-secondary)] disabled:opacity-30"
                title="Monter"
              >
                <ChevronUp size={16} />
              </button>
              <button
                onClick={() => moveItem(idx, 1)}
                disabled={idx === items.length - 1}
                className="p-1.5 rounded hover:bg-[var(--bg-secondary)] disabled:opacity-30"
                title="Descendre"
              >
                <ChevronDown size={16} />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Supprimer cet élément ?`)) removeItem(idx);
                }}
                className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
                title="Supprimer"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map((field) => {
              const value = item[field.name];
              const span =
                field.type === "textarea" || field.type === "tags" || field.type === "image"
                  ? "md:col-span-2"
                  : "";
              return (
                <div key={field.name} className={span}>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {field.label}
                  </label>
                  {field.type === "image" ? (
                    <ImageField
                      value={(value as string) ?? ""}
                      onChange={(v) => updateItem(idx, field.name, v)}
                    />
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={(value as string) ?? ""}
                      onChange={(e) => updateItem(idx, field.name, e.target.value)}
                      placeholder={field.placeholder}
                      rows={field.rows ?? 3}
                      className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
                    />
                  ) : field.type === "tags" ? (
                    <input
                      type="text"
                      value={Array.isArray(value) ? (value as string[]).join(", ") : ""}
                      onChange={(e) =>
                        updateItem(
                          idx,
                          field.name,
                          e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder={field.placeholder ?? "Item1, Item2, Item3"}
                      className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={(value as string) ?? ""}
                      onChange={(e) => updateItem(idx, field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <button
        onClick={addItem}
        className="w-full py-3 rounded-lg border-2 border-dashed border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)] flex items-center justify-center gap-2 transition-colors"
      >
        <Plus size={18} />
        <span className="text-sm font-medium">Ajouter un {itemLabel.toLowerCase()}</span>
      </button>
    </div>
  );
}
