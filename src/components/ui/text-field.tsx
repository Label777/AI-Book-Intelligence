import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type TextFieldSize = "md" | "lg";

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  /** Подпись обязательна: без неё поле недоступно для экранных дикторов. */
  label: string;
  /** Скрыть подпись визуально, оставив её для экранных дикторов. */
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  fieldSize?: TextFieldSize;
  /** Классы для обёртки поля. */
  wrapperClassName?: string;
}

const sizes: Record<TextFieldSize, string> = {
  md: "min-h-11 px-3 text-base",
  lg: "min-h-14 px-4 text-lg",
};

export function TextField({
  label,
  hideLabel = false,
  hint,
  error,
  fieldSize = "md",
  id,
  className,
  wrapperClassName,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", wrapperClassName)}>
      <label
        htmlFor={inputId}
        className={hideLabel ? "sr-only" : "text-sm font-medium text-ink"}
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full min-w-0 rounded-control border bg-surface text-ink transition-colors duration-150 placeholder:text-ink-2",
          error ? "border-src-critique" : "border-line-strong hover:border-ink-2",
          sizes[fieldSize],
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-src-critique">
          {error}
        </p>
      ) : null}
    </div>
  );
}
