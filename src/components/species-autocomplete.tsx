"use client";

import { useEffect, useMemo, useState } from "react";

import { normalizeName, type SpeciesEntry } from "@/lib/pokedex";

import { SpriteImage } from "@/components/sprite-image";

type Props = {
  value: string;
  species: SpeciesEntry[];
  onChange: (nextValue: string) => void;
  placeholder?: string;
  matchMode?: "contains" | "prefix";
};

const SPECIES_CACHE_KEY = "pok-team-builder-species-v2";

function toDisplay(value: string): string {
  return value
    .split("-")
    .map((part) => (part.length ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function getPokeApiId(url: string): number | undefined {
  const match = url.match(/\/(\d+)\/?$/);
  if (!match) return undefined;
  return Number.parseInt(match[1], 10);
}

export function SpeciesAutocomplete({
  value,
  species,
  onChange,
  placeholder,
  matchMode = "contains",
}: Props) {
  const [open, setOpen] = useState(false);
  const [fallbackSpecies, setFallbackSpecies] = useState<SpeciesEntry[]>([]);
  const [loadingFallback, setLoadingFallback] = useState(false);
  const query = normalizeName(value);
  const hasQuery = query.length > 0;
  const sourceSpecies = species.length ? species : fallbackSpecies;

  useEffect(() => {
    if (species.length || fallbackSpecies.length || loadingFallback) return;

    let cancelled = false;
    async function loadFallbackSpecies() {
      setLoadingFallback(true);
      try {
        const cached = window.localStorage.getItem(SPECIES_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as SpeciesEntry[];
          if (Array.isArray(parsed) && parsed.length) {
            setFallbackSpecies(parsed);
            return;
          }
        }
      } catch {
        // Ignore local cache parse errors and refetch.
      }

      try {
        const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=2000");
        if (!response.ok) return;
        const payload = (await response.json()) as {
          results: { name: string; url: string }[];
        };
        const mapped = payload.results.map((entry) => {
          const pokeapiId = getPokeApiId(entry.url);
          return {
            name: entry.name,
            display: toDisplay(entry.name),
            types: [],
            forms: [],
            pokeapiId,
            sprite: pokeapiId
              ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeapiId}.png`
              : undefined,
          } satisfies SpeciesEntry;
        });
        if (cancelled) return;
        setFallbackSpecies(mapped);
        try {
          window.localStorage.setItem(SPECIES_CACHE_KEY, JSON.stringify(mapped));
        } catch {
          // Ignore cache write failures.
        }
      } catch {
        // Ignore network failures here and keep input usable.
      } finally {
        if (!cancelled) {
          setLoadingFallback(false);
        }
      }
    }

    void loadFallbackSpecies();
    return () => {
      cancelled = true;
    };
  }, [species.length, fallbackSpecies.length, loadingFallback]);

  const filtered = useMemo(() => {
    if (!query) return [];

    const ranked = sourceSpecies
      .map((entry) => {
        const normalizedDisplay = normalizeName(entry.display);
        const normalizedName = normalizeName(entry.name);
        const startsDisplay = normalizedDisplay.startsWith(query);
        const startsName = normalizedName.startsWith(query);
        const includesDisplay =
          matchMode === "prefix" ? startsDisplay : normalizedDisplay.includes(query);
        const includesName =
          matchMode === "prefix" ? startsName : normalizedName.includes(query);

        if (!includesDisplay && !includesName) return null;

        const rank = startsDisplay ? 0 : startsName ? 1 : includesDisplay ? 2 : 3;
        return { entry, rank };
      })
      .filter((value): value is { entry: SpeciesEntry; rank: number } => Boolean(value))
      .sort((a, b) => a.rank - b.rank || a.entry.display.localeCompare(b.entry.display));

    return ranked.slice(0, 60).map((value) => value.entry);
  }, [matchMode, query, sourceSpecies]);

  return (
    <div className="relative">
      <input
        className="input-dark w-full rounded-md px-2 py-1.5 text-xs shadow-sm transition"
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && filtered.length > 0) {
            event.preventDefault();
            onChange(filtered[0].display);
            setOpen(false);
          }
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        value={value}
      />
      {open && hasQuery ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-700 bg-slate-950/95 shadow-2xl">
          {!sourceSpecies.length ? (
            <div className="px-2 py-2 text-xs text-slate-400">
              {loadingFallback ? "Loading Pokemon..." : "Pokemon list unavailable right now."}
            </div>
          ) : filtered.length ? (
            filtered.map((entry) => (
              <button
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs text-slate-100 transition hover:bg-slate-800"
                key={`species-option-${entry.name}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(entry.display);
                  setOpen(false);
                }}
                type="button"
              >
                <span className="flex items-center gap-2">
                  <SpriteImage
                    alt={entry.display}
                    className="h-7 w-7 rounded object-contain"
                    pokeapiId={entry.pokeapiId}
                    species={entry.name}
                  />
                  <span>{entry.display}</span>
                </span>
                <span className="flex items-center gap-1">
                  {entry.types?.slice(0, 2).map((typeName) => (
                    <span
                      className="rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-[10px] uppercase text-slate-300"
                      key={`${entry.name}-${typeName}`}
                    >
                      {typeName}
                    </span>
                  ))}
                </span>
              </button>
            ))
          ) : (
            <div className="px-2 py-2 text-xs text-slate-400">No Pokemon found.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
