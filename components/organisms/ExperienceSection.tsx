"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Section } from "@/components/molecules";
import { Card, Text, Icon } from "@/components/atoms";
import { staggerContainer, staggerItem } from "@/lib/animations";
import portfolioData from "@/data/portfolio.json";
import { X, Briefcase } from "lucide-react";

export function ExperienceSection() {
  const { experience } = portfolioData;
  const [selectedExp, setSelectedExp] = useState<string | null>(null);

  const currentExp = experience.find((e) => e.id === selectedExp);

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
    <>
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
              className={`relative max-w-xl mx-auto md:max-w-none ${
                i % 2 === 0 ? "md:ml-0" : "md:ml-auto md:mr-0"
              }`}
            >
              {/* Timeline dot */}
              <motion.div
                className="absolute -left-12 top-6 w-6 h-6 bg-[var(--accent-blue)] rounded-full border-4 border-[var(--bg-primary)] hidden md:block"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 200 }}
              />

              <motion.div
                onClick={() => setSelectedExp(exp.id)}
                className="group relative rounded-lg border-2 border-transparent hover:border-[var(--accent-blue)] transition-all duration-300 cursor-pointer"
              >
                <div className="relative rounded-lg bg-[var(--bg-card)]">
                  <Card
                    elevated
                    className="border-l-4 border-l-[var(--accent-blue)] overflow-hidden relative"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <Text as="h4" variant="h4" className="mb-1">
                          {exp.position}
                        </Text>
                        <div className="flex items-center gap-2 mb-3">
                          <Icon
                            name="package"
                            size={16}
                            className="text-[var(--accent-blue)]"
                          />
                          <Text color="secondary" variant="body">
                            {exp.company}
                          </Text>
                        </div>
                        <Text color="tertiary" variant="body" className="mb-3 line-clamp-2">
                          {exp.description}
                        </Text>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-2 sm:px-3 py-1 rounded-lg w-fit flex-shrink-0">
                      <Icon name="calendar" size={14} />
                      <span className="line-clamp-1">
                        {formatDate(exp.startDate)} - {formatDate(exp.endDate)}
                      </span>
                    </div>
                    <Text color="secondary" className="text-sm mt-3">
                      Cliquez pour voir les détails →
                    </Text>
                  </Card>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </Section>

      {/* Modal avec flip effect */}
      <AnimatePresence>
        {selectedExp && currentExp && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedExp(null)}
          >
            <motion.div
              className="relative w-full max-w-2xl h-96"
              initial={{ rotateY: -90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: 90, opacity: 0 }}
              transition={{ type: "spring", stiffness: 150, damping: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{ perspective: "1200px" }}
            >
              <motion.div
                className="w-full h-full bg-gradient-to-br from-[var(--accent-blue)]/20 to-[var(--accent-orange)]/20 border border-[var(--border-color)] rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden"
                layout
              >
                {/* Background decoration */}
                <motion.div
                  className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg class=%22w-full h-full%22 xmlns=%22http://www.w3.org/2000/svg%22><defs><pattern id=%22grid%22 width=%2240%22 height=%2240%22 patternUnits=%22userSpaceOnUse%22><path d=%22M 40 0 L 0 0 0 40%22 fill=%22none%22 stroke=%22rgba(74,144,226,0.1)%22 stroke-width=%220.5%22/></pattern></defs><rect width=%22100%25%22 height=%22100%25%22 fill=%22url(%23grid)%22/></svg>')] opacity-50"
                />

                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedExp(null);
                  }}
                  className="absolute top-4 right-4 p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors z-50 pointer-events-auto cursor-pointer"
                >
                  <X size={24} className="text-[var(--text-secondary)]" />
                </button>

                {/* Content - Scrollable */}
                <div className="relative z-10 overflow-y-auto max-h-64 pr-4">
                  <div className="flex items-center gap-3 mb-6">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <Briefcase size={32} className="text-[var(--accent-blue)]" />
                    </motion.div>
                    <div>
                      <Text as="h3" variant="h3" className="text-white mb-1">
                        {currentExp.position}
                      </Text>
                      <Text color="secondary" className="text-sm">
                        {currentExp.company}
                      </Text>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-6 bg-gradient-to-b from-[var(--accent-blue)] to-[var(--accent-orange)] rounded-full" />
                      <Text as="h4" variant="h4" className="text-white">
                        Détails du poste
                      </Text>
                    </div>
                    <Text color="secondary" className="text-base leading-relaxed">
                      {currentExp.details}
                    </Text>
                  </div>

                  <div className="bg-[var(--bg-secondary)] p-3 rounded-lg">
                    <Text color="tertiary" className="text-sm">
                      📅 {formatDate(currentExp.startDate)} - {formatDate(currentExp.endDate)}
                    </Text>
                  </div>
                </div>

                {/* Bottom action */}
                <button
                  onClick={() => setSelectedExp(null)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-orange)] text-white rounded-lg font-semibold hover:shadow-lg transition-shadow relative z-10"
                >
                  Retour à la liste
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
