"use client";

import { motion } from "framer-motion";
import { Section } from "@/components/molecules";
import { Card, Text } from "@/components/atoms";
import { staggerContainer, staggerItem } from "@/lib/animations";
import type { CVCustomContent } from "@/models/CVSection";

interface CustomSectionProps {
  id: string;
  title: string;
  content: CVCustomContent;
}

export function CustomSection({ id, title, content }: CustomSectionProps) {
  const items = content.items ?? [];
  return (
    <Section
      id={`custom-${id}`}
      title={title}
      description={content.subtitle}
      className="bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]/50"
    >
      {content.body && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto mb-10"
        >
          <Text color="secondary" className="whitespace-pre-line text-base leading-relaxed">
            {content.body}
          </Text>
        </motion.div>
      )}

      {items.length > 0 && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          {items.map((item) => (
            <motion.div key={item.id} variants={staggerItem}>
              <Card elevated className="border-l-4 border-l-[var(--accent-blue)] h-full">
                <Text as="h4" variant="h4" className="mb-2">
                  {item.title}
                </Text>
                <Text color="secondary" className="whitespace-pre-line text-sm leading-relaxed">
                  {item.description}
                </Text>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </Section>
  );
}
