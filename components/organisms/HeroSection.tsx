"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Container, Button, Text } from "@/components/atoms";
import { SocialLink } from "@/components/molecules";
import portfolioData from "@/data/portfolio.json";

export function HeroSection() {
  const { profile, socials } = portfolioData;

  return (
    <section className="relative min-h-screen bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-card)]/30 to-[var(--bg-primary)] overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[var(--accent-orange)]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[var(--accent-blue)]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0.5s" }} />
      </div>

      <Container className="relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="flex flex-col justify-center order-2 md:order-1">
            {/* Name */}
            <div className="mb-6 animate-fade-in-up">
              <Text as="h1" variant="h1" className="mb-2">
                {profile.name}
              </Text>
              <div className="h-1 w-24 bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] rounded-full" />
            </div>

            {/* Title & Tagline */}
            <Text
              as="p"
              variant="h3"
              color="accent-orange"
              className="mb-4 animate-fade-in-up"
              style={{ animationDelay: "0.1s" }}
            >
              {profile.title}
            </Text>
            <Text
              variant="body"
              color="secondary"
              className="text-xl mb-8 animate-fade-in-up"
              style={{ animationDelay: "0.2s" }}
            >
              {profile.tagline}
            </Text>

            {/* Meta Info */}
            <div className="flex flex-wrap gap-4 mb-8 text-sm text-[var(--text-secondary)] animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <span>{profile.location}</span>
              <span>•</span>
              <span>{profile.availability}</span>
              <span>•</span>
              <span>{profile.phone}</span>
            </div>

            {/* CTA Buttons */}
            <div className="flex gap-4 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
              <Link href="/dashboard">
                <Button size="lg" className="group">
                  Dashboard
                  <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </Button>
              </Link>
              <a href={`mailto:${profile.email}`}>
                <Button size="lg" variant="ghost">
                  Me contacter
                </Button>
              </a>
            </div>
          </div>

          {/* Right: Avatar */}
          <div className="flex justify-center md:justify-end order-1 md:order-2 mb-8 md:mb-0">
            <div className="relative w-64 h-64 md:w-80 md:h-80 group">
              {/* Animated border */}
              <div className="absolute inset-0 rounded-2xl border-2 border-[var(--accent-orange)]/30 group-hover:border-[var(--accent-orange)] transition-all duration-500 animate-spin" style={{ animationDuration: "20s", animationDirection: "reverse" }} />

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
              <div className="absolute -inset-2 bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] rounded-2xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity -z-10" />
            </div>
          </div>
        </div>

        {/* Socials Grid */}
        <div className="mt-20 pt-20 border-t border-[var(--border-color)]">
          <Text
            as="h3"
            variant="h3"
            color="primary"
            className="text-center mb-8"
          >
            Connectez-vous
          </Text>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {socials.map((social, i) => (
              <div
                key={social.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${0.5 + i * 0.1}s` }}
              >
                <SocialLink
                  name={social.name}
                  handle={social.handle}
                  url={social.url}
                  iconName={social.icon}
                />
              </div>
            ))}
          </div>
        </div>
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
