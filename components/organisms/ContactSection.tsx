"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import gsap from "gsap";
import { Clock, Video, Sparkles, CalendarCheck, ArrowRight } from "lucide-react";
import { Container, Card, Text, Icon, type IconName } from "@/components/atoms";
import { staggerContainer, staggerItem } from "@/lib/animations";
import type { CVContactContent } from "@/models/CVSection";

interface ContactSectionProps {
  contact: CVContactContent;
  title?: string;
}

export function ContactSection({ contact, title = "Me contacter" }: ContactSectionProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [embedUrl, setEmbedUrl] = useState<string>("");

  const ctaCardRef = useRef<HTMLDivElement>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const iframeWrapRef = useRef<HTMLDivElement>(null);
  const orbsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contact.calendly) return;
    const sep = contact.calendly.includes("?") ? "&" : "?";
    const params = new URLSearchParams({
      embed_domain: window.location.hostname,
      embed_type: "Inline",
      hide_gdpr_banner: "1",
      hide_landing_page_details: "0",
    });
    // Browser-only embed URL builder (uses window.location). One-shot per contact.calendly change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmbedUrl(`${contact.calendly}${sep}${params.toString()}`);
  }, [contact.calendly]);

  // GSAP entrance for the CTA card
  useEffect(() => {
    if (!ctaCardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".gsap-orb", {
        scale: 0,
        opacity: 0,
        duration: 1.2,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: undefined,
      });
      gsap.from(".gsap-pitch-line", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: "power3.out",
        delay: 0.2,
      });
      gsap.from(".gsap-perk", {
        x: -30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "back.out(1.4)",
        delay: 0.5,
      });
      gsap.fromTo(
        ".gsap-cta-btn",
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, ease: "elastic.out(1, 0.6)", delay: 0.8 }
      );
    }, ctaCardRef);
    return () => ctx.revert();
  }, []);

  // GSAP open/close transition for the calendar
  useEffect(() => {
    if (!iframeWrapRef.current || !pitchRef.current) return;
    const wrap = iframeWrapRef.current;
    const pitch = pitchRef.current;

    if (showCalendar) {
      gsap.set(wrap, { display: "block" });
      const tl = gsap.timeline();
      tl.to(pitch, {
        opacity: 0,
        y: -20,
        duration: 0.35,
        ease: "power2.in",
        onComplete: () => {
          if (pitch) pitch.style.display = "none";
        },
      })
        .fromTo(
          wrap,
          { opacity: 0, scale: 0.92, y: 40 },
          { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: "power3.out" }
        )
        .fromTo(
          ".gsap-cal-decor",
          { opacity: 0, scale: 0.5 },
          { opacity: 1, scale: 1, duration: 0.5, stagger: 0.1, ease: "back.out(1.6)" },
          "-=0.4"
        );
    } else {
      const tl = gsap.timeline();
      tl.to(wrap, {
        opacity: 0,
        scale: 0.95,
        y: 30,
        duration: 0.35,
        ease: "power2.in",
        onComplete: () => {
          if (wrap) wrap.style.display = "none";
          if (pitch) pitch.style.display = "flex";
        },
      })
        .fromTo(
          pitch,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }
        );
    }
  }, [showCalendar]);

  const contactMethods = [
    { label: "Email", value: contact.email, url: `mailto:${contact.email}`, icon: "mail" },
    { label: "Téléphone", value: contact.phone, url: `tel:${contact.phone}`, icon: "zap" },
  ];

  const perks = [
    { icon: Clock, label: "30 minutes", desc: "Un échange court et efficace" },
    { icon: Video, label: "Visio Google Meet", desc: "Lien envoyé automatiquement" },
    { icon: Sparkles, label: "Sans engagement", desc: "Juste pour faire connaissance" },
  ];

  return (
    <section
      id="contact"
      className="py-16 md:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]/50"
    >
      <Container size="md">
        {/* Header */}
        <motion.div
          className="text-center mb-10 md:mb-12"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          <motion.div variants={staggerItem}>
            <Text as="h2" variant="h2" className="mb-3 md:mb-4">
              {title}
            </Text>
          </motion.div>
          <motion.div variants={staggerItem}>
            <Text color="secondary" className="text-base md:text-lg max-w-2xl mx-auto">
              {contact.cta}
            </Text>
          </motion.div>
        </motion.div>

        {/* Contact Methods Grid (Email + Téléphone uniquement) */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 max-w-2xl mx-auto"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          {contactMethods.map((method) => (
            <Link
              key={method.label}
              href={method.url}
              target={method.url.startsWith("http") ? "_blank" : "_self"}
              rel={method.url.startsWith("http") ? "noopener noreferrer" : ""}
            >
              <motion.div variants={staggerItem}>
                <Card interactive className="text-center group h-full">
                  <motion.div
                    className="mb-4 text-4xl"
                    whileHover={{ scale: 1.2, rotate: 6 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Icon name={method.icon as IconName} size={32} className="text-[var(--accent-orange)] mx-auto" />
                  </motion.div>
                  <Text as="h4" variant="h4" className="mb-2">
                    {method.label}
                  </Text>
                  <Text color="secondary" variant="body">
                    {method.value}
                  </Text>
                </Card>
              </motion.div>
            </Link>
          ))}
        </motion.div>

        {/* CTA Section — Embedded Calendly with reveal */}
        <div
          ref={ctaCardRef}
          id="calendly-embed"
          className="relative scroll-mt-24"
        >
          {/* Decorative orbs */}
          <div ref={orbsRef} aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden rounded-3xl pointer-events-none">
            <div className="gsap-orb absolute -top-24 -left-24 w-72 h-72 bg-[var(--accent-orange)]/20 rounded-full blur-3xl" />
            <div className="gsap-orb absolute -bottom-24 -right-24 w-80 h-80 bg-[var(--accent-blue)]/20 rounded-full blur-3xl" />
            <div className="gsap-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[var(--accent-orange)]/10 rounded-full blur-3xl" />
          </div>

          <div className="relative rounded-3xl overflow-hidden border border-[var(--accent-orange)]/20 bg-gradient-to-br from-[var(--bg-card)] via-[var(--bg-primary)] to-[var(--bg-card)] shadow-2xl min-h-[480px] md:min-h-[560px]">
            {/* PITCH (default state) */}
            <div
              ref={pitchRef}
              className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 py-12 md:px-12"
            >
              <div className="gsap-pitch-line inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-orange)]/10 border border-[var(--accent-orange)]/30 mb-6">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-orange)] animate-pulse" />
                <span className="text-xs font-semibold text-[var(--accent-orange)] uppercase tracking-wider">
                  Disponible maintenant
                </span>
              </div>

              <h3 className="gsap-pitch-line text-3xl md:text-5xl lg:text-6xl font-black text-[var(--text-primary)] mb-4 leading-tight">
                Prêt à{" "}
                <span className="bg-gradient-to-r from-[var(--accent-orange)] via-[var(--accent-blue)] to-[var(--accent-orange)] bg-clip-text text-transparent">
                  collaborer
                </span>{" "}
                ?
              </h3>

              <p className="gsap-pitch-line text-base md:text-lg text-[var(--text-secondary)] max-w-xl mb-10 leading-relaxed">
                Réserve un créneau en visio, on discute de ton projet, d&apos;une opportunité de stage
                ou d&apos;alternance — ou simplement pour faire connaissance.
              </p>

              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full mb-10">
                {perks.map((p) => (
                  <li
                    key={p.label}
                    className="gsap-perk flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-card)]/60 border border-[var(--border-soft)] backdrop-blur-sm"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--accent-orange)]/10 border border-[var(--accent-orange)]/20 flex items-center justify-center">
                      <p.icon size={16} className="text-[var(--accent-orange)]" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] text-xs sm:text-sm truncate">{p.label}</p>
                      <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] truncate">{p.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setShowCalendar(true)}
                className="gsap-cta-btn group relative inline-flex items-center gap-3 px-7 py-4 rounded-xl bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-orange)]/80 text-[var(--bg-primary)] font-bold text-base md:text-lg shadow-lg shadow-[var(--accent-orange)]/30 hover:shadow-[var(--accent-orange)]/50 hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <CalendarCheck size={20} />
                <span>Voir mes créneaux disponibles</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <p className="gsap-pitch-line text-xs text-[var(--text-tertiary)] mt-5">
                Ouverture instantanée • Aucune inscription nécessaire
              </p>
            </div>

            {/* CALENDAR (revealed state) */}
            <div
              ref={iframeWrapRef}
              style={{ display: "none" }}
              className="relative"
            >
              {/* Calendar header bar */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-soft)] bg-[var(--bg-card)]/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="gsap-cal-decor flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--accent-orange)]/10 border border-[var(--accent-orange)]/20 flex items-center justify-center">
                    <CalendarCheck size={18} className="text-[var(--accent-orange)]" />
                  </div>
                  <div>
                    <p className="gsap-cal-decor font-semibold text-sm text-[var(--text-primary)]">Choisis un créneau</p>
                    <p className="gsap-cal-decor text-xs text-[var(--text-secondary)]">30 minutes • Google Meet</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCalendar(false)}
                  className="gsap-cal-decor text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--accent-orange)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--accent-orange)]/10"
                >
                  ← Retour
                </button>
              </div>

              {/* Iframe wrapper with gradient frame */}
              <div className="relative h-[640px] md:h-[720px] bg-white">
                {embedUrl ? (
                  <iframe
                    src={embedUrl}
                    title="Calendly - Réserver un appel"
                    className="absolute inset-0 w-full h-full border-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-[var(--bg-card)]">
                    <Text color="secondary">
                      {contact.calendly ? "Chargement du calendrier…" : "Lien Calendly non configuré."}
                    </Text>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
