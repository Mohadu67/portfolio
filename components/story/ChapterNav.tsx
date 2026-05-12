"use client";

import { useEffect, useState } from "react";
import { CHAPTERS } from "@/data/story";

export function ChapterNav() {
  const [active, setActive] = useState<string>("hero");

  useEffect(() => {
    const els = CHAPTERS.map((c) => document.getElementById(c.id)).filter(
      Boolean
    ) as HTMLElement[];

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { threshold: [0.35, 0.6] }
    );

    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <nav
      aria-label="Chapitres"
      className="fixed right-5 top-1/2 z-50 hidden -translate-y-1/2 flex-col gap-3 md:flex"
    >
      {CHAPTERS.map((c) => (
        <a
          key={c.id}
          href={`#${c.id}`}
          className="group relative flex items-center justify-end gap-3"
          aria-label={c.label}
        >
          <span
            className={`font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.25em] transition-opacity ${
              active === c.id ? "opacity-100 text-white" : "opacity-0 text-white/50 group-hover:opacity-70"
            }`}
          >
            {c.label}
          </span>
          <span
            className={`block h-px transition-all duration-500 ${
              active === c.id
                ? "w-8 bg-[#FF9E64]"
                : "w-3 bg-white/30 group-hover:w-5 group-hover:bg-white/60"
            }`}
          />
        </a>
      ))}
    </nav>
  );
}
