"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STORY } from "@/data/story";
import type { CVProjectItem } from "@/models/CVSection";

type Props = { projects: CVProjectItem[] };

const PROJECT_HUES = [
  "from-[#FF9E64]/20 to-[#FF9E64]/5",
  "from-[#2E9FD8]/20 to-[#2E9FD8]/5",
  "from-[#A78BFA]/20 to-[#A78BFA]/5",
  "from-[#34D399]/20 to-[#34D399]/5",
];

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ChapterProjects({ projects }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!trackRef.current || projects.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".projects-intro > *",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.1,
          scrollTrigger: {
            trigger: ".projects-intro",
            start: "top 80%",
            end: "top 50%",
            scrub: 0.8,
          },
        }
      );

      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        const track = trackRef.current!;
        const getDistance = () => Math.max(0, track.scrollWidth - window.innerWidth);

        gsap.to(track, {
          x: () => -getDistance(),
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top top",
            end: () => `+=${getDistance() + window.innerHeight * 0.5}`,
            pin: true,
            pinSpacing: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
      });
    }, rootRef);

    // Refresh après mount + après chargement des images
    const timer = setTimeout(() => ScrollTrigger.refresh(), 250);
    const imgs = Array.from(rootRef.current?.querySelectorAll("img") ?? []);
    const onAllLoaded = () => ScrollTrigger.refresh();
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener("load", onAllLoaded, { once: true });
    });

    return () => {
      clearTimeout(timer);
      imgs.forEach((img) => img.removeEventListener("load", onAllLoaded));
      ctx.revert();
    };
  }, [projects.length]);

  if (projects.length === 0) return null;

  return (
    <section
      ref={rootRef}
      id="projects"
      className="relative w-full overflow-hidden bg-[#0a0a0b] text-white"
    >
      <div className="projects-intro px-6 pt-28 pb-12 text-center">
        <p className="mb-6 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.4em] text-[#2E9FD8]/80">
          — {STORY.projects.eyebrow}
        </p>
        <h2 className="mx-auto max-w-4xl font-[var(--font-fraunces)] text-[clamp(2.5rem,7vw,5.5rem)] font-light leading-[1.05]">
          {STORY.projects.title}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base italic text-white/50 sm:text-lg">
          {STORY.projects.subtitle}
        </p>
      </div>

      <div className="md:h-screen md:overflow-hidden">
        <div
          ref={trackRef}
          className="flex flex-col gap-10 px-6 pb-32 md:h-screen md:flex-row md:items-center md:gap-16 md:px-[10vw] md:pb-0"
        >
          {projects.map((proj, i) => (
            <ProjectCard key={proj.id} proj={proj} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({ proj, index }: { proj: CVProjectItem; index: number }) {
  const hostname = proj.url ? hostnameOf(proj.url) : "";
  const hue = PROJECT_HUES[index % PROJECT_HUES.length];

  const cardClass =
    "project-card group relative flex w-full shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d1117] no-underline text-white transition-all hover:border-white/25 hover:shadow-[0_30px_80px_-20px_rgba(46,159,216,0.25)] md:h-[62vh] md:max-h-[640px] md:w-[78vw] md:max-w-[1080px] md:flex-row";

  const inner = (
    <>
      {/* Visuel — mockup browser */}
      <div
        className={`project-visual relative h-[300px] w-full overflow-hidden bg-gradient-to-br ${hue} md:h-full md:w-[58%]`}
      >
        {/* Browser chrome */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-white/5 bg-black/50 px-4 py-2.5 backdrop-blur-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]/80" />
          {hostname && (
            <div className="ml-3 flex flex-1 items-center gap-2 rounded-md bg-white/[0.06] px-3 py-1 font-[var(--font-jetbrains)] text-[10px] text-white/60">
              <span className="text-[#28C840]">●</span>
              <span className="truncate">{hostname}</span>
            </div>
          )}
        </div>

        {/* Image container avec padding-top pour la chrome */}
        <div className="absolute inset-x-0 bottom-0 top-[44px] flex items-start justify-center bg-[#0a0a0b]">
          {proj.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proj.image}
              alt={`Capture de ${proj.name}`}
              className="h-full w-full object-contain object-top transition-transform duration-[1200ms] ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-[var(--font-fraunces)] text-7xl font-extralight text-white/15">
              {String(index + 1).padStart(2, "0")}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="project-info flex flex-1 flex-col p-8 md:p-10">
        <h3 className="font-[var(--font-fraunces)] text-3xl font-light leading-tight md:text-4xl">
          {proj.name}
        </h3>
        <p className="mt-5 text-sm leading-relaxed text-white/70 md:text-base">
          {proj.description}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {proj.stack.map((tech) => (
            <span
              key={tech}
              className="rounded-full border border-white/10 px-3 py-1 font-[var(--font-jetbrains)] text-[10px] uppercase tracking-wider text-white/70"
            >
              {tech}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-4 pt-6">
          {proj.url && (
            <span className="inline-flex items-center gap-2 font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.2em] text-white transition-colors group-hover:text-[#FF9E64]">
              Voir le projet
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </span>
          )}
          {proj.credentials && (proj.credentials.email || proj.credentials.password) && (
            <span className="font-[var(--font-jetbrains)] text-[10px] text-white/40">
              demo · {proj.credentials.email}
            </span>
          )}
        </div>
      </div>
    </>
  );

  // Card cliquable si url, sinon simple article
  if (proj.url) {
    return (
      <a
        href={proj.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ouvrir ${proj.name} dans un nouvel onglet`}
        className={`${cardClass} cursor-pointer`}
      >
        {inner}
      </a>
    );
  }

  return <article className={cardClass}>{inner}</article>;
}
