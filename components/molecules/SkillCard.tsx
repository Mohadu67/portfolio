import React from "react";
import { Card, Badge, Text, Icon } from "@/components/atoms";

interface SkillCardProps {
  name: string;
  level: "Expert" | "Avancé" | "Intermédiaire";
  years: string;
  category: string;
}

const levelConfig = {
  Expert: { icon: "star", color: "text-[var(--accent-orange)]" },
  Avancé: { icon: "zap", color: "text-blue-400" },
  Intermédiaire: { icon: "code", color: "text-[var(--text-secondary)]" },
};

export function SkillCard({
  name,
  level,
  years,
  category,
}: SkillCardProps) {
  const config = levelConfig[level];

  return (
    <Card className="hover:shadow-xl transition-all duration-300 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <Text as="h4" variant="h4" color="primary">
            {name}
          </Text>
          <Text variant="caption" color="tertiary" className="mt-1">
            {category}
          </Text>
        </div>
        <div className={`${config.color}`}>
          <Icon name={config.icon as any} size={20} />
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Badge variant="info">{level}</Badge>
        <Text variant="caption" color="secondary">
          {years}
        </Text>
      </div>

      {/* Animated underline */}
      <div className="mt-3 h-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[var(--accent-orange)] to-blue-500 transition-all duration-500 group-hover:w-full"
          style={{
            width:
              level === "Expert"
                ? "100%"
                : level === "Avancé"
                  ? "75%"
                  : "50%",
          }}
        />
      </div>
    </Card>
  );
}
