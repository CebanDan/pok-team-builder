"use client";

import { useMemo, useState } from "react";

import { normalizeName } from "@/lib/pokedex";

type Props = {
  value: string;
  options: string[];
  onChange: (nextValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function TextAutocomplete({ value, options, onChange, placeholder, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const query = normalizeName(value);
  const hasQuery = query.length > 0;

  const filtered = useMemo(() => {
    if (!query) return [];
    return options
      .map((option) => {
        const normalized = normalizeName(option);
        if (!normalized.includes(query)) return null;
        const rank = normalized.startsWith(query) ? 0 : 1;
        return { option, rank };
      })
      .filter((entry): entry is { option: string; rank: number } => Boolean(entry))
      .sort((left, right) => left.rank - right.rank || left.option.localeCompare(right.option))
      .slice(0, 60)
      .map((entry) => entry.option);
  }, [options, query]);

  return (
    <div className="relative">
      <input
        className="input-dark w-full rounded-md px-2 py-1.5 text-xs shadow-sm transition disabled:opacity-60"
        disabled={disabled}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && filtered.length > 0) {
            event.preventDefault();
            onChange(filtered[0]);
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        value={value}
      />

      {open && hasQuery && !disabled ? (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-700 bg-slate-950/95 shadow-2xl">
          {filtered.length ? (
            filtered.map((option) => (
              <button
                className="w-full px-2 py-1.5 text-left text-xs text-slate-100 transition hover:bg-slate-800"
                key={`text-option-${option}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                type="button"
              >
                {option}
              </button>
            ))
          ) : (
            <div className="px-2 py-2 text-xs text-slate-400">No matches.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

