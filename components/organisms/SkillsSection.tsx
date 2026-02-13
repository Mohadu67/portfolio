"use client";

import React, { useMemo } from "react";
import { Section, SkillCard } from "@/components/molecules";
import portfolioData from "@/data/portfolio.json";

export function SkillsSection() {
  const { skills } = portfolioData;

  // Group skills by category
  const skillsByCategory = useMemo(() => {
    return skills.reduce(
      (acc, skill) => {
        if (!acc[skill.category]) acc[skill.category] = [];
        acc[skill.category].push(skill);
        return acc;
      },
      {} as Record<string, typeof skills>
    );
  }, [skills]);

  return (
    <Section
      title="Compétences Techniques"
      description="Technologies maîtrisées et perfectionnées au fil des années"
      className="bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]/50"
    >
      <div className="space-y-12">
        {Object.entries(skillsByCategory).map(([category, categorySkills], i) => (
          <div
            key={category}
            className="animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <h3 className="text-lg font-semibold text-[var(--accent-orange)] mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-[var(--accent-orange)] rounded-full" />
              {category}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categorySkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  name={skill.name}
                  level={skill.level as "Expert" | "Avancé" | "Intermédiaire"}
                  years={skill.years}
                  category={skill.category}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
