"use server";

import { redirect } from "next/navigation";
import { AnalysisBusyError, getAnalysisService, isAnalysisId } from "@/analysis/service";
import { CatalogError } from "@/books/types";
import { getBook, isWorkId } from "@/books/work";

function bookPage(workId: string, error: string): string {
  return `/book/${workId}?${new URLSearchParams({ error })}`;
}

/** «Создать анализ» на странице книги: запускает пайплайн и открывает страницу хода работы. */
export async function startAnalysisAction(formData: FormData): Promise<void> {
  const workId = String(formData.get("workId") ?? "");
  if (!isWorkId(workId)) redirect("/");

  let target: string;
  try {
    const book = await getBook(workId);
    if (!book) redirect("/");
    if (book.authors.length === 0) {
      target = bookPage(workId, "no-author");
    } else {
      const id = await getAnalysisService().start({
        book: {
          workId: book.workId,
          title: book.title,
          authors: book.authors,
          firstPublishYear: book.firstPublishYear ?? null,
          description: book.description ?? null,
          subjects: book.subjects,
        },
        mode: "sources_only",
        language: "ru",
      });
      target = `/analysis/${id}`;
    }
  } catch (error) {
    if (error instanceof AnalysisBusyError) target = bookPage(workId, "busy");
    else if (error instanceof CatalogError) target = bookPage(workId, "catalog");
    else throw error;
  }
  redirect(target);
}

/** «Продолжить» для прерванного или упавшего анализа: готовые шаги не выполняются заново. */
export async function resumeAnalysisAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!isAnalysisId(id)) redirect("/");
  const service = getAnalysisService();
  const status = await service.status(id);
  if (!status) redirect("/");
  try {
    await service.start(status.meta.request);
  } catch (error) {
    if (!(error instanceof AnalysisBusyError)) throw error;
    redirect(`/analysis/${id}?busy=1`);
  }
  redirect(`/analysis/${id}`);
}
