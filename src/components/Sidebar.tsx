import { Folder } from "@phosphor-icons/react";
import type { GameInstance } from "../lib/types";

type SidebarProps = {
  instances: GameInstance[];
  selectedInstanceId: string | null;
  onSelectInstance: (id: string) => void;
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

export function Sidebar({ instances, selectedInstanceId, onSelectInstance }: SidebarProps) {
  return (
    <aside
      className="sidebar rounded-[14px] border border-slate-300 p-5 dark:border-slate-700"
      aria-label="game-instances-sidebar"
    >
      <h2 className="mb-4 text-lg font-semibold">Game Instances</h2>
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
                    ? "active border-blue-400 bg-blue-50 dark:border-blue-400 dark:bg-slate-800"
                    : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-300 dark:hover:bg-slate-700"
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
    </aside>
  );
}
