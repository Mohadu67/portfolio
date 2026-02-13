"use client";

import { motion } from "framer-motion";
import { SocialLink } from "@/components/molecules";
import { Container } from "@/components/atoms";
import { slideUpContainer, slideUpItem } from "@/lib/animations";
import portfolioData from "@/data/portfolio.json";

export function FooterSection() {
  const { socials } = portfolioData;

  return (
    <section className="relative bg-gradient-to-t from-[var(--bg-card)]/50 to-transparent py-16 px-4 sm:px-6 lg:px-8 border-t border-[var(--border-color)]">
      <Container>
        <motion.div
          variants={slideUpContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="text-center space-y-12"
        >
          <motion.div variants={slideUpItem}>
            <h3 className="text-3xl font-bold bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] bg-clip-text text-transparent mb-2">
              Connectez-vous
            </h3>
            <p className="text-[var(--text-secondary)] text-sm">Retrouvez-moi sur ces plateformes</p>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto"
            variants={slideUpContainer}
          >
            {socials.map((social) => (
              <motion.div key={social.id} variants={slideUpItem}>
                <SocialLink
                  name={social.name}
                  handle={social.handle}
                  url={social.url}
                  iconName={social.icon}
                />
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            variants={slideUpItem}
            className="pt-8 border-t border-[var(--border-color)]/50"
          >
            <p className="text-xs text-[var(--text-tertiary)]">
              © 2026 Mohammed Hamiani • Tous droits réservés
            </p>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
