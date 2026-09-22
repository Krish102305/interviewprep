import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Label({ htmlFor, children, optional, className }: { htmlFor?: string; children: ReactNode; optional?: boolean; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-sm font-medium text-ink-800", className)}>
      {children}
      {optional && <span className="ml-1.5 text-xs font-normal text-ink-400">Optional</span>}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-red-600" role="alert">
      {children}
    </p>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs text-ink-500">{children}</p>;
}

type FieldProps = { label?: ReactNode; error?: string; hint?: ReactNode; optional?: boolean };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input(
  { label, error, hint, optional, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div>
      {label && <Label htmlFor={inputId} optional={optional}>{label}</Label>}
      <input ref={ref} id={inputId} aria-invalid={error ? true : undefined} aria-describedby={error ? `${inputId}-err` : undefined} className={cn("input-base", error && "border-red-400", className)} {...rest} />
      {hint && !error && <Hint>{hint}</Hint>}
      <FieldError id={`${inputId}-err`}>{error}</FieldError>
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(function Textarea(
  { label, error, hint, optional, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div>
      {label && <Label htmlFor={inputId} optional={optional}>{label}</Label>}
      <textarea ref={ref} id={inputId} aria-invalid={error ? true : undefined} aria-describedby={error ? `${inputId}-err` : undefined} className={cn("input-base min-h-[96px] resize-y leading-relaxed", error && "border-red-400", className)} {...rest} />
      {hint && !error && <Hint>{hint}</Hint>}
      <FieldError id={`${inputId}-err`}>{error}</FieldError>
    </div>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(function Select(
  { label, error, hint, optional, className, id, children, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div>
      {label && <Label htmlFor={inputId} optional={optional}>{label}</Label>}
      <select ref={ref} id={inputId} aria-invalid={error ? true : undefined} className={cn("input-base appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9", error && "border-red-400", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23686C72' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
        {children}
      </select>
      {hint && !error && <Hint>{hint}</Hint>}
      <FieldError id={`${inputId}-err`}>{error}</FieldError>
    </div>
  );
});

/** Accessible multi-select chip group (checkbox semantics). */
export function ChipGroup<T extends string>({ options, value, onChange, label, error, single }: { options: readonly { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; label?: string; error?: string; single?: boolean }) {
  const id = useId();
  return (
    <fieldset aria-describedby={error ? `${id}-err` : undefined}>
      {label && <legend className="mb-2 text-sm font-medium text-ink-800">{label}</legend>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={single ? "radio" : "checkbox"}
              aria-checked={on}
              onClick={() => onChange(single ? [o.value] : on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition",
                on ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-700 hover:border-ink-400",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </fieldset>
  );
}

/** Large selectable card used for the key AI-vs-Human and interview-type choices. */
export function ChoiceCard({ selected, onSelect, icon, title, description, children, name }: { selected: boolean; onSelect: () => void; icon?: ReactNode; title: string; description: string; children?: ReactNode; name: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      name={name}
      onClick={onSelect}
      className={cn(
        "group relative flex h-full w-full flex-col rounded-2xl border bg-white p-5 text-left transition",
        selected ? "border-ink-900 ring-1 ring-ink-900 shadow-lift" : "border-ink-200 hover:border-ink-400 hover:shadow-card",
      )}
    >
      <span className={cn("absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border", selected ? "border-ink-900 bg-ink-900" : "border-ink-300")} aria-hidden>
        {selected && <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
      {icon && <span className={cn("mb-4 flex h-11 w-11 items-center justify-center rounded-xl", selected ? "bg-olive-600 text-white" : "bg-olive-50 text-olive-700")}>{icon}</span>}
      <span className="text-base font-semibold text-ink-900">{title}</span>
      <span className="mt-1 text-sm leading-relaxed text-ink-500">{description}</span>
      {children}
    </button>
  );
}
