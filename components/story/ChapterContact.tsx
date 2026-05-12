"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STORY } from "@/data/story";
import type { CVContactContent, CVSocialItem, CVProfileContent } from "@/models/CVSection";

type Props = {
  profile: CVProfileContent;
  contact: CVContactContent;
  socials: CVSocialItem[];
};

type CalendlyWindow = Window & {
  Calendly?: {
    initInlineWidget: (opts: { url: string; parentElement: HTMLElement }) => void;
  };
};

export function ChapterContact({ profile, contact, socials }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const calendlyRef = useRef<HTMLDivElement | null>(null);
  const [calendlyOpen, setCalendlyOpen] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // init Calendly widget quand ouvert
  useEffect(() => {
    if (!calendlyOpen || !contact.calendly) return;

    let attempts = 0;
    const tryInit = () => {
      const w = window as CalendlyWindow;
      if (w.Calendly && calendlyRef.current) {
        calendlyRef.current.innerHTML = "";
        w.Calendly.initInlineWidget({
          url: contact.calendly,
          parentElement: calendlyRef.current,
        });
        setScriptLoaded(true);
        return true;
      }
      return false;
    };

    if (tryInit()) return;

    // Script pas encore prêt → poll
    const interval = setInterval(() => {
      attempts += 1;
      if (tryInit() || attempts > 50) clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  }, [calendlyOpen, contact.calendly]);

  // Lock scroll body quand modal ouvert
  useEffect(() => {
    if (!calendlyOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [calendlyOpen]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const letters = rootRef.current?.querySelectorAll<HTMLSpanElement>("[data-final-letter]");
      if (letters && letters.length) {
        gsap.fromTo(
          letters,
          { y: 80, opacity: 0, rotateX: -60 },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            stagger: 0.04,
            duration: 1,
            ease: "power4.out",
            scrollTrigger: {
              trigger: rootRef.current,
              start: "top 70%",
              end: "top 30%",
              scrub: 1,
            },
          }
        );
      }

      gsap.fromTo(
        ".contact-eyebrow, .contact-title, .contact-body",
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.1,
          scrollTrigger: {
            trigger: ".contact-header",
            start: "top 80%",
            end: "top 50%",
            scrub: 0.8,
          },
        }
      );

      gsap.utils.toArray<HTMLElement>(".contact-link").forEach((link, i) => {
        gsap.fromTo(
          link,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            delay: i * 0.08,
            scrollTrigger: {
              trigger: link,
              start: "top 90%",
              end: "top 70%",
              scrub: 0.6,
            },
          }
        );

        const handleMove = (e: MouseEvent) => {
          const rect = link.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;
          gsap.to(link, { x: x * 0.25, y: y * 0.25, duration: 0.4, ease: "power2.out" });
        };
        const handleLeave = () => {
          gsap.to(link, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
        };
        link.addEventListener("mousemove", handleMove);
        link.addEventListener("mouseleave", handleLeave);
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  // Construit la liste avec dédoublonnage par URL
  const baseLinks: { id: string; label: string; url: string; value: string; type: "calendly" | "external" }[] = [];
  if (contact.email) {
    baseLinks.push({
      id: "email",
      label: "Email",
      url: `mailto:${contact.email}`,
      value: contact.email,
      type: "external",
    });
  }
  if (contact.calendly) {
    baseLinks.push({
      id: "calendly",
      label: "Calendly",
      url: contact.calendly,
      value: "Book a call",
      type: "calendly",
    });
  }
  const usedUrls = new Set(baseLinks.map((l) => l.url));
  socials.forEach((s) => {
    if (!s.url || usedUrls.has(s.url)) return;
    usedUrls.add(s.url);
    baseLinks.push({
      id: s.id || s.name,
      label: s.name,
      url: s.url,
      value: s.handle || s.name,
      type: "external",
    });
  });

  return (
    <section
      ref={rootRef}
      id="contact"
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#0a0a0b] px-6 py-32 text-white"
    >
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#FF9E64]/40 to-transparent" />

      <div className="contact-header text-center">
        <p className="contact-eyebrow font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.4em] text-[#FF9E64]/80">
          — {STORY.contact.eyebrow}
        </p>
        <h2 className="contact-title mt-6 font-[var(--font-fraunces)] text-[clamp(2.5rem,7vw,5.5rem)] font-light leading-[1.05]">
          {STORY.contact.title}
        </h2>
        <p className="contact-body mt-6 max-w-md text-base italic text-white/50 sm:text-lg">
          {STORY.contact.body}
        </p>
      </div>

      <div className="mt-16 flex flex-wrap items-center justify-center gap-3 md:gap-4">
        {baseLinks.map((link) =>
          link.type === "calendly" ? (
            <button
              key={link.id}
              onClick={() => setCalendlyOpen(true)}
              className="contact-link group relative inline-flex flex-col items-center gap-1 rounded-full border border-[#FF9E64]/40 bg-[#FF9E64]/[0.08] px-7 py-4 transition-colors hover:border-[#FF9E64] hover:bg-[#FF9E64]/[0.14]"
            >
              <span className="font-[var(--font-jetbrains)] text-[9px] uppercase tracking-[0.3em] text-[#FF9E64]">
                {link.label}
              </span>
              <span className="font-[var(--font-fraunces)] text-base text-white md:text-lg">
                Réserver un call
              </span>
            </button>
          ) : (
            <a
              key={link.id}
              href={link.url}
              target={link.url.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="contact-link group relative inline-flex flex-col items-center gap-1 rounded-full border border-white/15 bg-white/[0.02] px-7 py-4 transition-colors hover:border-[#FF9E64]/60 hover:bg-[#FF9E64]/[0.06]"
            >
              <span className="font-[var(--font-jetbrains)] text-[9px] uppercase tracking-[0.3em] text-white/40 transition-colors group-hover:text-[#FF9E64]">
                {link.label}
              </span>
              <span className="font-[var(--font-fraunces)] text-base text-white md:text-lg">
                {link.value}
              </span>
            </a>
          )
        )}
      </div>

      {/* Modal Calendly inline */}
      {calendlyOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/85 px-4 py-12 backdrop-blur-md sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCalendlyOpen(false);
          }}
        >
          <div className="relative w-full max-w-3xl">
            <button
              onClick={() => setCalendlyOpen(false)}
              className="absolute -top-12 right-0 z-10 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-white transition-colors hover:border-[#FF9E64] hover:text-[#FF9E64]"
              aria-label="Fermer"
            >
              Fermer ✕
            </button>
            <div
              ref={calendlyRef}
              className="calendly-inline-widget overflow-hidden rounded-2xl border border-white/10 bg-white"
              style={{ minWidth: "320px", height: "720px" }}
            >
              {!scriptLoaded && (
                <div className="flex h-full items-center justify-center bg-[#0d1117] font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-white/40">
                  Chargement du calendrier…
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <h3
        aria-hidden
        className="mt-24 font-[var(--font-fraunces)] text-[clamp(2.5rem,11vw,11rem)] font-extralight leading-[0.95] tracking-tight text-white/90"
        style={{ perspective: "1000px" }}
      >
        {profile.name.split("").map((char, i) => (
          <span
            key={i}
            data-final-letter
            className="inline-block"
            style={{ transformStyle: "preserve-3d" }}
          >
            {char === " " ? " " : char}
          </span>
        ))}
      </h3>

      <p className="mt-12 font-[var(--font-jetbrains)] text-[10px] uppercase tracking-[0.3em] text-white/30">
        © 2026 — Strasbourg, FR
      </p>
    </section>
  );
}
