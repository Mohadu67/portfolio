"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { STORY } from "@/data/story";
import type { CVProfileContent } from "@/models/CVSection";

type Props = { profile: CVProfileContent };

export function ChapterHero({ profile }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const nameRef = useRef<HTMLHeadingElement | null>(null);
  const photoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const letters = nameRef.current?.querySelectorAll<HTMLSpanElement>("[data-letter]");
      if (!letters) return;

      gsap.set(letters, { opacity: 0, y: 60, rotateX: -90, filter: "blur(20px)" });

      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      tl.fromTo(
        photoRef.current,
        { opacity: 0, scale: 1.1, filter: "blur(20px)" },
        { opacity: 1, scale: 1, filter: "blur(0px)", duration: 1.3 }
      )
        .to(
          letters,
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            filter: "blur(0px)",
            stagger: 0.04,
            duration: 1.1,
          },
          "-=0.9"
        )
        .fromTo(
          ".hero-tagline",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.9 },
          "-=0.4"
        )
        .fromTo(
          ".hero-meta",
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 },
          "-=0.5"
        );

      const glitch = gsap.timeline({ repeat: -1, repeatDelay: 5, delay: 2.5 });
      glitch
        .to(nameRef.current, { skewX: 8, duration: 0.05 })
        .to(nameRef.current, { skewX: -4, duration: 0.05 })
        .to(nameRef.current, { skewX: 0, duration: 0.05 });

      // Parallaxe douce sur la photo au curseur
      const onMove = (e: MouseEvent) => {
        if (!photoRef.current) return;
        const x = (e.clientX / window.innerWidth - 0.5) * 20;
        const y = (e.clientY / window.innerHeight - 0.5) * 20;
        gsap.to(photoRef.current, { x, y, duration: 1, ease: "power2.out" });
      };
      window.addEventListener("mousemove", onMove);
      return () => window.removeEventListener("mousemove", onMove);
    }, rootRef);

    return () => ctx.revert();
  }, []);

  const name = profile.name || STORY.hero.name;
  const photo = profile.photo || "/photoCV.png";

  return (
    <section
      ref={rootRef}
      id="hero"
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#0a0a0b] px-6 text-white"
    >
      {/* grain + halo */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:3px_3px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,158,100,0.18),transparent_60%)] blur-3xl" />

      <p className="hero-meta mb-10 font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.4em] text-white/40">
        — Portfolio · 2026
      </p>

      <div
        ref={photoRef}
        className="relative mb-10 h-44 w-44 overflow-hidden rounded-full border border-white/15 shadow-[0_0_60px_-10px_rgba(255,158,100,0.4)] sm:h-52 sm:w-52"
      >
        <Image
          src={photo}
          alt={name}
          fill
          priority
          sizes="(min-width: 640px) 208px, 176px"
          className="object-cover grayscale contrast-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b]/40 via-transparent to-transparent" />
        <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
      </div>

      <h1
        ref={nameRef}
        className="font-[var(--font-fraunces)] text-[clamp(2.5rem,11vw,11rem)] font-light leading-[0.95] tracking-tight"
        style={{ perspective: "1000px" }}
        aria-label={name}
      >
        {name.split("").map((char, i) => (
          <span
            key={i}
            data-letter
            className="inline-block"
            style={{ transformStyle: "preserve-3d" }}
          >
            {char === " " ? " " : char}
          </span>
        ))}
      </h1>

      <p className="hero-tagline mt-10 max-w-xl text-center font-[var(--font-fraunces)] text-lg italic text-white/60 sm:text-xl">
        {profile.tagline || STORY.hero.tagline}
      </p>

      <div className="hero-meta mt-6 flex items-center gap-3 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.3em] text-white/40">
        <span className="h-px w-8 bg-white/30" />
        <span>{profile.location || STORY.hero.location}</span>
        <span className="h-px w-8 bg-white/30" />
      </div>
    </section>
  );
}
