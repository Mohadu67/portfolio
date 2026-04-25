"use client";

import type { FieldConfig } from "./ListItemEditor";

interface SimpleFieldsEditorProps {
  data: Record<string, unknown>;
  fields: FieldConfig[];
  onChange: (data: Record<string, unknown>) => void;
}

export function SimpleFieldsEditor({ data, fields, onChange }: SimpleFieldsEditorProps) {
  const update = (name: string, value: unknown) => onChange({ ...data, [name]: value });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((field) => {
        const value = data[field.name];
        const span = field.type === "textarea" ? "md:col-span-2" : "";
        return (
          <div key={field.name} className={span}>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              {field.label}
            </label>
            {field.type === "textarea" ? (
              <textarea
                value={(value as string) ?? ""}
                onChange={(e) => update(field.name, e.target.value)}
                placeholder={field.placeholder}
                rows={field.rows ?? 4}
                className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
              />
            ) : (
              <input
                type={field.type}
                value={(value as string) ?? ""}
                onChange={(e) => update(field.name, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
