"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card, Text, Badge, Icon, Button } from "@/components/atoms";

interface ProjectCardProps {
  name: string;
  description: string;
  image: string;
  stack: string[];
  url: string;
}

export function ProjectCard({
  name,
  description,
  image,
  stack,
  url,
}: ProjectCardProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePosition({ x: x * 8, y: y * 8 });
  };

  return (
    <Link href={url} target="_blank" rel="noopener noreferrer">
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setMousePosition({ x: 0, y: 0 });
        }}
        style={{
          rotateX: mousePosition.y,
          rotateY: mousePosition.x,
          perspective: "1000px",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="h-full"
      >
        <Card
          elevated
          interactive
          className="flex flex-col overflow-hidden group relative h-full"
        >
          {/* Background Gradient */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-[var(--accent-orange)]/10 to-transparent"
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Image Container */}
          <motion.div className="relative h-48 w-full overflow-hidden rounded-lg mb-4 bg-[var(--bg-secondary)] flex items-center justify-center">
            <motion.div
              animate={{ scale: isHovered ? 1.1 : 1 }}
              transition={{ duration: 0.5 }}
            >
              <Image
                src={image}
                alt={name}
                width={200}
                height={200}
                className="scale-50"
              />
            </motion.div>
          </motion.div>

          {/* Content */}
          <div className="flex flex-col flex-1 relative z-10">
            <Text as="h3" variant="h3" color="primary" className="mb-2">
              {name}
            </Text>

            <Text color="secondary" className="mb-4 line-clamp-2 flex-1">
              {description}
            </Text>

            {/* Tech Stack */}
            <motion.div
              className="flex flex-wrap gap-2 mb-4"
              initial={{ opacity: 0.7 }}
              animate={{ opacity: isHovered ? 1 : 0.7 }}
              transition={{ duration: 0.3 }}
            >
              {stack.map((tech) => (
                <Badge key={tech}>{tech}</Badge>
              ))}
            </motion.div>

            {/* CTA */}
            <motion.div
              className="flex items-center text-[var(--accent-orange)] font-semibold text-sm gap-1 transition-all"
              animate={{ gap: isHovered ? 8 : 4 }}
            >
              <span>Voir le projet</span>
              <motion.div
                animate={{ x: isHovered ? 4 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <Icon name="arrow-right" size={16} />
              </motion.div>
            </motion.div>
          </div>
        </Card>
      </motion.div>
    </Link>
  );
}
