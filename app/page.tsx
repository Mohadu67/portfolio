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
  const s = data.story;

  return (
    <SmoothScroll>
      <ChapterNav />
      <main className="relative bg-[#0a0a0b]">
        <ChapterHero profile={data.profile} story={s.hero} />
        <ChapterRupture story={s.rupture} />
        <ChapterKitchens experiences={data.experience} story={s.kitchens} />
        <ChapterDoubleLife story={s.doubleLife} />
        <ChapterLeap story={s.leap} />
        <ChapterSkills skills={data.skills} quiz={data.quiz} story={s.skills} />
        <ChapterProjects projects={data.projects} story={s.projects} />
        <ChapterPresent
          education={data.education}
          experiences={data.experience}
          story={s.present}
        />
        <ChapterContact
          profile={data.profile}
          contact={data.contact}
          socials={data.socials}
          story={s.contact}
        />
      </main>
    </SmoothScroll>
  );
}
