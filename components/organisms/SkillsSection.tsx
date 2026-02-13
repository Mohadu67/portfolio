"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Section, SkillCard } from "@/components/molecules";
import { staggerContainer, staggerItem } from "@/lib/animations";
import portfolioData from "@/data/portfolio.json";

export function SkillsSection() {
  const { skills } = portfolioData;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  const categories = Object.keys(skillsByCategory);
  const displayCategory = selectedCategory || categories[0];
  const displaySkills = skillsByCategory[displayCategory] || [];

  return (
    <Section
      id="skills"
      title="Compétences Techniques"
      description="Technologies maîtrisées et perfectionnées au fil des années"
      className="bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]/50"
    >
      {/* Category Tabs */}
      <motion.div
        className="flex flex-wrap gap-3 mb-12"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
      >
        {categories.map((category) => (
          <motion.button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
              displayCategory === category
                ? "bg-[var(--accent-orange)] text-[var(--bg-primary)]"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            variants={staggerItem}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {category}
          </motion.button>
        ))}
      </motion.div>

      {/* Skills Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
        key={displayCategory}
      >
        {displaySkills.map((skill) => (
          <motion.div key={skill.id} variants={staggerItem} className="h-full">
            <SkillCard
              name={skill.name}
              level={skill.level as "Expert" | "Avancé" | "Intermédiaire"}
              years={skill.years}
              category={skill.category}
              bugStory={(skill as any).bugStory}
            />
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
