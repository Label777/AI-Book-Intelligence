import Form from "next/form";
import { MAX_QUERY_LENGTH } from "@/books/query";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";

export interface SearchFormProps {
  defaultValue?: string;
  className?: string;
}

/**
 * Поле поиска книги. Отправка ведёт на /search?q=…; работает и без JavaScript.
 * Пустой запрос и запрос из одних пробелов браузер не отправит.
 */
export function SearchForm({ defaultValue, className }: SearchFormProps) {
  return (
    <Form
      action="/search"
      role="search"
      aria-label="Поиск книги"
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-end", className)}
    >
      <TextField
        label="Название книги и автор"
        name="q"
        type="search"
        fieldSize="lg"
        wrapperClassName="flex-1"
        placeholder="Например: Сапиенс, Харари"
        defaultValue={defaultValue}
        required
        pattern=".*\S.*"
        title="Введите название книги"
        maxLength={MAX_QUERY_LENGTH}
        autoComplete="off"
        autoCapitalize="sentences"
        enterKeyHint="search"
      />
      <Button type="submit" size="lg">
        Создать анализ
      </Button>
    </Form>
  );
}
