import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { LibrarySection } from "@/components/home/library-section";
import { LibrariesSection } from "@/components/home/libraries-section";
import { SourcesSection } from "@/components/home/sources-section";

// «Популярные книги» и «Моя библиотека» появятся вместе с данными (этап 9):
// до этого они не показываются, чтобы на странице не было пустых мест.
export default function HomePage() {
  return (
    <>
      <Hero />
      <LibrarySection />
      <HowItWorks />
      <LibrariesSection />
      <SourcesSection />
    </>
  );
}
