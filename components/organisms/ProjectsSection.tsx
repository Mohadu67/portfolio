"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Section, ProjectCard } from "@/components/molecules";
import { staggerContainer, staggerItem } from "@/lib/animations";
import portfolioData from "@/data/portfolio.json";
import { X, Copy, Check } from "lucide-react";

export function ProjectsSection() {
  const { projects } = portfolioData;
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const currentProject = projects.find((p) => p.id === selectedProject);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <>
      <Section
        id="projects"
        title="Projets"
        description="Découvrez mes projets fullstack présentant mes compétences en développement web moderne"
        className="bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]/50"
      >
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          {projects.map((project) => (
            <motion.div
              key={project.id}
              variants={staggerItem}
            >
              <ProjectCard
                {...project}
                onCredentialsClick={() => setSelectedProject(project.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      </Section>

      {/* Credentials Modal */}
      <AnimatePresence>
        {selectedProject && currentProject && "credentials" in currentProject && currentProject.credentials && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProject(null)}
          >
            <motion.div
              className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 w-full max-w-md"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                  {currentProject.name}
                </h2>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                >
                  <X size={24} className="text-[var(--text-secondary)]" />
                </button>
              </div>

              <p className="text-[var(--text-secondary)] mb-6">
                Identifiants de connexion pour tester ce projet :
              </p>

              <div className="space-y-4">
                {/* Email */}
                <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)]">
                  <p className="text-sm text-[var(--text-secondary)] mb-2">Email :</p>
                  <div className="flex items-center justify-between">
                    <code className="text-[var(--text-primary)] font-mono font-semibold">
                      {currentProject.credentials.email}
                    </code>
                    <button
                      onClick={() => handleCopy(currentProject.credentials.email, "email")}
                      className="p-2 hover:bg-[var(--bg-card)] rounded-lg transition-colors"
                      title="Copier l'email"
                    >
                      {copiedField === "email" ? (
                        <Check size={18} className="text-green-500" />
                      ) : (
                        <Copy size={18} className="text-[var(--accent-orange)]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)]">
                  <p className="text-sm text-[var(--text-secondary)] mb-2">Mot de passe :</p>
                  <div className="flex items-center justify-between">
                    <code className="text-[var(--text-primary)] font-mono font-semibold">
                      {currentProject.credentials.password}
                    </code>
                    <button
                      onClick={() => handleCopy(currentProject.credentials.password, "password")}
                      className="p-2 hover:bg-[var(--bg-card)] rounded-lg transition-colors"
                      title="Copier le mot de passe"
                    >
                      {copiedField === "password" ? (
                        <Check size={18} className="text-green-500" />
                      ) : (
                        <Copy size={18} className="text-[var(--accent-orange)]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedProject(null)}
                className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-orange)]/80 text-[var(--bg-primary)] rounded-lg font-semibold hover:shadow-lg transition-shadow"
              >
                Accéder au projet
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
