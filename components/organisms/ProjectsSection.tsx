"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Section, ProjectCard } from "@/components/molecules";
import { staggerContainer, staggerItem } from "@/lib/animations";
import type { CVProjectItem } from "@/models/CVSection";
import { X, Copy, Check } from "lucide-react";

interface ProjectsSectionProps {
  projects: CVProjectItem[];
  title?: string;
}

export function ProjectsSection({ projects, title = "Projets" }: ProjectsSectionProps) {
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
        title={title}
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
        {selectedProject && currentProject?.credentials && (
          <motion.div
            key={selectedProject}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProject(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`project-modal-${selectedProject}`}
          >
            <motion.div
              className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 w-full max-w-md"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2
                  id={`project-modal-${selectedProject}`}
                  className="text-2xl font-bold text-[var(--text-primary)]"
                >
                  {currentProject.name}
                </h2>
                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={() => setSelectedProject(null)}
                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:outline-none"
                >
                  <X size={22} className="text-[var(--text-secondary)]" />
                </button>
              </div>

              <p className="text-[var(--text-secondary)] mb-6">
                Identifiants de connexion pour tester ce projet :
              </p>

              <div className="space-y-4">
                {/* Email */}
                <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)]">
                  <p className="text-sm text-[var(--text-secondary)] mb-2">Email :</p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-[var(--text-primary)] font-mono font-semibold truncate">
                      {currentProject.credentials.email}
                    </code>
                    <button
                      type="button"
                      aria-label="Copier l'email"
                      onClick={() => handleCopy(currentProject.credentials!.email, "email")}
                      className="p-2 hover:bg-[var(--bg-card)] rounded-lg transition-colors flex-shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:outline-none"
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
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-[var(--text-primary)] font-mono font-semibold truncate">
                      {currentProject.credentials.password}
                    </code>
                    <button
                      type="button"
                      aria-label="Copier le mot de passe"
                      onClick={() => handleCopy(currentProject.credentials!.password, "password")}
                      className="p-2 hover:bg-[var(--bg-card)] rounded-lg transition-colors flex-shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:outline-none"
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

              <a
                href={currentProject.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSelectedProject(null)}
                className="block w-full mt-6 px-4 py-3 bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-orange)]/80 text-[var(--bg-primary)] rounded-lg font-semibold hover:shadow-lg transition-shadow text-center focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:outline-none"
              >
                Accéder au projet
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
