"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Container, Button, Text } from "@/components/atoms";
import { SocialLink } from "@/components/molecules";
import { slideUpContainer, slideUpItem } from "@/lib/animations";
import portfolioData from "@/data/portfolio.json";

export function HeroSection() {
  const { profile, socials } = portfolioData;
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePosition({ x: x * 10, y: y * 10 });
  };

  return (
    <section id="hero" className="relative min-h-screen bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-card)]/30 to-[var(--bg-primary)] overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[var(--accent-orange)]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[var(--accent-blue)]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0.5s" }} />
      </div>

      <Container className="relative z-10">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center"
          variants={slideUpContainer}
          initial="initial"
          animate="animate"
        >
          {/* Left: Content */}
          <motion.div className="flex flex-col justify-center order-2 md:order-1" variants={slideUpContainer}>
            {/* Name */}
            <motion.div className="mb-6" variants={slideUpItem}>
              <Text as="h1" variant="h1" className="mb-2 bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] bg-clip-text text-transparent animate-gradient-shift">
                {profile.name}
              </Text>
              <motion.div className="h-1 w-24 bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] rounded-full" />
            </motion.div>

            {/* Title & Tagline */}
            <motion.div variants={slideUpItem}>
              <Text
                as="p"
                variant="h3"
                color="accent-orange"
                className="mb-4"
              >
                {profile.title}
              </Text>
            </motion.div>
            <motion.div variants={slideUpItem}>
              <Text
                variant="body"
                color="secondary"
                className="text-xl mb-8"
              >
                {profile.tagline}
              </Text>
            </motion.div>

            {/* Meta Info */}
            <motion.div className="flex flex-wrap gap-4 mb-8 text-sm text-[var(--text-secondary)]" variants={slideUpItem}>
              <span>{profile.location}</span>
              <span>•</span>
              <span>{profile.availability}</span>
              <span>•</span>
              <span>{profile.phone}</span>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div className="flex gap-4" variants={slideUpItem}>
              <Link href="/dashboard">
                <Button size="lg" className="group inline-flex items-center gap-2">
                  Dashboard
                  <motion.div
                    className="ml-1"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  >
                    <ArrowRight size={18} />
                  </motion.div>
                </Button>
              </Link>
              <a href={`mailto:${profile.email}`}>
                <Button size="lg" variant="ghost">
                  Me contacter
                </Button>
              </a>
            </motion.div>
          </motion.div>

          {/* Right: Avatar */}
          <motion.div
            className="flex justify-center md:justify-end order-1 md:order-2 mb-8 md:mb-0"
            variants={slideUpItem}
            onMouseMove={handleMouseMove}
          >
            <motion.div
              className="relative w-64 h-64 md:w-80 md:h-80 group"
              style={{
                rotateX: mousePosition.y,
                rotateY: mousePosition.x,
                perspective: "1000px",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* Animated border */}
              <motion.div className="absolute inset-0 rounded-2xl border-2 border-[var(--accent-orange)]/30 group-hover:border-[var(--accent-orange)] transition-all duration-500" animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} />

              {/* Image */}
              <div className="absolute inset-4 rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-card)]">
                <Image
                  src={profile.photo}
                  alt={profile.name}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  priority
                />
              </div>

              {/* Glow effect */}
              <motion.div className="absolute -inset-2 bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] rounded-2xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity -z-10" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Socials Grid */}
        <motion.div className="mt-20 pt-20 border-t border-[var(--border-color)]" variants={slideUpContainer}>
          <motion.div variants={slideUpItem}>
            <Text
              as="h3"
              variant="h3"
              color="primary"
              className="text-center mb-8"
            >
              Connectez-vous
            </Text>
          </motion.div>
          <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4" variants={slideUpContainer}>
            {socials.map((social) => (
              <motion.div
                key={social.id}
                variants={slideUpItem}
              >
                <SocialLink
                  name={social.name}
                  handle={social.handle}
                  url={social.url}
                  iconName={social.icon}
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </Container>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-[var(--accent-orange)] rounded-full flex items-center justify-center">
          <div className="w-1 h-2 bg-[var(--accent-orange)] rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  );
}
