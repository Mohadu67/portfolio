import { getCVData } from "@/lib/cv";
import { SmoothScroll } from "@/components/story/SmoothScroll";
import { ChapterNav } from "@/components/story/ChapterNav";
import { ChapterHero } from "@/components/story/ChapterHero";
import { ChapterRupture } from "@/components/story/ChapterRupture";
import { ChapterKitchens } from "@/components/story/ChapterKitchens";
import { ChapterDoubleLife } from "@/components/story/ChapterDoubleLife";
import { ChapterLeap } from "@/components/story/ChapterLeap";
import { ChapterSkills } from "@/components/story/ChapterSkills";
import { ChapterProjects } from "@/components/story/ChapterProjects";
import { ChapterPresent } from "@/components/story/ChapterPresent";
import { ChapterContact } from "@/components/story/ChapterContact";

export const revalidate = 60;

export default async function Home() {
  const data = await getCVData();

  return (
    <SmoothScroll>
      <ChapterNav />
      <main className="relative bg-[#0a0a0b]">
        <ChapterHero profile={data.profile} />
        <ChapterRupture />
        <ChapterKitchens experiences={data.experience} />
        <ChapterDoubleLife />
        <ChapterLeap />
        <ChapterSkills skills={data.skills} />
        <ChapterProjects projects={data.projects} />
        <ChapterPresent education={data.education} experiences={data.experience} />
        <ChapterContact
          profile={data.profile}
          contact={data.contact}
          socials={data.socials}
        />
      </main>
    </SmoothScroll>
  );
}
