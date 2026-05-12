"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { CVStoryContent } from "@/models/CVSection";

type Props = { story: CVStoryContent["rupture"] };

export function ChapterRupture({ story }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Année qui pulse subtilement avec le scroll (kenburns)
      gsap.fromTo(
        ".rupture-year",
        { scale: 1.15, opacity: 0.05 },
        {
          scale: 1,
          opacity: 0.14,
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 1,
          },
        }
      );

      // Lignes mot par mot
      const lines = gsap.utils.toArray<HTMLElement>(".rupture-line");
      lines.forEach((line) => {
        const words = line.querySelectorAll<HTMLSpanElement>("[data-word]");
        gsap.fromTo(
          words,
          { opacity: 0.05, y: 18, filter: "blur(8px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            stagger: 0.06,
            ease: "power2.out",
            scrollTrigger: {
              trigger: line,
              start: "top 80%",
              end: "top 40%",
              scrub: 0.6,
            },
          }
        );
      });

      // Closing line
      gsap.fromTo(
        ".rupture-closing",
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ".rupture-closing",
            start: "top 80%",
            end: "top 55%",
            scrub: 0.8,
          },
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      id="rupture"
      className="relative w-full overflow-hidden bg-[#0a0a0b] py-32 text-white md:py-48"
    >
      {/* Année gigantesque en filigrane derrière */}
      <span
        aria-hidden
        className="rupture-year pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none font-[var(--font-fraunces)] text-[clamp(12rem,42vw,32rem)] font-extralight leading-none text-white/10"
      >
        {story.year}
      </span>

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <p className="mb-12 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.4em] text-[#FF9E64]/80">
          — {story.eyebrow}
        </p>

        <div className="flex max-w-3xl flex-col gap-6 font-[var(--font-fraunces)] text-[clamp(1.8rem,4.5vw,3.5rem)] font-light leading-[1.15]">
          {story.lines.map((line, i) => (
            <p key={i} className="rupture-line">
              {line.split(" ").map((word, j) => (
                <span key={j} data-word className="mr-[0.25em] inline-block">
                  {word}
                </span>
              ))}
            </p>
          ))}
        </div>

        <p className="rupture-closing mt-20 max-w-xl text-base italic text-white/50 sm:text-lg">
          {story.closing}
        </p>
      </div>
    </section>
  );
}
