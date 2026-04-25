"use client";

import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

export interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "textarea" | "url" | "email" | "tags";
  placeholder?: string;
  rows?: number;
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
              const span = field.type === "textarea" || field.type === "tags" ? "md:col-span-2" : "";
              return (
                <div key={field.name} className={span}>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {field.label}
                  </label>
                  {field.type === "textarea" ? (
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
