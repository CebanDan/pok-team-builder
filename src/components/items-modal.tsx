"use client";

import { useState, useMemo, useEffect } from "react";
import { Modal } from "@/components/modal";
import { type ItemEntry } from "@/lib/pokedex";
import { clsx } from "clsx";
import { sanitizePokeApiDescription } from "@/lib/string-utils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  items: ItemEntry[];
  onSelect: (itemName: string) => void;
  selectedItem?: string;
};

export function ItemsModal({
  isOpen,
  onClose,
  items,
  onSelect,
  selectedItem,
}: Props) {
  const [search, setSearch] = useState("");
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
  const [detailedItems, setDetailedItems] = useState<Record<string, ItemEntry>>({});
  const [spriteIndexByItem, setSpriteIndexByItem] = useState<Record<string, number>>({});

  function getItemSpriteCandidates(item: ItemEntry): string[] {
    const candidates: string[] = [];
    if (item.sprite) candidates.push(item.sprite);

    const normalizedName = item.name.toLowerCase();
    const slugVariants = Array.from(
      new Set([
        normalizedName,
        normalizedName.replace(/-([a-z0-9]+)$/i, "$1"),
        normalizedName.replace(/-/g, ""),
      ]),
    )
      .map((value) => value.replace(/[^a-z0-9-]/g, ""))
      .filter(Boolean);

    for (const slug of slugVariants) {
      candidates.push(`https://www.serebii.net/itemdex/sprites/${slug}.png`);
    }

    return Array.from(new Set(candidates));
  }

  const filteredItems = useMemo(() => {
    const normalizedTerm = search
      .toLowerCase()
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const searchTokens = normalizedTerm ? normalizedTerm.split(" ") : [];

    return items.filter((item) => {
      const searchBlob = [item.display, item.name, item.description ?? "", item.shortDescription ?? ""]
        .join(" ")
        .toLowerCase()
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const matchesSearch =
        searchTokens.length === 0 || searchTokens.every((token) => searchBlob.includes(token));
      return matchesSearch;
    });
  }, [items, search]);

  const handleSelect = async (item: ItemEntry) => {
    // If we don't have descriptions yet, fetch them before closing or just select
    onSelect(item.display);
    onClose();
  };

  const fetchItemDetails = async (item: ItemEntry) => {
    if (detailedItems[item.name] || loadingItems[item.name]) return;
    
    setLoadingItems(prev => ({ ...prev, [item.name]: true }));
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/item/${item.name}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      
      // Try to find effect entries first, then fallback to flavor text
      const englishEffect = data.effect_entries?.find((e: any) => e.language.name === "en");
      const englishFlavor = data.flavor_text_entries?.find((e: any) => e.language.name === "en");
      
      setDetailedItems(prev => ({
        ...prev,
        [item.name]: {
          ...item,
          description: sanitizePokeApiDescription(englishEffect?.effect || englishFlavor?.text),
          shortDescription: sanitizePokeApiDescription(englishEffect?.short_effect || englishFlavor?.text),
        }
      }));
    } catch {
      // Fallback
    } finally {
      setLoadingItems(prev => ({ ...prev, [item.name]: false }));
    }
  };

  useEffect(() => {
    setSpriteIndexByItem({});
  }, [items]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select an Item"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Search Bar & Filters */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className="h-4 w-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              className="input-dark w-full rounded-xl bg-slate-950/50 py-3 pl-10 pr-4 text-sm font-medium tracking-wide placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500/50 transition-all"
              placeholder="SEARCH FOR ITEM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[1.5fr_2fr] gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800">
          <span>Item Asset</span>
          <span>Description</span>
        </div>

        {/* Item List */}
        <div className="space-y-1 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const isActive = selectedItem === item.display;
              const details = detailedItems[item.name] || item;
              const isLoading = loadingItems[item.name];
              const spriteCandidates = getItemSpriteCandidates(item);
              const currentSpriteIndex = spriteIndexByItem[item.name] ?? 0;
              const canShowSprite =
                currentSpriteIndex >= 0 && currentSpriteIndex < spriteCandidates.length;
              const currentSprite = canShowSprite ? spriteCandidates[currentSpriteIndex] : null;

              return (
                <button
                  key={item.name}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => fetchItemDetails(item)}
                  className={clsx(
                    "group grid w-full grid-cols-[1.5fr_2fr] items-center gap-4 rounded-xl px-4 py-4 text-left transition-all duration-200",
                    isActive
                      ? "bg-amber-400/10 border-l-4 border-amber-400"
                      : "hover:bg-slate-800/50 border-l-4 border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {currentSprite ? (
                      <img
                        src={currentSprite}
                        alt={item.display}
                        className="h-8 w-8 object-contain"
                        onError={() =>
                          setSpriteIndexByItem((prev) => {
                            const previousIndex = prev[item.name] ?? 0;
                            const nextIndex = previousIndex + 1;
                            return {
                              ...prev,
                              [item.name]: nextIndex < spriteCandidates.length ? nextIndex : -1,
                            };
                          })
                        }
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-slate-800/50 flex items-center justify-center">
                        <span className="text-[8px] text-slate-600">?</span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span
                        className={clsx(
                          "text-xs font-bold italic uppercase tracking-wider transition-colors",
                          isActive ? "text-amber-400" : "text-slate-300 group-hover:text-amber-400"
                        )}
                      >
                        {item.display}
                      </span>
                      {item.category && (
                        <span className="text-[9px] font-bold uppercase tracking-tight text-slate-500">
                          {item.category.replace(/-/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] leading-relaxed text-slate-400 line-clamp-2 italic">
                      {details.shortDescription || details.description || (isLoading ? "Loading description..." : "No description available.")}
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-500 italic">
              No items found matching "{search}"
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
