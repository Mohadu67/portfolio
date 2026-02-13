"use client";

import { motion, useScroll, useTransform } from "framer-motion";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--accent-orange)] via-[var(--accent-blue)] to-[var(--accent-orange)] origin-left z-50"
      style={{ scaleX }}
    />
  );
}
