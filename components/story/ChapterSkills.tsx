"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { CVSkillItem, CVQuizContent, CVStoryContent } from "@/models/CVSection";

type Props = {
  skills: CVSkillItem[];
  quiz?: CVQuizContent | null;
  story: CVStoryContent["skills"];
};

const LEVEL_DOT: Record<CVSkillItem["level"], string> = {
  Expert: "bg-[#FF9E64]",
  Avancé: "bg-[#2E9FD8]",
  Intermédiaire: "bg-[#A78BFA]",
  Débutant: "bg-white/60",
};

type Choice = { id: string; label: string; levelDot?: string };

type Round = {
  id: string;
  question: string;
  hint?: string;
  choices: Choice[];
  correctChoiceId: string;
  source: "quiz" | "skills";
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRounds(skills: CVSkillItem[], quiz?: CVQuizContent | null): Round[] {
  // Priorité au quiz CMS si présent et valide
  const cmsQuestions = (quiz?.items ?? []).filter(
    (q) =>
      q.question?.trim() &&
      Array.isArray(q.choices) &&
      q.choices.length >= 2 &&
      q.choices.every((c) => c?.trim()) &&
      q.correctIndex >= 0 &&
      q.correctIndex < q.choices.length
  );

  if (cmsQuestions.length > 0) {
    return shuffle(cmsQuestions).map((q) => {
      const choices: Choice[] = q.choices.map((c, i) => ({
        id: `${q.id}-${i}`,
        label: c,
      }));
      const correctChoiceId = choices[q.correctIndex].id;
      return {
        id: q.id,
        question: q.question,
        hint: q.hint,
        choices: shuffle(choices),
        correctChoiceId,
        source: "quiz" as const,
      };
    });
  }

  // Fallback : devine la compétence à partir de la bug story
  const withBug = skills.filter((s) => s.bugStory && s.bugStory.trim().length > 0);
  return shuffle(withBug).map((skill) => {
    const distractors = shuffle(skills.filter((s) => s.id !== skill.id)).slice(0, 3);
    const all = shuffle([skill, ...distractors]);
    const choices: Choice[] = all.map((s) => ({
      id: s.id,
      label: s.name,
      levelDot: LEVEL_DOT[s.level],
    }));
    return {
      id: skill.id,
      question: skill.bugStory ?? "",
      hint: `${skill.years} · ${skill.category}`,
      choices,
      correctChoiceId: skill.id,
      source: "skills" as const,
    };
  });
}

export function ChapterSkills({ skills, quiz, story }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const [rounds, setRounds] = useState<Round[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRounds(buildRounds(skills, quiz));
  }, [skills, quiz]);

  const current = rounds[index];
  const total = rounds.length;
  const isDone = total > 0 && index >= total;
  const progress = total > 0 ? (index / total) * 100 : 0;

  const sortedRefSkills = useMemo(
    () =>
      [...skills].sort((a, b) => {
        const order: CVSkillItem["level"][] = ["Expert", "Avancé", "Intermédiaire", "Débutant"];
        return order.indexOf(a.level) - order.indexOf(b.level);
      }),
    [skills]
  );

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".skills-header > *",
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.1,
          scrollTrigger: {
            trigger: ".skills-header",
            start: "top 80%",
            end: "top 50%",
            scrub: 0.8,
          },
        }
      );

      gsap.fromTo(
        ".skills-game",
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          scrollTrigger: {
            trigger: ".skills-game",
            start: "top 85%",
            end: "top 60%",
            scrub: 0.6,
          },
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!cardRef.current || isDone) return;
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 20, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power2.out" }
    );
  }, [index, isDone]);

  const handlePick = (choiceId: string) => {
    if (revealed || !current) return;
    setPicked(choiceId);
    setRevealed(true);
    if (choiceId === current.correctChoiceId) setScore((s) => s + 1);
  };

  const handleNext = () => {
    setPicked(null);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  const handleRestart = () => {
    setRounds(buildRounds(skills, quiz));
    setIndex(0);
    setScore(0);
    setPicked(null);
    setRevealed(false);
  };

  const eyebrowLabel = current?.source === "quiz" ? "Question" : "Bug story";
  const introText = quiz?.intro?.trim() || story.subtitle;

  return (
    <section
      ref={rootRef}
      id="skills"
      className="relative w-full overflow-hidden bg-[#0a0a0b] py-32 text-white"
    >
      <div className="mx-auto max-w-5xl px-6">
        <div className="skills-header mb-16 text-center">
          <p className="mb-6 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.4em] text-[#FF9E64]/80">
            — {story.eyebrow}
          </p>
          <h2 className="font-[var(--font-fraunces)] text-[clamp(2.5rem,6vw,5rem)] font-light leading-[1.05]">
            {story.title}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base italic text-white/50 sm:text-lg">
            {introText}
          </p>
        </div>

        <div className="skills-game">
          <div className="mb-6 flex items-center justify-between font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-white/40">
            <span>
              Question {Math.min(index + 1, total)} / {total}
            </span>
            <span>
              Score · <span className="text-[#FF9E64]">{score}</span>
            </span>
          </div>
          <div className="mb-10 h-px w-full overflow-hidden bg-white/10">
            <div
              className="h-full bg-[#FF9E64] transition-all duration-500"
              style={{ width: `${isDone ? 100 : progress}%` }}
            />
          </div>

          {total === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-white/40">
              Préparation du jeu…
            </div>
          )}

          {!isDone && current && (
            <div
              ref={cardRef}
              className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 md:p-12"
            >
              <p className="mb-4 font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-white/40">
                — {eyebrowLabel}
              </p>
              <p className="font-[var(--font-fraunces)] text-[clamp(1.2rem,2.2vw,1.8rem)] font-light leading-snug text-white/90">
                {current.source === "skills" ? `« ${current.question} »` : current.question}
              </p>

              <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {current.choices.map((choice) => {
                  const isCorrect = choice.id === current.correctChoiceId;
                  const isPicked = choice.id === picked;
                  let style =
                    "border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.05]";
                  if (revealed) {
                    if (isCorrect)
                      style = "border-[#34D399]/60 bg-[#34D399]/[0.08] text-white";
                    else if (isPicked)
                      style = "border-[#F87171]/50 bg-[#F87171]/[0.06] text-white/60";
                    else style = "border-white/5 bg-white/[0.01] text-white/30";
                  }
                  return (
                    <button
                      key={choice.id}
                      onClick={() => handlePick(choice.id)}
                      disabled={revealed}
                      className={`flex items-center gap-3 rounded-2xl border px-5 py-4 text-left transition-all ${style}`}
                    >
                      {choice.levelDot && (
                        <span className={`h-1.5 w-1.5 rounded-full ${choice.levelDot}`} />
                      )}
                      <span className="font-[var(--font-fraunces)] text-lg font-light">
                        {choice.label}
                      </span>
                      {revealed && isCorrect && (
                        <span className="ml-auto font-[var(--font-jetbrains)] text-[10px] uppercase tracking-wider text-[#34D399]">
                          ✓ bonne réponse
                        </span>
                      )}
                      {revealed && isPicked && !isCorrect && (
                        <span className="ml-auto font-[var(--font-jetbrains)] text-[10px] uppercase tracking-wider text-[#F87171]">
                          ✗
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {revealed && (
                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
                  <span className="font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-white/40">
                    {current.hint || ""}
                  </span>
                  <button
                    onClick={handleNext}
                    className="group inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:border-[#FF9E64] hover:text-[#FF9E64]"
                  >
                    {index + 1 < total ? "Suivant" : "Voir le score"}
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {isDone && (
            <div className="rounded-3xl border border-[#FF9E64]/20 bg-gradient-to-br from-[#FF9E64]/[0.08] to-transparent p-10 text-center md:p-14">
              <p className="mb-4 font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-[#FF9E64]">
                — Fin de partie
              </p>
              <p className="font-[var(--font-fraunces)] text-5xl font-extralight leading-none text-white">
                {score}
                <span className="text-white/30"> / {total}</span>
              </p>
              <p className="mx-auto mt-6 max-w-md text-base italic text-white/60">
                {score === total
                  ? "Sans faute. T'as l'œil — ou t'as bien lu mon LinkedIn."
                  : score >= total / 2
                    ? "Pas mal. Le dev, c'est 80 % de bugs et 20 % d'humour."
                    : "On apprend en cassant. C'est comme ça que j'ai appris aussi."}
              </p>
              <button
                onClick={handleRestart}
                className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:border-[#FF9E64] hover:text-[#FF9E64]"
              >
                Rejouer
              </button>
            </div>
          )}
        </div>

        <div className="mt-20 border-t border-white/5 pt-12">
          <p className="mb-6 text-center font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-white/30">
            — Stack complète
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {sortedRefSkills.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-white/60"
              >
                <span className={`h-1 w-1 rounded-full ${LEVEL_DOT[s.level]}`} />
                {s.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
