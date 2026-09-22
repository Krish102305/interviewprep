"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { Label, FieldError } from "@/components/ui/form";

/** Free-text tags (target roles, companies). Enter or comma adds a tag. */
export function TagInput({ label, value, onChange, placeholder, max = 5, error, suggestions = [] }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; error?: string; suggestions?: string[] }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, "");
    if (!t || value.includes(t) || value.length >= max) return;
    onChange([...value, t]);
    setDraft("");
  };
  const id = label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="input-base flex flex-wrap items-center gap-1.5 py-2">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-ink-900 px-2.5 py-0.5 text-xs text-white">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(draft); }
            if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(draft)}
          placeholder={value.length >= max ? `Up to ${max}` : placeholder}
          disabled={value.length >= max}
          className="min-w-[8rem] flex-1 border-0 bg-transparent p-0.5 text-sm focus:outline-none focus:ring-0"
        />
      </div>
      {suggestions.length > 0 && value.length < max && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.filter((s) => !value.includes(s)).slice(0, 6).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-xs text-ink-600 hover:border-ink-400">+ {s}</button>
          ))}
        </div>
      )}
      <FieldError>{error}</FieldError>
    </div>
  );
}
