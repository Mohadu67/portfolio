"use client";

import React from "react";
import { Section } from "@/components/molecules";
import { Card, Text, Icon } from "@/components/atoms";
import portfolioData from "@/data/portfolio.json";

export function EducationSection() {
  const { education } = portfolioData;

  return (
    <Section
      title="Formation"
      description="Parcours académique et certifications"
      className="bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]/50"
    >
      <div className="space-y-6 max-w-2xl mx-auto">
        {education.map((edu, i) => (
          <Card
            key={edu.id}
            elevated
            className="border-l-4 border-l-[var(--accent-orange)] animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
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
              <div className="flex items-center gap-2 bg-[var(--bg-secondary)] px-3 py-1 rounded-lg">
                <Icon name="calendar" size={16} className="text-[var(--accent-orange)]" />
                <Text variant="caption" color="secondary">
                  {edu.year}
                </Text>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
