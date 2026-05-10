import { Eye, ImageSquare, Power, WarningCircle } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import type { Mod } from "../lib/types";

type ModCardProps = {
  mod: Mod;
  disabled?: boolean;
  onToggle?: (mod: Mod) => void | Promise<void>;
  onDetails?: (mod: Mod) => void;
};

export function ModCard({ mod, disabled, onToggle, onDetails }: ModCardProps) {
  const buttonClass =
    "inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-accent dark:hover:bg-accent/10";

  return (
    <motion.article
      className="mod-card theme-surface grid gap-3 rounded-[14px] border !border-[var(--color-border)] !bg-[var(--color-surface)] p-[18px] !text-[var(--color-text)] transition duration-150 ease-in hover:-translate-y-px hover:border-accent hover:shadow-md dark:hover:border-accent dark:hover:shadow-accent/20"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
      aria-label={`mod-card-${mod.id}`}
      data-animated="true"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      whileTap={{ scale: 0.995 }}
    >
      <div className="preview grid h-[140px] place-items-center overflow-hidden rounded-[10px] border border-dashed !border-[var(--color-border)] text-slate-500 dark:text-slate-300">
        {mod.preview ? (
          <img className="h-full w-full object-cover" src={mod.preview} alt={mod.name} loading="lazy" />
        ) : (
          <span className="inline-flex items-center gap-2">
            <ImageSquare size={20} weight="regular" aria-hidden="true" />
            No Preview
          </span>
        )}
      </div>
      <h3 className="truncate text-lg font-semibold" title={mod.name}>
        {mod.name}
      </h3>
      <p className="truncate text-sm text-slate-600 dark:text-slate-300">{mod.files.length} files</p>
      {mod.source === "external" ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <WarningCircle size={14} weight="regular" aria-hidden="true" />
          External
        </span>
      ) : null}
      <div className="actions flex flex-wrap gap-2.5">
        <button
          type="button"
          aria-label={`toggle-${mod.id}`}
          disabled={Boolean(disabled)}
          className={buttonClass}
          onClick={() => void onToggle?.(mod)}
        >
          <Power size={16} weight="regular" aria-hidden="true" />
          {mod.enabled ? "Disable" : "Enable"}
        </button>
        <button
          type="button"
          aria-label={`details-${mod.id}`}
          className={buttonClass}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDetails?.(mod);
          }}
        >
          <Eye size={16} weight="regular" aria-hidden="true" />
          Details
        </button>
      </div>
    </motion.article>
  );
}
