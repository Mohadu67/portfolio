"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { CVStoryContent } from "@/models/CVSection";

type Props = { story: CVStoryContent["leap"] };

const STACK_BUBBLES = [
  { label: "HTML", x: -260, y: -140, delay: 0 },
  { label: "CSS", x: 240, y: -180, delay: 0.1 },
  { label: "JavaScript", x: -300, y: 60, delay: 0.2 },
  { label: "PHP", x: 280, y: 80, delay: 0.3 },
  { label: "React", x: -180, y: 200, delay: 0.4 },
  { label: "SQL", x: 200, y: 220, delay: 0.5 },
  { label: "Git", x: 0, y: -240, delay: 0.6 },
];

export function ChapterLeap({ story }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top 80%",
          end: "bottom 60%",
          scrub: 1,
        },
      });

      tl.fromTo(
        ".leap-year",
        { scale: 3, opacity: 0, letterSpacing: "0.5em" },
        { scale: 1, opacity: 1, letterSpacing: "0em", duration: 1, ease: "power3.out" }
      )
        .fromTo(
          ".leap-title",
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8 },
          "-=0.3"
        )
        .fromTo(
          ".leap-body",
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8 },
          "-=0.4"
        )
        .fromTo(
          ".leap-badge",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 },
          "-=0.4"
        )
        .fromTo(
          ".leap-bubble",
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 1,
            stagger: 0.07,
            ease: "back.out(1.4)",
          },
          "-=0.5"
        );

      // Flottement permanent sur l'enfant (jamais sur l'élément positionné)
      gsap.utils.toArray<HTMLElement>(".leap-bubble-inner").forEach((b, i) => {
        gsap.to(b, {
          y: gsap.utils.random(-10, 10),
          x: gsap.utils.random(-6, 6),
          duration: gsap.utils.random(3.5, 5.5),
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: i * 0.2,
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      id="leap"
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-[#050810] via-[#0a0a0b] to-[#0a0a0b] py-32 text-white"
    >
      {/* Bulles stack flottantes — position absolue figée, float sur enfant */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 hidden h-0 w-0 md:block">
        {STACK_BUBBLES.map((b) => (
          <span
            key={b.label}
            className="leap-bubble absolute inline-block"
            style={{
              left: 0,
              top: 0,
              transform: `translate(calc(-50% + ${b.x}px), calc(-50% + ${b.y}px))`,
            }}
          >
            <span className="leap-bubble-inner inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 font-[var(--font-jetbrains)] text-xs uppercase tracking-wider text-white/80 backdrop-blur-sm">
              {b.label}
            </span>
          </span>
        ))}
      </div>

      <div className="relative z-10 flex max-w-3xl flex-col items-center px-6 text-center">
        <p className="mb-6 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.4em] text-[#2E9FD8]/80">
          — {story.eyebrow}
        </p>
        <span className="leap-year mb-6 inline-block font-[var(--font-fraunces)] text-[clamp(4rem,12vw,9rem)] font-extralight leading-none text-white">
          {story.year}
        </span>
        <h2 className="leap-title font-[var(--font-fraunces)] text-[clamp(2rem,5vw,4rem)] font-light leading-[1.1]">
          {story.title}
        </h2>
        <p className="leap-body mt-8 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
          {story.body}
        </p>
        <div className="leap-badge mt-10 inline-flex items-center gap-3 rounded-full border border-[#2E9FD8]/30 bg-[#2E9FD8]/[0.08] px-5 py-2.5 font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.2em] text-[#2E9FD8]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2E9FD8]" />
          {story.badge}
        </div>
      </div>
    </section>
  );
}
