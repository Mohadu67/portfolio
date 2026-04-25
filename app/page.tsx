import { NavBar } from "@/components/ui/NavBar";
import {
  HeroSection,
  SkillsSection,
  EducationSection,
  ExperienceSection,
  ProjectsSection,
  ContactSection,
  FooterSection,
  CustomSection,
} from "@/components/organisms";
import { getCVData } from "@/lib/cv";
import type { CVCustomContent } from "@/models/CVSection";

export const revalidate = 60;

export default async function Home() {
  const data = await getCVData();
  const visible = data.sections.filter((s) => s.isVisible).sort((a, b) => a.order - b.order);

  const customByKey = new Map(data.customSections.map((s) => [s.key, s]));

  return (
    <main className="bg-[var(--bg-primary)]">
      <NavBar />
      {visible.map((section) => {
        switch (section.type) {
          case "profile":
            return <HeroSection key={section._id} profile={data.profile} />;
          case "skills":
            return <SkillsSection key={section._id} skills={data.skills} title={section.title} />;
          case "education":
            return <EducationSection key={section._id} education={data.education} title={section.title} />;
          case "experience":
            return <ExperienceSection key={section._id} experience={data.experience} title={section.title} />;
          case "projects":
            return <ProjectsSection key={section._id} projects={data.projects} title={section.title} />;
          case "contact":
            return <ContactSection key={section._id} contact={data.contact} title={section.title} />;
          case "socials":
            return <FooterSection key={section._id} socials={data.socials} />;
          case "custom": {
            const c = customByKey.get(section.key);
            if (!c) return null;
            return (
              <CustomSection
                key={section._id}
                id={c.key}
                title={c.title}
                content={c.content as CVCustomContent}
              />
            );
          }
          default:
            return null;
        }
      })}
    </main>
  );
}
