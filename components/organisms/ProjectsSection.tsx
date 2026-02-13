"use client";

import React from "react";
import { Section, ProjectCard } from "@/components/molecules";
import portfolioData from "@/data/portfolio.json";

export function ProjectsSection() {
  const { projects } = portfolioData;

  return (
    <Section
      title="Projets"
      description="Découvrez mes projets fullstack présentant mes compétences en développement web moderne"
      className="bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]/50"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {projects.map((project, i) => (
          <div
            key={project.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            <ProjectCard {...project} />
          </div>
        ))}
      </div>
    </Section>
  );
}
