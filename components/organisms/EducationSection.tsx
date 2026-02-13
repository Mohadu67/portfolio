"use client";

import React from "react";
import { motion } from "framer-motion";
import { Section } from "@/components/molecules";
import { Card, Text, Icon } from "@/components/atoms";
import { staggerContainer, staggerItem } from "@/lib/animations";
import portfolioData from "@/data/portfolio.json";

export function EducationSection() {
  const { education } = portfolioData;

  return (
    <Section
      id="education"
      title="Formation"
      description="Parcours académique et certifications"
      className="bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]/50"
    >
      <motion.div
        className="space-y-6 max-w-3xl mx-auto"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
      >
        {education.map((edu, i) => (
          <motion.div
            key={edu.id}
            variants={staggerItem}
            className={`relative max-w-xl mx-auto md:max-w-none ${i % 2 === 0 ? "md:ml-0" : "md:ml-auto md:mr-0"}`}
          >
            {/* Timeline dot */}
            <motion.div
              className="absolute -left-12 top-6 w-6 h-6 bg-[var(--accent-orange)] rounded-full border-4 border-[var(--bg-primary)] hidden md:block"
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 200 }}
            />

            <Card
              elevated
              className="border-l-4 border-l-[var(--accent-orange)] hover:shadow-lg transition-all duration-300"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-0 mb-3">
                <div className="flex-1">
                  <Text as="h4" variant="h4" className="mb-1">
                    {edu.degree}
                  </Text>
                  <Text color="secondary" variant="body" className="mb-2">
                    {edu.school}
                  </Text>
                  <Text color="tertiary" variant="caption">
                    {edu.field}
                  </Text>
                </div>
                <motion.div
                  className="flex items-center gap-2 bg-[var(--bg-secondary)] px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm flex-shrink-0"
                  whileHover={{ scale: 1.05 }}
                >
                  <Icon name="calendar" size={16} className="text-[var(--accent-orange)]" />
                  <Text variant="caption" color="secondary">
                    {edu.period}
                  </Text>
                </motion.div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
