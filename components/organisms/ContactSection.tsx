"use client";

import React from "react";
import Link from "next/link";
import { Container, Card, Button, Text, Icon } from "@/components/atoms";
import portfolioData from "@/data/portfolio.json";

export function ContactSection() {
  const { contact } = portfolioData;

  const contactMethods = [
    {
      label: "Email",
      value: contact.email,
      url: `mailto:${contact.email}`,
      icon: "mail",
    },
    {
      label: "Téléphone",
      value: contact.phone,
      url: `tel:${contact.phone}`,
      icon: "zap",
    },
    {
      label: "Calendly",
      value: "Réserver un appel",
      url: contact.calendly,
      icon: "calendar",
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]/50">
      <Container size="md">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          <Text as="h2" variant="h2" className="mb-4">
            Me contacter
          </Text>
          <Text color="secondary" className="text-lg">
            {contact.cta}
          </Text>
        </div>

        {/* Contact Methods Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {contactMethods.map((method, i) => (
            <Link
              key={method.label}
              href={method.url}
              target={method.url.startsWith("http") ? "_blank" : "_self"}
              rel={method.url.startsWith("http") ? "noopener noreferrer" : ""}
            >
              <Card
                interactive
                className="text-center group animate-fade-in-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="mb-4 text-4xl group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300">
                  <Icon name={method.icon as any} size={32} className="text-[var(--accent-orange)] mx-auto" />
                </div>
                <Text as="h4" variant="h4" className="mb-2">
                  {method.label}
                </Text>
                <Text color="secondary" variant="body">
                  {method.value}
                </Text>
              </Card>
            </Link>
          ))}
        </div>

        {/* CTA Card */}
        <Card
          elevated
          className="text-center p-8 md:p-12 bg-gradient-to-r from-[var(--accent-orange)]/10 to-[var(--accent-blue)]/10 border border-[var(--accent-orange)]/20 animate-fade-in-up"
          style={{ animationDelay: "0.3s" }}
        >
          <Text as="h3" variant="h3" className="mb-4">
            Prêt à collaborer?
          </Text>
          <Text color="secondary" className="mb-8 max-w-lg mx-auto">
            Je suis disponible pour discuter de nouvelles opportunités et projets intéressants.
          </Text>
          <a href={contact.calendly} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="mx-auto">
              Réserver un appel
            </Button>
          </a>
        </Card>
      </Container>
    </section>
  );
}
