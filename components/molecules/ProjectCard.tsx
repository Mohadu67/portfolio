import React from "react";
import Link from "next/link";
import Image from "next/image";
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
  return (
    <Link href={url} target="_blank" rel="noopener noreferrer">
      <Card
        elevated
        interactive
        className="flex flex-col overflow-hidden group relative h-full"
      >
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-orange)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Image Container - Réduit de 50% */}
        <div className="relative h-24 w-full overflow-hidden rounded-lg mb-4 bg-[var(--bg-secondary)]">
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 relative z-10">
          <Text as="h3" variant="h3" color="primary" className="mb-2">
            {name}
          </Text>

          <Text color="secondary" className="mb-4 line-clamp-2 flex-1">
            {description}
          </Text>

          {/* Tech Stack */}
          <div className="flex flex-wrap gap-2 mb-4">
            {stack.map((tech) => (
              <Badge key={tech}>{tech}</Badge>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center text-[var(--accent-orange)] font-semibold text-sm group-hover:gap-2 gap-1 transition-all">
            <span>Voir le projet</span>
            <Icon name="arrow-right" size={16} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
