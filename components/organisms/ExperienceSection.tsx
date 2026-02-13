"use client";

import React from "react";
import { Section } from "@/components/molecules";
import { Card, Text, Icon } from "@/components/atoms";
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
      title="Expérience Professionnelle"
      description="Parcours professionnel et projets réalisés"
      className="bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]/50"
    >
      <div className="space-y-6 max-w-2xl mx-auto">
        {experience.map((exp, i) => (
          <Card
            key={exp.id}
            elevated
            className="border-l-4 border-l-[var(--accent-blue)] animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s` }}
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

            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-3 py-1 rounded-lg w-fit">
              <Icon name="calendar" size={14} />
              <span>
                {formatDate(exp.startDate)} - {formatDate(exp.endDate)}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
