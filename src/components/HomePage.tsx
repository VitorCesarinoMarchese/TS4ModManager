import type { Mod } from "../lib/types";
import { ModGrid } from "./ModGrid";

type HomePageProps = {
  mods: Mod[];
  search: string;
  onToggle?: (mod: Mod) => void | Promise<void>;
  onDetails?: (mod: Mod) => void;
  toggleDisabledById?: Record<string, boolean>;
};

export function HomePage({ mods, search, onToggle, onDetails, toggleDisabledById = {} }: HomePageProps) {
  return (
    <section>
      <ModGrid
        mods={mods}
        search={search}
        onToggle={onToggle}
        onDetails={onDetails}
        toggleDisabledById={toggleDisabledById}
      />
    </section>
  );
}
