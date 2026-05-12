"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { CVEducationItem, CVExperienceItem, CVStoryContent } from "@/models/CVSection";

type Props = {
  education: CVEducationItem[];
  experiences: CVExperienceItem[];
  story: CVStoryContent["present"];
};

function findCDA(ed: CVEducationItem[]) {
  return ed.find((e) =>
    (e.degree + " " + e.field).toLowerCase().includes("concepteur") ||
    (e.degree || "").toLowerCase().includes("cda")
  );
}

function findRecent(exp: CVExperienceItem[]) {
  return exp.find((e) => {
    const c = (e.company || "").toLowerCase();
    return !(c.includes("kfc") || c.includes("pizza hut"));
  });
}

export function ChapterPresent({ education, experiences, story }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);

  const cda = findCDA(education);
  const recent = findRecent(experiences);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".present-header > *",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.1,
          scrollTrigger: {
            trigger: ".present-header",
            start: "top 80%",
            end: "top 50%",
            scrub: 0.8,
          },
        }
      );

      gsap.utils.toArray<HTMLElement>(".present-card").forEach((card, i) => {
        gsap.fromTo(
          card,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              end: "top 60%",
              scrub: 0.8,
            },
          }
        );
      });

      // Breathing effect sur la dispo
      gsap.to(".present-dispo-dot", {
        scale: 1.4,
        opacity: 0.5,
        duration: 1.5,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      id="present"
      className="relative w-full overflow-hidden bg-gradient-to-b from-[#0a0a0b] to-[#0c1118] py-32 text-white"
    >
      <div className="mx-auto max-w-5xl px-6">
        <div className="present-header mb-20 text-center">
          <p className="mb-6 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.4em] text-[#34D399]/80">
            — {story.eyebrow}
          </p>
          <h2 className="font-[var(--font-fraunces)] text-[clamp(2.5rem,6vw,5rem)] font-light leading-[1.05]">
            {story.title}
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
            {story.body}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* CDA card */}
          {cda && (
            <div className="present-card relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-8 md:p-10">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#34D399]/10 blur-3xl" />
              <span className="font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-[#34D399]">
                En cours · {cda.period}
              </span>
              <h3 className="mt-6 font-[var(--font-fraunces)] text-3xl font-light leading-tight">
                {cda.degree}
              </h3>
              <p className="mt-2 text-sm text-white/50">{cda.school}</p>
              <p className="mt-6 text-sm leading-relaxed text-white/60">
                {cda.description}
              </p>
            </div>
          )}

          {/* MobiStras / récente */}
          {recent && (
            <div className="present-card relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-8 md:p-10">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#A78BFA]/10 blur-3xl" />
              <span className="font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-[#A78BFA]">
                Expérience humaine
              </span>
              <h3 className="mt-6 font-[var(--font-fraunces)] text-3xl font-light leading-tight">
                {recent.position}
              </h3>
              <p className="mt-2 text-sm text-white/50">{recent.company}</p>
              <p className="mt-6 text-sm leading-relaxed text-white/60">
                {recent.description}
              </p>
            </div>
          )}
        </div>

        {/* Dispo — masquable via le CMS */}
        {story.seekingEnabled && story.seekingItems.length > 0 && (
          <div className="present-card mt-12 overflow-hidden rounded-3xl border border-[#FF9E64]/20 bg-gradient-to-br from-[#FF9E64]/[0.08] to-transparent p-8 md:p-12">
            <div className="flex items-center gap-3 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.4em] text-[#FF9E64]">
              <span className="present-dispo-dot h-2 w-2 rounded-full bg-[#FF9E64]" />
              {story.seekingTitle}
            </div>
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              {story.seekingItems.map((item, i) => (
                <div key={`${item.label}-${i}`}>
                  <p className="font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.3em] text-white/40">
                    {item.label}
                  </p>
                  <p className="mt-3 font-[var(--font-fraunces)] text-3xl font-light leading-tight md:text-4xl">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
