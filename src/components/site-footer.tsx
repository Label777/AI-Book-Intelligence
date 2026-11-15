export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-page flex-col gap-1 px-4 py-8 text-sm text-ink-2 sm:px-6 lg:px-8">
        <p className="font-medium text-ink">AI Book Intelligence</p>
        <p className="max-w-[70ch]">
          Анализ создаёт искусственный интеллект. Он помогает разобраться в книге, но не
          заменяет её чтение.
        </p>
      </div>
    </footer>
  );
}
