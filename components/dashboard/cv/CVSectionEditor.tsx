"use client";

import { useEffect, useState } from "react";
import { X, Save } from "lucide-react";
import { toast } from "sonner";
import type { ICVSection } from "@/models/CVSection";
import { ListItemEditor, type FieldConfig } from "./editors/ListItemEditor";
import { SimpleFieldsEditor } from "./editors/SimpleFieldsEditor";

const PROFILE_FIELDS: FieldConfig[] = [
  { name: "name", label: "Nom complet", type: "text" },
  { name: "title", label: "Titre / fonction", type: "text", placeholder: "Concepteur Développeur Fullstack" },
  { name: "tagline", label: "Tagline", type: "text", placeholder: "Dev by Day | Creator by Night" },
  { name: "location", label: "Localisation", type: "text" },
  { name: "availability", label: "Disponibilité", type: "text" },
  { name: "phone", label: "Téléphone", type: "text" },
  { name: "email", label: "Email", type: "email" },
  { name: "photo", label: "Chemin de la photo", type: "text", placeholder: "/photoCV.png" },
];

const CONTACT_FIELDS: FieldConfig[] = [
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Téléphone", type: "text" },
  { name: "calendly", label: "URL Calendly", type: "url" },
  { name: "cta", label: "Call-to-action", type: "text", placeholder: "Prêt à collaborer ?" },
];

const SOCIAL_FIELDS: FieldConfig[] = [
  { name: "id", label: "ID (slug unique)", type: "text" },
  { name: "name", label: "Nom du réseau", type: "text" },
  { name: "handle", label: "Handle / pseudo affiché", type: "text" },
  { name: "url", label: "URL", type: "url" },
  { name: "icon", label: "Icône", type: "text", placeholder: "github | linkedin | mail | calendar" },
];

const SKILL_FIELDS: FieldConfig[] = [
  { name: "id", label: "ID (slug unique)", type: "text" },
  { name: "name", label: "Nom", type: "text" },
  { name: "category", label: "Catégorie", type: "text", placeholder: "Frontend, Backend, ..." },
  { name: "level", label: "Niveau", type: "text", placeholder: "Expert | Avancé | Intermédiaire | Débutant" },
  { name: "years", label: "Années d'XP", type: "text", placeholder: "3+" },
  { name: "bugStory", label: "Anecdote / bug story", type: "textarea", rows: 3 },
];

const PROJECT_FIELDS: FieldConfig[] = [
  { name: "id", label: "ID (slug unique)", type: "text" },
  { name: "name", label: "Nom du projet", type: "text" },
  { name: "url", label: "URL", type: "url" },
  { name: "image", label: "Chemin de l'image", type: "text" },
  { name: "stack", label: "Stack (séparée par virgules)", type: "tags", placeholder: "React, Node.js, MongoDB" },
  { name: "description", label: "Description", type: "textarea", rows: 4 },
];

const EDUCATION_FIELDS: FieldConfig[] = [
  { name: "id", label: "ID (slug unique)", type: "text" },
  { name: "school", label: "École / organisme", type: "text" },
  { name: "degree", label: "Diplôme / titre", type: "text" },
  { name: "field", label: "Niveau / domaine", type: "text" },
  { name: "period", label: "Période", type: "text", placeholder: "Sept 2024 → Mars 2025" },
  { name: "description", label: "Description courte", type: "textarea", rows: 2 },
  { name: "capabilities", label: "Compétences acquises", type: "textarea", rows: 6 },
];

const EXPERIENCE_FIELDS: FieldConfig[] = [
  { name: "id", label: "ID (slug unique)", type: "text" },
  { name: "company", label: "Entreprise", type: "text" },
  { name: "position", label: "Poste", type: "text" },
  { name: "startDate", label: "Date début (YYYY-MM)", type: "text", placeholder: "2024-09" },
  { name: "endDate", label: "Date fin (YYYY-MM ou Présent)", type: "text", placeholder: "2025-03" },
  { name: "description", label: "Résumé", type: "textarea", rows: 2 },
  { name: "details", label: "Détails", type: "textarea", rows: 6 },
];

const CUSTOM_ITEM_FIELDS: FieldConfig[] = [
  { name: "id", label: "ID (slug unique)", type: "text" },
  { name: "title", label: "Titre", type: "text" },
  { name: "description", label: "Description", type: "textarea", rows: 4 },
];

interface CVSectionEditorProps {
  section: ICVSection;
  apiKey: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CVSectionEditor({ section, apiKey, onClose, onSaved }: CVSectionEditorProps) {
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState<Record<string, unknown>>(
    (section.content as Record<string, unknown>) ?? {}
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(section.title);
    setContent((section.content as Record<string, unknown>) ?? {});
  }, [section]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cv-sections/${section._id}`, {
        method: "PATCH",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur de sauvegarde");
      }
      toast.success("Section sauvegardée");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const renderEditor = () => {
    switch (section.type) {
      case "profile":
        return <SimpleFieldsEditor data={content} fields={PROFILE_FIELDS} onChange={setContent} />;
      case "contact":
        return <SimpleFieldsEditor data={content} fields={CONTACT_FIELDS} onChange={setContent} />;
      case "socials":
        return (
          <ListItemEditor
            items={(content.items as Array<Record<string, unknown>>) ?? []}
            fields={SOCIAL_FIELDS}
            itemLabel="Réseau"
            newItemTemplate={() => ({ id: `social-${Date.now()}`, name: "", handle: "", url: "", icon: "" })}
            onChange={(items) => setContent({ ...content, items })}
          />
        );
      case "skills":
        return (
          <ListItemEditor
            items={(content.items as Array<Record<string, unknown>>) ?? []}
            fields={SKILL_FIELDS}
            itemLabel="Compétence"
            newItemTemplate={() => ({
              id: `skill-${Date.now()}`,
              name: "",
              category: "",
              level: "Intermédiaire",
              years: "",
              bugStory: "",
            })}
            onChange={(items) => setContent({ ...content, items })}
          />
        );
      case "projects":
        return (
          <ListItemEditor
            items={(content.items as Array<Record<string, unknown>>) ?? []}
            fields={PROJECT_FIELDS}
            itemLabel="Projet"
            newItemTemplate={() => ({
              id: `project-${Date.now()}`,
              name: "",
              url: "",
              image: "",
              stack: [],
              description: "",
            })}
            onChange={(items) => setContent({ ...content, items })}
          />
        );
      case "education":
        return (
          <ListItemEditor
            items={(content.items as Array<Record<string, unknown>>) ?? []}
            fields={EDUCATION_FIELDS}
            itemLabel="Formation"
            newItemTemplate={() => ({
              id: `edu-${Date.now()}`,
              school: "",
              degree: "",
              field: "",
              period: "",
              description: "",
              capabilities: "",
            })}
            onChange={(items) => setContent({ ...content, items })}
          />
        );
      case "experience":
        return (
          <ListItemEditor
            items={(content.items as Array<Record<string, unknown>>) ?? []}
            fields={EXPERIENCE_FIELDS}
            itemLabel="Expérience"
            newItemTemplate={() => ({
              id: `exp-${Date.now()}`,
              company: "",
              position: "",
              startDate: "",
              endDate: "",
              description: "",
              details: "",
            })}
            onChange={(items) => setContent({ ...content, items })}
          />
        );
      case "custom":
        return (
          <div className="space-y-4">
            <SimpleFieldsEditor
              data={{ subtitle: content.subtitle, body: content.body }}
              fields={[
                { name: "subtitle", label: "Sous-titre", type: "text" },
                { name: "body", label: "Texte libre (paragraphe)", type: "textarea", rows: 6 },
              ]}
              onChange={(d) => setContent({ ...content, ...d })}
            />
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                Cartes / items (optionnel)
              </label>
              <ListItemEditor
                items={(content.items as Array<Record<string, unknown>>) ?? []}
                fields={CUSTOM_ITEM_FIELDS}
                itemLabel="Carte"
                newItemTemplate={() => ({ id: `item-${Date.now()}`, title: "", description: "" })}
                onChange={(items) => setContent({ ...content, items })}
              />
            </div>
          </div>
        );
      default:
        return <div className="text-[var(--text-secondary)]">Type de section non supporté.</div>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
              Édition section · {section.type}
            </p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-bold bg-transparent text-[var(--text-primary)] focus:outline-none w-full"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{renderEditor()}</div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-[var(--border-color)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}
