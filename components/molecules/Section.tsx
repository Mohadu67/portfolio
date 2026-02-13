import React from "react";
import { Container, Text } from "@/components/atoms";

interface SectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function Section({
  title,
  description,
  children,
  className = "",
  id,
}: SectionProps) {
  return (
    <section id={id} className={`py-20 px-4 sm:px-6 lg:px-8 ${className}`}>
      <Container>
        {/* Header */}
        {title && (
          <div className="mb-12 text-center">
            <Text as="h2" variant="h2" color="primary" className="mb-4">
              {title}
            </Text>
            {description && (
              <Text color="secondary" className="max-w-2xl mx-auto">
                {description}
              </Text>
            )}
          </div>
        )}

        {/* Content */}
        {children}
      </Container>
    </section>
  );
}
