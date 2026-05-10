import { Folder, X } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import type { GameInstance } from "../lib/types";

type SidebarProps = {
  instances: GameInstance[];
  selectedInstanceId: string | null;
  onSelectInstance: (id: string) => void;
  onCollapse?: () => void;
};

function friendlyName(instance: GameInstance, index: number) {
  const base =
    instance.source === "native"
      ? "Native Instance"
      : instance.source === "steam"
        ? "Steam Instance"
        : "Custom Instance";
  return `${base} ${index + 1}`;
}

export function Sidebar({ instances, selectedInstanceId, onSelectInstance, onCollapse }: SidebarProps) {
  return (
    <motion.aside
      className="sidebar theme-surface rounded-[14px] border !border-[var(--color-border)] p-5"
      aria-label="game-instances-sidebar"
      data-animated="true"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Game Instances</h2>
        <button
          type="button"
          aria-label="close-game-instances"
          className="inline-flex items-center gap-2 rounded-md border !border-[var(--color-border)] px-2 py-1 text-sm hover:border-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/40"
          onClick={onCollapse}
        >
          <X size={14} weight="regular" aria-hidden="true" />
          Close
        </button>
      </div>
      <ul className="m-0 grid list-none gap-3 p-0">
        {instances.map((instance, index) => {
          const isSelected = instance.id === selectedInstanceId;
          return (
            <li key={instance.id}>
              <button
                type="button"
                title={instance.path}
                aria-pressed={isSelected}
                className={`inline-flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                  isSelected
                    ? "active border-accent bg-accent/10 dark:border-accent dark:bg-accent/10"
                    : "!border-[var(--color-border)] bg-white hover:border-accent hover:bg-accent/10 dark:bg-slate-800 dark:hover:border-accent dark:hover:bg-accent/10"
                }`}
                onClick={() => onSelectInstance(instance.id)}
              >
                <Folder size={16} weight="regular" aria-hidden="true" />
                {friendlyName(instance, index)}
              </button>
            </li>
          );
        })}
      </ul>
    </motion.aside>
  );
}
