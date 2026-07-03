"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { CVStoryContent } from "@/models/CVSection";

type Props = { story: CVStoryContent["doubleLife"] };

export function ChapterDoubleLife({ story }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Split panels reveal puis nuit qui dévore le jour
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "+=200%",
          pin: true,
          scrub: 1,
        },
      });

      tl.fromTo(
        ".dl-day",
        { xPercent: -10, opacity: 0 },
        { xPercent: 0, opacity: 1, duration: 1 }
      )
        .fromTo(
          ".dl-night",
          { xPercent: 10, opacity: 0 },
          { xPercent: 0, opacity: 1, duration: 1 },
          "<"
        )
        .to({}, { duration: 0.5 }) // hold
        .to(".dl-day", { xPercent: -100, duration: 1.2, ease: "power2.in" })
        .to(".dl-night", { width: "100%", duration: 1.2, ease: "power2.inOut" }, "<")
        .to(
          ".dl-night-content",
          { scale: 1.05, duration: 1.2 },
          "<"
        );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      id="double-life"
      className="relative h-screen w-full overflow-hidden"
    >
      <p className="absolute left-1/2 top-10 z-30 -translate-x-1/2 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.4em] text-white/50">
        — {story.eyebrow}
      </p>

      {/* JOUR — gauche, chaud */}
      <div className="dl-day absolute inset-y-0 left-0 z-10 flex w-1/2 flex-col justify-center bg-gradient-to-br from-[#2a1208] via-[#3a1a0c] to-[#1a0a06] px-8 md:px-16">
        <span className="font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-[#FF9E64]/70">
          06:00 — 22:00
        </span>
        <h3 className="mt-4 font-[var(--font-fraunces)] text-[clamp(2rem,5vw,4rem)] font-light leading-[1.05] text-white">
          {story.day.title}
        </h3>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-white/60 md:text-base">
          {story.day.body}
        </p>
        <div className="mt-10 flex gap-3 text-[10px] uppercase tracking-[0.3em] text-white/40">
          <span>plannings</span>
          <span>·</span>
          <span>stocks</span>
          <span>·</span>
          <span>équipes</span>
        </div>
      </div>

      {/* NUIT — droite, froid, va envahir tout */}
      <div className="dl-night absolute inset-y-0 right-0 z-20 w-1/2 overflow-hidden bg-gradient-to-bl from-[#0a0e1a] via-[#0d1322] to-[#050810]">
        <div className="dl-night-content flex h-full flex-col justify-center px-8 md:px-16">
          <span className="font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-[#2E9FD8]/80">
            23:00 — 03:00
          </span>
          <h3 className="mt-4 font-[var(--font-fraunces)] text-[clamp(2rem,5vw,4rem)] font-light leading-[1.05] text-white">
            {story.night.title}
          </h3>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-white/60 md:text-base">
            {story.night.body}
          </p>
          <div className="mt-10 flex flex-wrap gap-3 font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-white/40">
            <span>html</span>
            <span>css</span>
            <span>js</span>
            <span>youtube</span>
            <span>mdn</span>
            <span>stackoverflow</span>
          </div>

          {/* Faux code en background — masqué sur mobile : lisible sur écrans OLED malgré
              l'opacité, et il chevauche le contenu de la section. */}
          <pre className="pointer-events-none absolute right-0 bottom-0 hidden select-none p-8 font-[var(--font-jetbrains)] leading-relaxed text-white/[0.04] md:block md:text-xs">
{`function dreamBig() {
  while (night) {
    learn();
    build();
    fail();
    learn();
  }
  return future;
}`}
          </pre>
        </div>
      </div>
    </section>
  );
}
