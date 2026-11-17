import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { LibrariesSection } from "@/components/home/libraries-section";
import { SourcesSection } from "@/components/home/sources-section";

// Блоки «Примеры», «Популярные книги» и «Моя библиотека» появятся вместе с данными
// (этапы 6 и 9): до этого они не показываются, чтобы на странице не было пустых мест.
export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <LibrariesSection />
      <SourcesSection />
    </>
  );
}
