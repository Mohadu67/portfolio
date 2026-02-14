"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Code2, Zap } from "lucide-react";
import { Container, Button, Text } from "@/components/atoms";
import { slideUpItem } from "@/lib/animations";
import portfolioData from "@/data/portfolio.json";

export function HeroSection() {
  const { profile } = portfolioData;
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePosition({ x: x * 10, y: y * 10 });
  };

  // Deterministic seed-based random for hydration consistency
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return Math.round((x - Math.floor(x)) * 1000) / 1000;
  };

  // Floating particles
  const particles = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    delay: Math.round(seededRandom(i * 2) * 0.5 * 1000) / 1000,
    duration: Math.round((3 + seededRandom(i * 2 + 1) * 2) * 1000) / 1000,
    x: Math.round(seededRandom(i * 3) * 1200 * 100) / 100,
    y: Math.round(seededRandom(i * 3 + 1) * 800 * 100) / 100,
  }));

  return (
    <section id="hero" className="relative h-screen flex items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8">
      {/* Dynamic background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-primary)] via-[var(--bg-card)]/50 to-[var(--bg-primary)]" />

      {/* Animated blob backgrounds */}
      <motion.div
        className="absolute top-0 -left-40 w-80 h-80 bg-[var(--accent-orange)]/20 rounded-full mix-blend-multiply filter blur-3xl"
        animate={{
          x: [0, 40, 0],
          y: [0, 40, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 right-10 w-80 h-80 bg-[var(--accent-blue)]/20 rounded-full mix-blend-multiply filter blur-3xl"
        animate={{
          x: [0, -40, 0],
          y: [0, -40, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute top-1/2 left-1/3 w-72 h-72 bg-[var(--accent-orange)]/10 rounded-full mix-blend-multiply filter blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-1 h-1 bg-[var(--accent-orange)]/30 rounded-full"
            initial={{
              x: particle.x,
              y: particle.y,
            }}
            animate={{
              y: [0, -200, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              repeat: Infinity,
            }}
          />
        ))}
      </div>

      <Container className="relative z-10 h-full flex items-center">
        <motion.div
          className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          {/* Left: Epic Content */}
          <motion.div className="flex flex-col justify-center order-2 md:order-1 space-y-4 md:space-y-8">
            {/* Top accent */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex items-center gap-2"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Zap size={24} className="text-[var(--accent-orange)]" />
              </motion.div>
              <span className="text-[var(--accent-orange)] font-semibold text-lg">Fullstack Developer</span>
            </motion.div>

            {/* Main heading */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="space-y-4"
            >
              <div className="relative">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-[var(--text-primary)] leading-tight">
                  Mohammed
                  <span className="block mt-2 bg-gradient-to-r from-[var(--accent-orange)] via-[var(--accent-blue)] to-[var(--accent-orange)] bg-clip-text text-transparent animate-gradient-shift">
                    Hamiani
                  </span>
                </h1>
              </div>
              <motion.div
                className="flex gap-2"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                <div className="h-2 w-16 bg-[var(--accent-orange)] rounded-full" />
                <div className="h-2 w-8 bg-[var(--accent-blue)] rounded-full" />
              </motion.div>
            </motion.div>

            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="space-y-3"
            >
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--accent-orange)]">
                Concepteur Développeur Fullstack
              </p>
              <p className="text-base md:text-lg text-[var(--text-secondary)] max-w-md">
                Dev by Day • Creator by Night
              </p>
            </motion.div>

            {/* Info grid */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="flex flex-wrap gap-6 text-sm"
            >
              <div>
                <p className="text-[var(--text-secondary)]">Localisation</p>
                <p className="font-semibold text-[var(--text-primary)]">{profile.location}</p>
              </div>
              <div>
                <p className="text-[var(--text-secondary)]">Disponibilité</p>
                <p className="font-semibold text-[var(--text-primary)]">Stage Mars 2026</p>
              </div>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-row gap-3 pt-2"
            >
              <Link href="/dashboard" className="w-auto">
                <motion.button
                  className="px-5 py-2 md:px-8 md:py-4 bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-orange)]/80 text-[var(--bg-primary)] rounded-xl font-bold text-sm md:text-lg flex items-center justify-center gap-2 shadow-lg"
                  whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(255, 158, 100, 0.5)" }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="md:hidden">Dashboard</span>
                  <span className="hidden md:inline">Voir mon Dashboard</span>
                  <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>
                    <ArrowRight size={20} />
                  </motion.div>
                </motion.button>
              </Link>
              <a href={`mailto:${profile.email}`} className="w-auto">
                <motion.button
                  className="px-5 py-2 md:px-8 md:py-4 border-2 border-[var(--accent-orange)] text-[var(--text-primary)] rounded-xl font-bold text-sm md:text-lg hover:bg-[var(--accent-orange)]/10 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Me contacter
                </motion.button>
              </a>
            </motion.div>
          </motion.div>

          {/* Right: Epic Avatar */}
          <motion.div
            className="flex justify-center md:justify-end order-1 md:order-2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            onMouseMove={handleMouseMove}
          >
            <motion.div
              className="relative w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 group cursor-pointer"
              style={{
                rotateX: mousePosition.y,
                rotateY: mousePosition.x,
                perspective: "1200px",
              }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            >
              {/* Outer glow */}
              <motion.div
                className="absolute -inset-6 bg-gradient-to-r from-[var(--accent-orange)] via-[var(--accent-blue)] to-[var(--accent-orange)] rounded-3xl blur-2xl opacity-30 group-hover:opacity-60 transition-opacity"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />

              {/* Rotating border */}
              <motion.div
                className="absolute inset-0 rounded-3xl border-2 border-transparent bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] bg-clip-border opacity-30 group-hover:opacity-100 transition-opacity"
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              />

              {/* Image container */}
              <div className="absolute inset-3 rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-color)]">
                <Image
                  src={profile.photo}
                  alt={profile.name}
                  fill
                  sizes="(max-width: 768px) 224px, 300px"
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  priority
                />
              </div>

              {/* Inner glow */}
              <motion.div className="absolute -inset-2 bg-gradient-to-r from-[var(--accent-orange)]/30 to-[var(--accent-blue)]/30 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
            </motion.div>
          </motion.div>
        </motion.div>
      </Container>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-2 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-8 h-12 border-2 border-[var(--accent-orange)] rounded-full flex items-center justify-center">
          <motion.div
            className="w-1.5 h-2.5 bg-[var(--accent-orange)] rounded-full"
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
}
