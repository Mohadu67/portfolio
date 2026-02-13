"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/atoms/Button";
import {
  Home,
  Zap,
  Code2,
  BookOpen,
  Briefcase,
  Mail,
  LayoutDashboard,
  Plus,
  X,
} from "lucide-react";

export function NavBar() {
  const [activeSection, setActiveSection] = useState("hero");
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      const scrollHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      const scrolled = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
      setScrollProgress(scrolled);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const sections = [
    { id: "hero", label: "Accueil", icon: Home },
    { id: "skills", label: "Compétences", icon: Zap },
    { id: "projects", label: "Projets", icon: Code2 },
    { id: "education", label: "Formation", icon: BookOpen },
    { id: "experience", label: "Expérience", icon: Briefcase },
    { id: "contact", label: "Contact", icon: Mail },
  ];

  const handleScroll = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setActiveSection(sectionId);
      setIsOpen(false);
    }
  };

  const handleDashboard = () => {
    window.location.href = "/dashboard";
  };

  // Calculate positions for radial menu
  const menuItems = [...sections, { id: "dashboard", icon: LayoutDashboard }];
  const totalItems = menuItems.length;
  const radius = 100;

  return (
    <>
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] z-50"
        animate={{ width: `${scrollProgress}%` }}
        transition={{ type: "tween", duration: 0.1 }}
      />

      {/* Desktop NavBar */}
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 hidden md:block ${
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
          <div className="flex items-center gap-8">
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
          <Button variant="secondary" size="sm" onClick={handleDashboard}>
            Dashboard
          </Button>
        </div>
      </motion.nav>

      {/* Mobile Floating Menu */}
      <AnimatePresence>
        {/* Backdrop */}
        {isOpen && (
          <motion.div
            key="navbar-backdrop"
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Floating Circular Menu */}
        {isOpen && (
          <div key="navbar-menu" className="fixed bottom-6 right-6 z-50 md:hidden" style={{ width: "280px", height: "280px" }}>
          {/* Menu Items in Circle */}
          <AnimatePresence>
            {isOpen &&
              menuItems.map((item, index) => {
                const angle = (index / totalItems) * Math.PI * 2 - Math.PI / 2;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                const Icon = item.icon;

                return (
                  <motion.button
                    key={item.id}
                    className="absolute w-14 h-14 rounded-full bg-gradient-to-br from-[var(--accent-orange)] to-[var(--accent-orange)]/80 flex items-center justify-center text-white shadow-lg"
                    style={{
                      left: "50%",
                      top: "50%",
                      marginLeft: "-28px",
                      marginTop: "-28px",
                    }}
                    initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                    animate={{
                      scale: 1,
                      opacity: 1,
                      x,
                      y,
                    }}
                    exit={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                      delay: index * 0.05,
                    }}
                    whileHover={{
                      scale: 1.15,
                      boxShadow: "0 0 30px rgba(255, 158, 100, 0.6)",
                    }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      if (item.id === "dashboard") {
                        handleDashboard();
                      } else {
                        handleScroll(item.id);
                      }
                    }}
                  >
                    <Icon size={24} className="drop-shadow-lg" />
                  </motion.button>
                );
              })}
          </AnimatePresence>

            {/* Center Button */}
            <motion.button
              className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-blue)]/80 flex items-center justify-center text-white shadow-2xl"
              style={{
                right: "0",
                bottom: "0",
              }}
              initial={{ scale: 1 }}
              animate={{ rotate: isOpen ? 45 : 0 }}
              whileHover={{ scale: 1.1, boxShadow: "0 0 40px rgba(46, 159, 216, 0.8)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(!isOpen)}
            >
              <AnimatePresence mode="wait">
                {isOpen ? (
                  <motion.div
                    key="x-icon"
                    initial={{ rotate: -45, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 45, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X size={28} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="plus-icon"
                    initial={{ rotate: 45, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -45, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Plus size={28} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        )}

        {/* Floating Button (Always visible when closed) */}
        {!isOpen && (
          <motion.button
            key="navbar-button"
            className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-blue)]/80 flex items-center justify-center text-white shadow-2xl md:hidden"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1, boxShadow: "0 0 40px rgba(46, 159, 216, 0.8)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(!isOpen)}
          >
            <Plus size={28} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
