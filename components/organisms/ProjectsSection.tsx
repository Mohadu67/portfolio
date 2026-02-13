"use client";

import React from "react";
import { motion } from "framer-motion";
import { Section, ProjectCard } from "@/components/molecules";
import { staggerContainer, staggerItem } from "@/lib/animations";
import portfolioData from "@/data/portfolio.json";

export function ProjectsSection() {
  const { projects } = portfolioData;

  return (
    <Section
      id="projects"
      title="Projets"
      description="Découvrez mes projets fullstack présentant mes compétences en développement web moderne"
      className="bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]/50"
    >
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-8"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
      >
        {projects.map((project) => (
          <motion.div
            key={project.id}
            variants={staggerItem}
          >
            <ProjectCard {...project} />
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
