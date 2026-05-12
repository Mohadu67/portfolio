"use client";

import { Plus, Trash2, ChevronUp, ChevronDown, Check } from "lucide-react";
import type { CVQuizQuestion } from "@/models/CVSection";

interface QuizEditorProps {
  questions: CVQuizQuestion[];
  onChange: (questions: CVQuizQuestion[]) => void;
}

function genId() {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function emptyQuestion(): CVQuizQuestion {
  return {
    id: genId(),
    question: "",
    hint: "",
    choices: ["", "", "", ""],
    correctIndex: 0,
  };
}

export function QuizEditor({ questions, onChange }: QuizEditorProps) {
  const update = (idx: number, patch: Partial<CVQuizQuestion>) => {
    onChange(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const updateChoice = (qIdx: number, cIdx: number, value: string) => {
    const q = questions[qIdx];
    const choices = q.choices.map((c, i) => (i === cIdx ? value : c));
    update(qIdx, { choices });
  };

  const addChoice = (qIdx: number) => {
    const q = questions[qIdx];
    if (q.choices.length >= 6) return;
    update(qIdx, { choices: [...q.choices, ""] });
  };

  const removeChoice = (qIdx: number, cIdx: number) => {
    const q = questions[qIdx];
    if (q.choices.length <= 2) return;
    const choices = q.choices.filter((_, i) => i !== cIdx);
    let correctIndex = q.correctIndex;
    if (cIdx === q.correctIndex) correctIndex = 0;
    else if (cIdx < q.correctIndex) correctIndex = q.correctIndex - 1;
    update(qIdx, { choices, correctIndex });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => onChange(questions.filter((_, i) => i !== idx));
  const add = () => onChange([...questions, emptyQuestion()]);

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => (
        <div
          key={q.id || idx}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">
              Question #{idx + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                className="p-1.5 rounded hover:bg-[var(--bg-secondary)] disabled:opacity-30"
                title="Monter"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                disabled={idx === questions.length - 1}
                className="p-1.5 rounded hover:bg-[var(--bg-secondary)] disabled:opacity-30"
                title="Descendre"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
                title="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Question
            </label>
            <textarea
              value={q.question}
              onChange={(e) => update(idx, { question: e.target.value })}
              placeholder="Pourquoi parseInt('08') retourne 0 ?"
              rows={2}
              className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Indice / contexte (optionnel)
            </label>
            <input
              type="text"
              value={q.hint ?? ""}
              onChange={(e) => update(idx, { hint: e.target.value })}
              placeholder="Bug story · JavaScript"
              className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                Réponses (clique sur ✓ pour marquer la bonne)
              </label>
              {q.choices.length < 6 && (
                <button
                  type="button"
                  onClick={() => addChoice(idx)}
                  className="text-[11px] text-[var(--accent-orange)] hover:underline inline-flex items-center gap-1"
                >
                  <Plus size={12} /> Ajouter un choix
                </button>
              )}
            </div>
            <div className="space-y-2">
              {q.choices.map((choice, cIdx) => {
                const isCorrect = q.correctIndex === cIdx;
                return (
                  <div key={cIdx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => update(idx, { correctIndex: cIdx })}
                      className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                        isCorrect
                          ? "border-[var(--accent-success)] bg-[var(--accent-success)]/15 text-[var(--accent-success)]"
                          : "border-[var(--border-color)] text-[var(--text-tertiary)] hover:border-[var(--accent-success)]/50"
                      }`}
                      title={isCorrect ? "Bonne réponse" : "Marquer comme bonne"}
                    >
                      <Check size={14} />
                    </button>
                    <input
                      type="text"
                      value={choice}
                      onChange={(e) => updateChoice(idx, cIdx, e.target.value)}
                      placeholder={`Réponse ${cIdx + 1}`}
                      className={`flex-1 px-3 py-2 rounded-md bg-[var(--bg-primary)] border text-sm focus:outline-none focus:ring-2 ${
                        isCorrect
                          ? "border-[var(--accent-success)]/40 focus:ring-[var(--accent-success)]"
                          : "border-[var(--border-color)] focus:ring-[var(--accent-orange)]"
                      }`}
                    />
                    {q.choices.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeChoice(idx, cIdx)}
                        className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10"
                        title="Retirer ce choix"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="w-full py-3 rounded-lg border-2 border-dashed border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)] flex items-center justify-center gap-2 transition-colors"
      >
        <Plus size={18} />
        <span className="text-sm font-medium">Ajouter une question</span>
      </button>
    </div>
  );
}
