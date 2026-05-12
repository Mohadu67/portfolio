"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import type {
  CVStoryContent,
  CVStorySeekingItem,
  CVStoryTransferSkill,
} from "@/models/CVSection";

interface StoryEditorProps {
  story: CVStoryContent;
  onChange: (next: CVStoryContent) => void;
}

function Chapter({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-[var(--border-color)] pt-4">{children}</div>}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{children}</label>;
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
    />
  );
}

function Area({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
    />
  );
}

export function StoryEditor({ story, onChange }: StoryEditorProps) {
  const update = <K extends keyof CVStoryContent>(key: K, patch: Partial<CVStoryContent[K]>) => {
    onChange({ ...story, [key]: { ...story[key], ...patch } });
  };

  return (
    <div className="space-y-3">
      {/* HERO */}
      <Chapter title="Intro (Hero)" defaultOpen>
        <div>
          <Label>Nom affiché</Label>
          <Input value={story.hero.name} onChange={(v) => update("hero", { name: v })} />
        </div>
        <div>
          <Label>Tagline</Label>
          <Input
            value={story.hero.tagline}
            onChange={(v) => update("hero", { tagline: v })}
            placeholder="Dev by day, creator by night."
          />
        </div>
        <div>
          <Label>Localisation</Label>
          <Input value={story.hero.location} onChange={(v) => update("hero", { location: v })} />
        </div>
      </Chapter>

      {/* RUPTURE */}
      <Chapter title="Rupture (année + texte)">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Année</Label>
            <Input value={story.rupture.year} onChange={(v) => update("rupture", { year: v })} />
          </div>
          <div>
            <Label>Eyebrow</Label>
            <Input value={story.rupture.eyebrow} onChange={(v) => update("rupture", { eyebrow: v })} />
          </div>
        </div>
        <div>
          <Label>Lignes (une par ligne)</Label>
          <Area
            rows={4}
            value={story.rupture.lines.join("\n")}
            onChange={(v) =>
              update("rupture", { lines: v.split("\n").map((s) => s.trim()).filter(Boolean) })
            }
          />
        </div>
        <div>
          <Label>Phrase de clôture</Label>
          <Area
            value={story.rupture.closing}
            onChange={(v) => update("rupture", { closing: v })}
            rows={2}
          />
        </div>
      </Chapter>

      {/* KITCHENS */}
      <Chapter title="Cuisines (restauration + transfert)">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Eyebrow</Label>
            <Input value={story.kitchens.eyebrow} onChange={(v) => update("kitchens", { eyebrow: v })} />
          </div>
          <div>
            <Label>Titre</Label>
            <Input value={story.kitchens.title} onChange={(v) => update("kitchens", { title: v })} />
          </div>
        </div>
        <div>
          <Label>Intro</Label>
          <Area value={story.kitchens.intro} onChange={(v) => update("kitchens", { intro: v })} rows={3} />
        </div>
        <div>
          <Label>Outro (stats)</Label>
          <Input value={story.kitchens.outro} onChange={(v) => update("kitchens", { outro: v })} />
        </div>
        <div>
          <Label>Titre du transfert (pont vers le dev)</Label>
          <Input
            value={story.kitchens.transferTitle}
            onChange={(v) => update("kitchens", { transferTitle: v })}
          />
        </div>
        <div>
          <Label>Intro du transfert</Label>
          <Area
            value={story.kitchens.transferIntro}
            onChange={(v) => update("kitchens", { transferIntro: v })}
            rows={3}
          />
        </div>
        <div>
          <Label>Compétences transférables</Label>
          <TransferSkillsList
            items={story.kitchens.transferSkills}
            onChange={(items) => update("kitchens", { transferSkills: items })}
          />
        </div>
      </Chapter>

      {/* DOUBLE LIFE */}
      <Chapter title="Double vie (jour / nuit)">
        <div>
          <Label>Eyebrow</Label>
          <Input
            value={story.doubleLife.eyebrow}
            onChange={(v) => update("doubleLife", { eyebrow: v })}
          />
        </div>
        <div className="rounded-md border border-[var(--border-color)] p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Jour</p>
          <Input
            value={story.doubleLife.day.title}
            onChange={(v) =>
              update("doubleLife", { day: { ...story.doubleLife.day, title: v } })
            }
            placeholder="Titre"
          />
          <Area
            value={story.doubleLife.day.body}
            onChange={(v) =>
              update("doubleLife", { day: { ...story.doubleLife.day, body: v } })
            }
            rows={2}
            placeholder="Description"
          />
        </div>
        <div className="rounded-md border border-[var(--border-color)] p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Nuit</p>
          <Input
            value={story.doubleLife.night.title}
            onChange={(v) =>
              update("doubleLife", { night: { ...story.doubleLife.night, title: v } })
            }
            placeholder="Titre"
          />
          <Area
            value={story.doubleLife.night.body}
            onChange={(v) =>
              update("doubleLife", { night: { ...story.doubleLife.night, body: v } })
            }
            rows={2}
            placeholder="Description"
          />
        </div>
      </Chapter>

      {/* LEAP */}
      <Chapter title="Le saut (formation)">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Année</Label>
            <Input value={story.leap.year} onChange={(v) => update("leap", { year: v })} />
          </div>
          <div>
            <Label>Eyebrow</Label>
            <Input value={story.leap.eyebrow} onChange={(v) => update("leap", { eyebrow: v })} />
          </div>
        </div>
        <div>
          <Label>Titre</Label>
          <Input value={story.leap.title} onChange={(v) => update("leap", { title: v })} />
        </div>
        <div>
          <Label>Texte</Label>
          <Area value={story.leap.body} onChange={(v) => update("leap", { body: v })} rows={4} />
        </div>
        <div>
          <Label>Badge (diplôme + école)</Label>
          <Input value={story.leap.badge} onChange={(v) => update("leap", { badge: v })} />
        </div>
      </Chapter>

      {/* SKILLS HEADER */}
      <Chapter title="Skills (header du chapitre)">
        <div>
          <Label>Eyebrow</Label>
          <Input value={story.skills.eyebrow} onChange={(v) => update("skills", { eyebrow: v })} />
        </div>
        <div>
          <Label>Titre</Label>
          <Input value={story.skills.title} onChange={(v) => update("skills", { title: v })} />
        </div>
        <div>
          <Label>Sous-titre</Label>
          <Input value={story.skills.subtitle} onChange={(v) => update("skills", { subtitle: v })} />
        </div>
      </Chapter>

      {/* PROJECTS HEADER */}
      <Chapter title="Projets (header du chapitre)">
        <div>
          <Label>Eyebrow</Label>
          <Input value={story.projects.eyebrow} onChange={(v) => update("projects", { eyebrow: v })} />
        </div>
        <div>
          <Label>Titre</Label>
          <Input value={story.projects.title} onChange={(v) => update("projects", { title: v })} />
        </div>
        <div>
          <Label>Sous-titre</Label>
          <Input
            value={story.projects.subtitle}
            onChange={(v) => update("projects", { subtitle: v })}
          />
        </div>
      </Chapter>

      {/* PRESENT */}
      <Chapter title="Présent (CDA + dispo)">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Eyebrow</Label>
            <Input
              value={story.present.eyebrow}
              onChange={(v) => update("present", { eyebrow: v })}
            />
          </div>
          <div>
            <Label>Titre</Label>
            <Input value={story.present.title} onChange={(v) => update("present", { title: v })} />
          </div>
        </div>
        <div>
          <Label>Texte</Label>
          <Area value={story.present.body} onChange={(v) => update("present", { body: v })} rows={4} />
        </div>

        <div className="rounded-md border border-[var(--border-color)] p-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={story.present.seekingEnabled}
              onChange={(e) => update("present", { seekingEnabled: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm text-[var(--text-primary)]">
              Afficher le bloc &quot;Je cherche&quot;
            </span>
          </label>

          {story.present.seekingEnabled && (
            <>
              <div>
                <Label>Titre du bloc</Label>
                <Input
                  value={story.present.seekingTitle}
                  onChange={(v) => update("present", { seekingTitle: v })}
                  placeholder="Je cherche :"
                />
              </div>
              <div>
                <Label>Lignes (label + valeur)</Label>
                <SeekingList
                  items={story.present.seekingItems}
                  onChange={(items) => update("present", { seekingItems: items })}
                />
              </div>
            </>
          )}
        </div>
      </Chapter>

      {/* CONTACT */}
      <Chapter title="Contact">
        <div>
          <Label>Eyebrow</Label>
          <Input value={story.contact.eyebrow} onChange={(v) => update("contact", { eyebrow: v })} />
        </div>
        <div>
          <Label>Titre</Label>
          <Input value={story.contact.title} onChange={(v) => update("contact", { title: v })} />
        </div>
        <div>
          <Label>Sous-titre</Label>
          <Input value={story.contact.body} onChange={(v) => update("contact", { body: v })} />
        </div>
      </Chapter>
    </div>
  );
}

function TransferSkillsList({
  items,
  onChange,
}: {
  items: CVStoryTransferSkill[];
  onChange: (v: CVStoryTransferSkill[]) => void;
}) {
  const update = (idx: number, patch: Partial<CVStoryTransferSkill>) =>
    onChange(items.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, { title: "", body: "", code: "" }]);

  return (
    <div className="space-y-2">
      {items.map((s, idx) => (
        <div key={idx} className="rounded-md border border-[var(--border-color)] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              Compétence #{idx + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="p-1 rounded hover:bg-red-500/10 text-red-500"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <Input value={s.title} onChange={(v) => update(idx, { title: v })} placeholder="Titre" />
          <Area value={s.body} onChange={(v) => update(idx, { body: v })} rows={2} placeholder="Description" />
          <Input
            value={s.code ?? ""}
            onChange={(v) => update(idx, { code: v })}
            placeholder="Snippet de code (optionnel)"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full py-2 rounded-md border-2 border-dashed border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)] flex items-center justify-center gap-1"
      >
        <Plus size={12} /> Ajouter une compétence
      </button>
    </div>
  );
}

function SeekingList({
  items,
  onChange,
}: {
  items: CVStorySeekingItem[];
  onChange: (v: CVStorySeekingItem[]) => void;
}) {
  const update = (idx: number, patch: Partial<CVStorySeekingItem>) =>
    onChange(items.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, { label: "", value: "" }]);

  return (
    <div className="space-y-2">
      {items.map((s, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <Input value={s.label} onChange={(v) => update(idx, { label: v })} placeholder="Stage" />
          <Input value={s.value} onChange={(v) => update(idx, { value: v })} placeholder="Mars 2026" />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full py-2 rounded-md border-2 border-dashed border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)] flex items-center justify-center gap-1"
      >
        <Plus size={12} /> Ajouter une ligne
      </button>
    </div>
  );
}
