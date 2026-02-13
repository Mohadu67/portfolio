import { NavBar } from "@/components/ui/NavBar";
import {
  HeroSection,
  SkillsSection,
  EducationSection,
  ExperienceSection,
  ProjectsSection,
  ContactSection,
} from "@/components/organisms";

export default function Home() {
  return (
    <main className="bg-[var(--bg-primary)]">
      <NavBar />
      <HeroSection />
      <SkillsSection />
      <EducationSection />
      <ExperienceSection />
      <ProjectsSection />
      <ContactSection />
    </main>
  );
}
