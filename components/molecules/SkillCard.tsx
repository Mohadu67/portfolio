"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, Badge, Text, Icon } from "@/components/atoms";

interface SkillCardProps {
  name: string;
  level: "Expert" | "Avancé" | "Intermédiaire";
  years: string;
  category: string;
  bugStory?: string;
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
  bugStory,
}: SkillCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const config = levelConfig[level];

  return (
    <div
      className="cursor-pointer h-full perspective"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        {/* Front of card */}
        <motion.div
          className="w-full h-full"
          style={{
            backfaceVisibility: "hidden",
          }}
        >
          <Card className="hover:shadow-xl transition-all duration-300 group h-full flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <Text as="h4" variant="h4" color="primary">
                  {name}
                </Text>
                <Text variant="caption" color="tertiary" className="mt-1">
                  {category}
                </Text>
              </div>
              <div className={`${config.color}`}>
                <Icon name={config.icon as any} size={24} />
              </div>
            </div>

            <div className="flex gap-2 items-center mt-auto">
              <Badge variant="info">{level}</Badge>
              <Text variant="caption" color="secondary">
                {years}
              </Text>
            </div>

            <Text variant="caption" color="secondary" className="mt-4 text-center opacity-60">
              Cliquer pour plus d'info
            </Text>
          </Card>
        </motion.div>

        {/* Back of card - Bug Story */}
        <motion.div
          className="w-full h-full absolute inset-0"
          style={{
            rotateY: 180,
            backfaceVisibility: "hidden",
          }}
        >
          <Card className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-500/5 to-orange-500/5 border-l-4 border-l-[var(--accent-orange)] p-4">
            <div className="text-center w-full h-full flex flex-col items-center justify-center">
              {/* Bug emoji/icon */}
              <motion.div
                className="mb-3 text-3xl"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🐛
              </motion.div>

              {/* Story text */}
              {bugStory ? (
                <>
                  <Text variant="caption" color="secondary" className="text-sm italic leading-relaxed flex-1 flex items-center">
                    "{bugStory}"
                  </Text>
                  <Text variant="caption" color="tertiary" className="text-xs opacity-60 mt-3">
                    Cliquer pour retourner
                  </Text>
                </>
              ) : (
                <div className="text-center">
                  <Text as="h4" variant="h4" color="primary" className="mb-2">
                    {name}
                  </Text>
                  <div className="mb-3 space-y-1">
                    <Text variant="caption" color="secondary">
                      <span className="font-semibold">Niveau :</span> {level}
                    </Text>
                    <Text variant="caption" color="secondary">
                      <span className="font-semibold">Expérience :</span> {years}
                    </Text>
                  </div>
                  <Text variant="caption" color="tertiary" className="text-xs opacity-70 mt-3">
                    Cliquer pour retourner
                  </Text>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
