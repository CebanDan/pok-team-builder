import { useState, useEffect } from "react";
import { getPokemonSpriteFallbacks } from "@/lib/sprites";

interface SpriteImageProps {
  species: string;
  alt: string;
  className?: string;
}

export function SpriteImage({ species, alt, className = "" }: SpriteImageProps) {
  const fallbacks = getPokemonSpriteFallbacks(species);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  
  // Reset fallback index when species changes
  useEffect(() => {
    setFallbackIndex(0);
  }, [species]);
  
  const handleError = () => {
    setFallbackIndex((current) => {
      const nextIndex = current + 1;
      return nextIndex < fallbacks.length ? nextIndex : current;
    });
  };

  const currentSrc = fallbackIndex < fallbacks.length ? fallbacks[fallbackIndex] : "/file.svg";

  return (
    <img
      alt={alt}
      className={className}
      onError={handleError}
      src={currentSrc}
    />
  );
}
