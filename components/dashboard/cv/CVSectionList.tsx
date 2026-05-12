"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import type { ICVSection } from "@/models/CVSection";

interface SectionRow {
  _id: string;
  key: string;
  type: ICVSection["type"];
  title: string;
  order: number;
  isVisible: boolean;
}

function SortableItem({
  section,
  onEdit,
  onToggle,
  onDelete,
}: {
  section: SectionRow;
  onEdit: (id: string) => void;
  onToggle: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 rounded-lg border ${
        section.isVisible
          ? "bg-[var(--bg-card)] border-[var(--border-color)]"
          : "bg-[var(--bg-secondary)]/40 border-[var(--border-color)]/50 opacity-60"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 cursor-grab active:cursor-grabbing text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        aria-label="Drag to reorder"
      >
        <GripVertical size={18} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--text-primary)] truncate">{section.title}</span>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">
            {section.type}
          </span>
        </div>
      </div>

      <button
        onClick={() => onToggle(section._id, !section.isVisible)}
        className="p-2 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
        title={section.isVisible ? "Masquer la section" : "Afficher la section"}
      >
        {section.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
      </button>

      <button
        onClick={() => onEdit(section._id)}
        className="p-2 rounded hover:bg-[var(--bg-secondary)] text-[var(--accent-orange)]"
        title="Éditer"
      >
        <Pencil size={18} />
      </button>

      {(section.type === "custom" || section.type === "quiz" || section.type === "story") && (
        <button
          onClick={() => {
            if (confirm(`Supprimer la section "${section.title}" ? Cette action est définitive.`)) {
              onDelete(section._id);
            }
          }}
          className="p-2 rounded hover:bg-red-500/10 text-red-500"
          title="Supprimer"
        >
          <Trash2 size={18} />
        </button>
      )}
    </div>
  );
}

interface CVSectionListProps {
  sections: SectionRow[];
  onReorder: (order: Array<{ id: string; order: number }>) => void;
  onEdit: (id: string) => void;
  onToggle: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
}

export function CVSectionList({ sections, onReorder, onEdit, onToggle, onDelete }: CVSectionListProps) {
  const [items, setItems] = useState(sections);

  // Parent reste la source de vérité — re-sync à chaque changement de props
  useEffect(() => {
    setItems(sections);
  }, [sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i._id === active.id);
    const newIndex = items.findIndex((i) => i._id === over.id);
    const next = arrayMove(items, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }));
    setItems(next);
    onReorder(next.map((s) => ({ id: s._id, order: s.order })));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i._id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {items.map((section) => (
            <SortableItem
              key={section._id}
              section={section}
              onEdit={onEdit}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
