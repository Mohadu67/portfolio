"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { CVExperienceItem, CVStoryContent } from "@/models/CVSection";

type Props = {
  experiences: CVExperienceItem[];
  story: CVStoryContent["kitchens"];
};

function isKitchen(exp: CVExperienceItem) {
  const c = (exp.company || "").toLowerCase();
  return c.includes("kfc") || c.includes("pizza hut");
}

function formatPeriod(start: string, end: string) {
  const fmt = (d: string) => {
    if (!d) return "";
    if (d.toLowerCase().includes("présent") || d.toLowerCase().includes("present")) return "Présent";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  };
  return `${fmt(start)} — ${fmt(end)}`;
}

function computeDuration(start: string, end: string): string {
  const parse = (d: string) => {
    if (!d) return null;
    if (d.toLowerCase().includes("présent") || d.toLowerCase().includes("present")) return new Date();
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  };
  const s = parse(start);
  const e = parse(end);
  if (!s || !e) return "";
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (months < 1) return "< 1 mois";
  if (months < 12) return `${months} mois`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} an${y > 1 ? "s" : ""}` : `${y} an${y > 1 ? "s" : ""} ${m} mois`;
}

function parseMissions(details: string): string[] {
  if (!details) return [];
  return details
    .split(/[.•\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 5);
}

const ROLE_TAGS: Record<string, string[]> = {
  "manager": ["Équipe", "Service", "Hygiène"],
  "rgm": ["Stocks", "Marketing", "P&L"],
  "responsable": ["Stocks", "Marketing", "P&L"],
};

function getTags(position: string): string[] {
  const p = position.toLowerCase();
  if (p.includes("rgm") || p.includes("responsable")) return ROLE_TAGS.rgm;
  if (p.includes("manager")) return ROLE_TAGS.manager;
  return [];
}

export function ChapterKitchens({ experiences, story }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const kitchens = experiences.filter(isKitchen);

  useEffect(() => {
    if (!trackRef.current || !rootRef.current) return;
    if (kitchens.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".kitchens-intro",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: ".kitchens-intro",
            start: "top 80%",
            end: "top 50%",
            scrub: 0.8,
          },
        }
      );

      gsap.fromTo(
        ".kitchens-transfer-eyebrow, .kitchens-transfer-title, .kitchens-transfer-intro",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.1,
          scrollTrigger: {
            trigger: ".kitchens-transfer-title",
            start: "top 85%",
            end: "top 55%",
            scrub: 0.8,
          },
        }
      );

      gsap.utils.toArray<HTMLElement>(".kitchens-transfer-card").forEach((card) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            scrollTrigger: {
              trigger: card,
              start: "top 92%",
              end: "top 75%",
              scrub: 0.6,
            },
          }
        );
      });

      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        const track = trackRef.current!;
        const getDistance = () => track.scrollWidth - window.innerWidth;

        gsap.to(track, {
          x: () => -getDistance(),
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top top",
            end: () => `+=${getDistance()}`,
            pin: true,
            pinSpacing: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
      });
    }, rootRef);

    const timer = setTimeout(() => ScrollTrigger.refresh(), 200);

    return () => {
      clearTimeout(timer);
      ctx.revert();
    };
  }, [kitchens.length]);

  if (kitchens.length === 0) return null;

  return (
    <section
      ref={rootRef}
      id="kitchens"
      className="relative w-full overflow-hidden bg-gradient-to-b from-[#0a0a0b] via-[#150c0a] to-[#1a0e0a] text-white"
    >
      <div className="kitchens-intro px-6 pt-32 pb-20 text-center">
        <p className="mb-6 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.4em] text-[#FF9E64]/80">
          — {story.eyebrow}
        </p>
        <h2 className="mx-auto max-w-4xl font-[var(--font-fraunces)] text-[clamp(2.5rem,7vw,5.5rem)] font-light leading-[1.05]">
          {story.title}
        </h2>
        <p className="mx-auto mt-8 max-w-2xl text-base text-white/60 sm:text-lg">
          {story.intro}
        </p>
      </div>

      {/* Track horizontal — desktop pinné, mobile scroll normal */}
      <div className="md:h-screen md:overflow-hidden">
        <div
          ref={trackRef}
          className="flex flex-col gap-8 px-6 pb-20 md:h-screen md:flex-row md:items-center md:gap-12 md:px-[20vw] md:pb-0"
        >
          {kitchens.map((exp, i) => {
            const missions = parseMissions(exp.details || exp.description);
            const tags = getTags(exp.position);
            const duration = computeDuration(exp.startDate, exp.endDate);
            const startYear = exp.startDate?.split("-")[0] || "";
            const endYear = exp.endDate?.split("-")[0] || "";

            return (
              <article
                key={exp.id}
                className="kitchen-card group relative flex w-full shrink-0 flex-col rounded-3xl border border-[#FF9E64]/20 bg-[#1c1208] shadow-2xl md:w-[480px]"
                style={{ opacity: 1, transform: "none" }}
              >
                {/* halo orange au hover — clippé proprement */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                  <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,158,100,0.18),transparent_60%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
                </div>

                {/* Header — chapitre + années en gros */}
                <div className="relative z-10 flex items-start justify-between border-b border-white/5 px-8 pt-8 pb-6 md:px-10">
                  <div>
                    <span className="font-[var(--font-jetbrains)] text-[9px] uppercase tracking-[0.3em] text-[#FF9E64]/60">
                      Chap. {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="mt-3 font-[var(--font-fraunces)] text-5xl font-extralight leading-none text-white">
                      {startYear}
                      {endYear && endYear !== startYear && (
                        <span className="text-white/30">→{endYear.slice(-2)}</span>
                      )}
                    </div>
                  </div>
                  {duration && (
                    <span className="rounded-full border border-[#FF9E64]/30 bg-[#FF9E64]/[0.06] px-3 py-1 font-[var(--font-jetbrains)] text-[10px] uppercase tracking-wider text-[#FF9E64]">
                      {duration}
                    </span>
                  )}
                </div>

                {/* Corps */}
                <div className="relative z-10 flex flex-col px-8 pb-8 pt-6 md:px-10 md:pb-10">
                  <h3 className="font-[var(--font-fraunces)] text-2xl font-light leading-tight md:text-3xl">
                    {exp.position}
                  </h3>
                  <p className="mt-1 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.2em] text-[#FF9E64]">
                    {exp.company}
                  </p>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 font-[var(--font-jetbrains)] text-[9px] uppercase tracking-wider text-white/75"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Missions clés */}
                  {missions.length > 0 && (
                    <ul className="mt-6 space-y-3 text-[15px] text-white">
                      {missions.map((m, k) => (
                        <li key={k} className="flex gap-3">
                          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9E64]" />
                          <span className="leading-relaxed text-white/90">{m}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Footer période */}
                  <div className="flex items-center gap-3 pt-8">
                    <span className="h-px w-8 bg-[#FF9E64]/60" />
                    <span className="font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-white/65">
                      {formatPeriod(exp.startDate, exp.endDate)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-24 text-center">
        <p className="mx-auto max-w-2xl font-[var(--font-fraunces)] text-[clamp(1.5rem,3vw,2.5rem)] font-light italic leading-tight text-white/70">
          {story.outro}
        </p>
      </div>

      {/* Transfert : ce que la cuisine m'a appris pour le dev */}
      <div className="relative px-6 pb-32 pt-12">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="kitchens-transfer-eyebrow mb-6 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.4em] text-[#FF9E64]/80">
              — Le pont
            </p>
            <h3 className="kitchens-transfer-title font-[var(--font-fraunces)] text-[clamp(1.8rem,4vw,3rem)] font-light leading-[1.15]">
              {story.transferTitle}
            </h3>
            <p className="kitchens-transfer-intro mt-6 text-base leading-relaxed text-white/55 sm:text-lg">
              {story.transferIntro}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {story.transferSkills.map((s, i) => (
              <div
                key={s.title}
                className="kitchens-transfer-card group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-[#FF9E64]/40 hover:bg-white/[0.04]"
              >
                <span className="absolute right-4 top-4 font-[var(--font-jetbrains)] text-[9px] uppercase tracking-[0.3em] text-white/20">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h4 className="font-[var(--font-fraunces)] text-xl font-light leading-snug text-white sm:text-2xl">
                  {s.title}
                </h4>
                <p className="mt-4 text-sm leading-relaxed text-white/55">{s.body}</p>
                <pre className="pointer-events-none mt-5 font-[var(--font-jetbrains)] text-[11px] text-[#FF9E64]/60">
                  {s.code}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
