"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/atoms/Button";
import { Menu, X } from "lucide-react";

export function NavBar() {
  const [activeSection, setActiveSection] = useState("hero");
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const sections = [
    { id: "hero", label: "Accueil" },
    { id: "skills", label: "Compétences" },
    { id: "projects", label: "Projets" },
    { id: "education", label: "Formation" },
    { id: "experience", label: "Expérience" },
    { id: "contact", label: "Contact" },
  ];

  const handleScroll = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setActiveSection(sectionId);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 h-1 bg-[var(--accent-orange)] z-50"
        initial={{ width: "0%" }}
        onScroll={() => {
          const scrollHeight =
            document.documentElement.scrollHeight -
            document.documentElement.clientHeight;
          const scrolled = (window.scrollY / scrollHeight) * 100;
          return scrolled;
        }}
        style={{
          width: "0%",
        }}
      />

      {/* NavBar */}
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isScrolled
            ? "bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border-color)]"
            : "bg-transparent"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <motion.div
            className="font-bold text-lg text-[var(--accent-orange)]"
            whileHover={{ scale: 1.05 }}
          >
            MH
          </motion.div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            {sections.map((section) => (
              <motion.button
                key={section.id}
                onClick={() => handleScroll(section.id)}
                className={`text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? "text-[var(--accent-orange)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                whileHover={{ scale: 1.05 }}
              >
                {section.label}
              </motion.button>
            ))}
          </div>

          {/* Dashboard Button */}
          <div className="hidden md:block">
            <Button variant="secondary" size="sm" onClick={() => window.location.href = '/dashboard'}>
              Dashboard
            </Button>
          </div>

          {/* Mobile Menu Toggle */}
          <motion.button
            className="md:hidden text-[var(--text-primary)]"
            onClick={() => setIsOpen(!isOpen)}
            whileTap={{ scale: 0.95 }}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </motion.button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <motion.div
            className="md:hidden bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border-color)]"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="px-4 py-4 space-y-3">
              {sections.map((section) => (
                <motion.button
                  key={section.id}
                  onClick={() => handleScroll(section.id)}
                  className={`block w-full text-left py-2 px-3 rounded text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? "bg-[var(--accent-orange)]/20 text-[var(--accent-orange)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  {section.label}
                </motion.button>
              ))}
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-2"
                onClick={() => window.location.href = '/dashboard'}
              >
                Dashboard
              </Button>
            </div>
          </motion.div>
        )}
      </motion.nav>
    </>
  );
}
