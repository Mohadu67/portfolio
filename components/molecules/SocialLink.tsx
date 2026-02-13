import React from "react";
import Link from "next/link";
import { Card, Icon, Text } from "@/components/atoms";

interface SocialLinkProps {
  name: string;
  handle: string;
  url: string;
  iconName: string;
}

export function SocialLink({
  name,
  handle,
  url,
  iconName,
}: SocialLinkProps) {
  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full h-full"
    >
      <Card
        interactive
        className="flex flex-col items-center justify-center text-center p-4 md:p-6 min-h-24 group h-full"
      >
        {/* Icon */}
        <div className="text-4xl mb-3 group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300">
          <Icon name={iconName as any} size={32} className="text-[var(--accent-orange)]" />
        </div>

        {/* Name */}
        <Text
          as="h4"
          variant="h4"
          color="primary"
          className="mb-1 group-hover:text-[var(--accent-orange)] transition-colors"
        >
          {name}
        </Text>

        {/* Handle */}
        <Text variant="caption" color="tertiary" className="truncate w-full">
          {handle}
        </Text>
      </Card>
    </Link>
  );
}
