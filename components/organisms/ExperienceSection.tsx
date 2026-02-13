"use client";

import React from "react";
import { motion } from "framer-motion";
import { Section } from "@/components/molecules";
import { Card, Text, Icon } from "@/components/atoms";
import { staggerContainer, staggerItem } from "@/lib/animations";
import portfolioData from "@/data/portfolio.json";

export function ExperienceSection() {
  const { experience } = portfolioData;

  const formatDate = (date: string) => {
    if (date === "Présent") return date;
    const [year, month] = date.split("-");
    const monthNames = [
      "Jan",
      "Fév",
      "Mar",
      "Avr",
      "Mai",
      "Juin",
      "Juil",
      "Aoû",
      "Sep",
      "Oct",
      "Nov",
      "Déc",
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  return (
    <Section
      id="experience"
      title="Expérience Professionnelle"
      description="Parcours professionnel et projets réalisés"
      className="bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]/50"
    >
      <motion.div
        className="space-y-6 max-w-3xl mx-auto"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
      >
        {experience.map((exp, i) => (
          <motion.div
            key={exp.id}
            variants={staggerItem}
            className={`relative max-w-xl mx-auto md:max-w-none ${i % 2 === 0 ? "md:ml-0" : "md:ml-auto md:mr-0"}`}
          >
            {/* Timeline dot */}
            <motion.div
              className="absolute -left-12 top-6 w-6 h-6 bg-[var(--accent-blue)] rounded-full border-4 border-[var(--bg-primary)] hidden md:block"
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 200 }}
            />

            <Card
              elevated
              className="border-l-4 border-l-[var(--accent-blue)] hover:shadow-lg transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <Text as="h4" variant="h4" className="mb-1">
                    {exp.position}
                  </Text>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="package" size={16} className="text-[var(--accent-blue)]" />
                    <Text color="secondary" variant="body">
                      {exp.company}
                    </Text>
                  </div>
                  <Text color="tertiary" variant="body" className="mb-3 line-clamp-2">
                    {exp.description}
                  </Text>
                </div>
              </div>

              <motion.div
                className="flex items-center gap-2 text-xs sm:text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-2 sm:px-3 py-1 rounded-lg w-fit flex-shrink-0"
                whileHover={{ scale: 1.05 }}
              >
                <Icon name="calendar" size={14} />
                <span className="line-clamp-1">
                  {formatDate(exp.startDate)} - {formatDate(exp.endDate)}
                </span>
              </motion.div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
