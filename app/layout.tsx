import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, JetBrains_Mono } from "next/font/google";
import { LayoutClient } from "@/components/ui/LayoutClient";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const SITE_URL = "https://hamiani.mohammed.harmonith.fr";
const SITE_TITLE = "Mohammed Hamiani — Concepteur Développeur Fullstack";
const SITE_DESCRIPTION =
  "Portfolio de Mohammed Hamiani, Concepteur Développeur Fullstack à Strasbourg. Projets React, Next.js, Node.js & MongoDB — recherche stage / alternance 2026.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — Mohammed Hamiani",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "développeur fullstack",
    "Mohammed Hamiani",
    "portfolio",
    "stage développeur",
    "alternance",
    "React",
    "Next.js",
    "Node.js",
    "Strasbourg",
  ],
  authors: [{ name: "Mohammed Hamiani", url: SITE_URL }],
  creator: "Mohammed Hamiani",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Mohammed Hamiani — Portfolio",
    images: [
      {
        url: "/photoCV.png",
        width: 800,
        height: 800,
        alt: "Mohammed Hamiani",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/photoCV.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link
          rel="stylesheet"
          href="https://assets.calendly.com/assets/external/widget.css"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
