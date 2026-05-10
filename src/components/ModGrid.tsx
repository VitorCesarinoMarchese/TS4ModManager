import { useEffect, useMemo, useState } from "react";
import { getPagination } from "../lib/pagination";
import type { Mod } from "../lib/types";
import { ModCard } from "./ModCard";
import { ThemedSelect } from "./ThemedSelect";

type ModGridProps = {
  mods: Mod[];
  search: string;
  onToggle?: (mod: Mod) => void | Promise<void>;
  onDetails?: (mod: Mod) => void;
  toggleDisabledById?: Record<string, boolean>;
};

export function ModGrid({ mods, search, onToggle, onDetails, toggleDisabledById = {} }: ModGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      mods.filter((mod) => {
        if (!q) return true;
        return mod.name.toLowerCase().includes(q) || mod.files.some((f) => f.toLowerCase().includes(q));
      }),
    [mods, q]
  );

  const pagination = getPagination({
    totalItems: filtered.length,
    pageSize,
    currentPage
  });

  useEffect(() => {
    if (pagination.currentPage !== currentPage) {
      setCurrentPage(pagination.currentPage);
    }
  }, [currentPage, pagination.currentPage]);

  const visibleMods = filtered.slice(pagination.startIndex, pagination.endIndex);
  const pageButtonClass = (page: number) =>
    `rounded-md border px-3 py-1.5 text-sm ${
      page === pagination.currentPage
        ? "border-accent bg-accent text-white"
        : "!border-[var(--color-border)] bg-white hover:border-accent hover:bg-accent/10 dark:bg-slate-800 dark:hover:border-accent dark:hover:bg-accent/10"
    }`;
  const navButtonClass =
    "rounded-md border !border-[var(--color-border)] bg-white px-3 py-1.5 text-sm hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:hover:border-accent dark:hover:bg-accent/10";

  return (
    <section className="grid gap-4" aria-label="mods-grid">
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed !border-[var(--color-border)] p-8 text-center text-slate-600 dark:text-slate-300">
          No mods match your search.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              Showing {pagination.startItem}–{pagination.endItem} of {filtered.length} mods
            </p>
            <ThemedSelect
              label="Mods per page"
              value={String(pageSize)}
              options={[
                { value: "12", label: "12" },
                { value: "24", label: "24" },
                { value: "48", label: "48" }
              ]}
              onChange={(value) => setPageSize(Number(value))}
              className="inline-flex items-center gap-2"
            />
          </div>

          <div className="mod-grid grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
            {visibleMods.map((mod) => (
              <ModCard
                key={mod.id}
                mod={mod}
                disabled={Boolean(toggleDisabledById[mod.id])}
                onToggle={onToggle}
                onDetails={onDetails}
              />
            ))}
          </div>

          <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="mods-pagination">
            <button
              type="button"
              className={navButtonClass}
              disabled={pagination.currentPage === 1}
              aria-label="Previous page"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Previous
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                className={pageButtonClass(page)}
                aria-label={`Page ${page}`}
                aria-current={page === pagination.currentPage ? "page" : undefined}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              className={navButtonClass}
              disabled={pagination.currentPage === pagination.totalPages}
              aria-label="Next page"
              onClick={() => setCurrentPage((page) => Math.min(pagination.totalPages, page + 1))}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
