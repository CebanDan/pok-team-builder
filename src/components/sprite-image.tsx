import { useState, useEffect } from "react";
import { getPokemonSpriteUrl, getPokemonSpriteFallbacks } from "@/lib/sprites";

interface SpriteImageProps {
  species: string;
  alt: string;
  className?: string;
}

export function SpriteImage({ species, alt, className = "" }: SpriteImageProps) {
  const primarySprite = getPokemonSpriteUrl(species);
  const fallbacks = getPokemonSpriteFallbacks(species);
  const allSources = [primarySprite, ...fallbacks];
  const [sourceIndex, setSourceIndex] = useState(0);
  
  // Reset source index when species changes
  useEffect(() => {
    setSourceIndex(0);
  }, [species]);
  
  const handleError = () => {
    setSourceIndex((current) => {
      const nextIndex = current + 1;
      return nextIndex < allSources.length ? nextIndex : current;
    });
  };

  const currentSrc = sourceIndex < allSources.length ? allSources[sourceIndex] : "/file.svg";

  return (
    <img
      alt={alt}
      className={className}
      onError={handleError}
      src={currentSrc}
    />
  );
}
