import type { Mod } from "../lib/types";
import { ModCard } from "./ModCard";

type ModGridProps = {
  mods: Mod[];
  search: string;
  onToggle?: (mod: Mod) => void | Promise<void>;
  onDetails?: (mod: Mod) => void;
  toggleDisabledById?: Record<string, boolean>;
};

export function ModGrid({ mods, search, onToggle, onDetails, toggleDisabledById = {} }: ModGridProps) {
  const q = search.trim().toLowerCase();
  const filtered = mods.filter((mod) => {
    if (!q) return true;
    return mod.name.toLowerCase().includes(q) || mod.files.some((f) => f.toLowerCase().includes(q));
  });

  return (
    <section className="mod-grid grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5" aria-label="mods-grid">
      {filtered.map((mod) => (
        <ModCard
          key={mod.id}
          mod={mod}
          disabled={Boolean(toggleDisabledById[mod.id])}
          onToggle={onToggle}
          onDetails={onDetails}
        />
      ))}
    </section>
  );
}
