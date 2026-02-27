import { useEffect, useMemo, useState } from "react";

import { getPokemonSpriteFallbacks, resolvePokemonPokeApiId } from "@/lib/sprites";

interface SpriteImageProps {
  species: string;
  alt: string;
  className?: string;
  pokeapiId?: number;
}

export function SpriteImage({ species, alt, className = "", pokeapiId }: SpriteImageProps) {
  const [resolvedPokeapiId, setResolvedPokeapiId] = useState<number | undefined>(
    typeof pokeapiId === "number" && pokeapiId > 0 ? pokeapiId : undefined,
  );
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const validPokeApiId = typeof pokeapiId === "number" && pokeapiId > 0 ? pokeapiId : undefined;

    if (validPokeApiId) {
      setResolvedPokeapiId(validPokeApiId);
      return;
    }

    if (!species.trim()) {
      setResolvedPokeapiId(undefined);
      return;
    }

    setResolvedPokeapiId(undefined);
    void resolvePokemonPokeApiId(species).then((id) => {
      if (cancelled) return;
      setResolvedPokeapiId(id);
    });

    return () => {
      cancelled = true;
    };
  }, [species, pokeapiId]);

  const allSources = useMemo(
    () => getPokemonSpriteFallbacks(species, resolvedPokeapiId),
    [species, resolvedPokeapiId],
  );

  useEffect(() => {
    setSourceIndex(0);
  }, [species, resolvedPokeapiId]);

  const handleError = () => {
    setSourceIndex((current) => {
      const nextIndex = current + 1;
      return nextIndex < allSources.length ? nextIndex : current;
    });
  };

  const currentSrc = allSources[sourceIndex] ?? "/file.svg";

  return (
    <img
      alt={alt}
      className={className}
      onError={handleError}
      src={currentSrc}
    />
  );
}
