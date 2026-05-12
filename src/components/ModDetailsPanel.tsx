import { FloppyDisk, X } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getMetadataProviderForUrl } from "../lib/metadataProviders";
import { resolvePreviewSrc } from "../lib/previewImage";
import type { Mod, SourceCandidate, SourceMetadata } from "../lib/types";

type ModDetailsPanelProps = {
  mod: Mod;
  onClose: () => void;
  onRename?: (modId: string, newName: string) => void | Promise<void>;
  onAttachSourceUrl?: (modId: string, sourceUrl: string, providerId?: string, metadata?: SourceMetadata) => void | Promise<void>;
  onRemoveSourceUrl?: (modId: string) => void | Promise<void>;
  onOpenSourceUrl?: (sourceUrl: string) => void;
  onFindSourceCandidates?: (modId: string) => Promise<SourceCandidate[]>;
  sourceLookupHasApiKey?: boolean;
  onUninstall?: (modId: string) => void | Promise<void>;
  onManageExternal?: (modId: string) => void | Promise<void>;
};

export function ModDetailsPanel({ mod, onClose, onRename, onAttachSourceUrl, onRemoveSourceUrl, onOpenSourceUrl, onFindSourceCandidates, sourceLookupHasApiKey = false, onUninstall, onManageExternal }: ModDetailsPanelProps) {
  const [name, setName] = useState(mod.name);
  const [sourceUrl, setSourceUrl] = useState(mod.sourceUrl ?? "");
  const [confirmRemoveSource, setConfirmRemoveSource] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [sourceLookupStatus, setSourceLookupStatus] = useState<"idle" | "loading">("idle");
  const [sourceCandidates, setSourceCandidates] = useState<SourceCandidate[]>([]);
  const [sourceLookupSearched, setSourceLookupSearched] = useState(false);
  const [ignoredCandidateUrls, setIgnoredCandidateUrls] = useState<Set<string>>(() => new Set());
  const buttonClass =
    "inline-flex items-center gap-2 rounded-md border !border-[var(--color-border)] bg-white px-3 py-1.5 text-sm hover:border-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/40 dark:bg-slate-800 dark:hover:border-accent dark:hover:bg-accent/10";
  const dangerButtonClass =
    "inline-flex items-center gap-2 rounded-md border !border-[var(--color-border)] bg-white px-3 py-1.5 text-sm hover:!border-red-500 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/40 dark:bg-slate-800 dark:hover:!border-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-300";

  useEffect(() => {
    setName(mod.name);
    setSourceUrl(mod.sourceUrl ?? "");
    setSourceCandidates([]);
    setSourceLookupSearched(false);
    setIgnoredCandidateUrls(new Set());
    setSourceLookupStatus("idle");
  }, [mod.id, mod.name, mod.sourceUrl]);

  const selectedProvider = getMetadataProviderForUrl(sourceUrl);
  const existingProvider = mod.sourceUrl ? getMetadataProviderForUrl(mod.sourceUrl) : null;
  const visibleCandidates = sourceCandidates.filter((candidate) => !ignoredCandidateUrls.has(candidate.sourceUrl));

  return (
    <motion.div
      className="modal-backdrop fixed inset-0 z-20 grid place-items-center bg-black/35 p-4"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.section
        className="modal grid max-h-[90vh] w-[min(860px,100%)] gap-5 overflow-auto rounded-[14px] border !border-[var(--color-border)] bg-white p-6 dark:bg-slate-900"
        role="dialog"
        aria-label="mod-details"
        data-animated="true"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header flex items-center justify-between gap-4">
          <h2 className="truncate text-xl font-semibold">{mod.name}</h2>
          <button type="button" aria-label="close-mod-details" className={dangerButtonClass} onClick={onClose}>
            <X size={16} weight="regular" aria-hidden="true" />
            Close
          </button>
        </header>

        <label className="text-sm font-medium" htmlFor="edit-mod-name">
          Mod name
        </label>
        <div className="actions flex flex-wrap gap-2.5">
          <input
            id="edit-mod-name"
            aria-label="edit-mod-name"
            className="min-w-0 flex-1 rounded-md border !border-[var(--color-border)] bg-white px-3 py-1.5 dark:bg-slate-800"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            aria-label="save-mod-name"
            className={buttonClass}
            onClick={() => {
              const next = name.trim();
              if (!next) return;
              onRename?.(mod.id, next);
            }}
          >
            <FloppyDisk size={16} weight="regular" aria-hidden="true" />
            Save Name
          </button>
        </div>

        <label className="text-sm font-medium" htmlFor="edit-source-url">
          Source URL
        </label>
        <div className="actions flex flex-wrap gap-2.5">
          <input
            id="edit-source-url"
            aria-label="edit-source-url"
            className="min-w-0 flex-1 rounded-md border !border-[var(--color-border)] bg-white px-3 py-1.5 dark:bg-slate-800"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://www.curseforge.com/sims4/mods/..."
          />
          <button
            type="button"
            aria-label="save-source-url"
            className={buttonClass}
            onClick={async () => {
              const next = sourceUrl.trim();
              if (!next) return;
              const metadata = selectedProvider ? await selectedProvider.fetchMetadataFromUrl(next) : undefined;
              onAttachSourceUrl?.(mod.id, next, selectedProvider?.id, metadata);
            }}
          >
            <FloppyDisk size={16} weight="regular" aria-hidden="true" />
            Save Source
          </button>
          {mod.sourceUrl ? (
            <>
              <button
                type="button"
                aria-label="open-source-url"
                className={buttonClass}
                onClick={() => onOpenSourceUrl?.(mod.sourceUrl!)}
              >
                Open Source
              </button>
              <button
                type="button"
                aria-label="remove-source-url"
                className={dangerButtonClass}
                onClick={() => setConfirmRemoveSource(true)}
              >
                Remove Source
              </button>
            </>
          ) : null}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Provider: {existingProvider?.name ?? selectedProvider?.name ?? "Manual"}
        </p>

        {onFindSourceCandidates ? (
          <section aria-label="source-candidates" className="grid gap-3 rounded-md border !border-[var(--color-border)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">Find Source</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">Search CurseForge candidates from local file evidence.</p>
                {!sourceLookupHasApiKey ? <p className="text-sm text-amber-600 dark:text-amber-300">Add a CurseForge API key in Settings for live lookup.</p> : null}
              </div>
              <button
                type="button"
                aria-label="find-source-candidates"
                className={buttonClass}
                disabled={sourceLookupStatus === "loading"}
                onClick={async () => {
                  setSourceLookupStatus("loading");
                  const candidates = await onFindSourceCandidates(mod.id);
                  setSourceCandidates(candidates);
                  setSourceLookupSearched(true);
                  setIgnoredCandidateUrls(new Set());
                  setSourceLookupStatus("idle");
                }}
              >
                {sourceLookupStatus === "loading" ? "Searching..." : "Find Source"}
              </button>
            </div>
            {sourceLookupStatus === "loading" ? <p className="text-sm" role="status">Searching CurseForge...</p> : null}
            {sourceLookupStatus === "idle" && sourceLookupSearched && sourceCandidates.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">No source candidates found.</p>
            ) : null}
            {sourceLookupStatus === "idle" && sourceCandidates.length > 0 && visibleCandidates.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">All candidates ignored.</p>
            ) : null}
            {visibleCandidates.map((candidate) => (
              <article key={candidate.sourceUrl} aria-label="source-candidate" className="grid gap-2 rounded-md border !border-[var(--color-border)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{candidate.title}</p>
                    {candidate.author ? <p className="text-sm text-slate-600 dark:text-slate-300">By {candidate.author}</p> : null}
                    <p className="text-sm">{candidate.confidence}% · {candidate.confidenceLevel === "high" ? "High confidence" : candidate.confidenceLevel === "medium" ? "Medium confidence" : "Low confidence"}</p>
                    {candidate.confidence < 70 ? <p className="text-sm text-amber-600 dark:text-amber-300">Please verify before attaching.</p> : null}
                  </div>
                  {candidate.previewUrl ? <img className="h-16 w-24 rounded-md object-cover" src={resolvePreviewSrc(candidate.previewUrl)} alt="" loading="lazy" /> : null}
                </div>
                <ul className="m-0 grid list-disc gap-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                  {candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-label="attach-source-candidate"
                    className={buttonClass}
                    onClick={() => onAttachSourceUrl?.(mod.id, candidate.sourceUrl, candidate.providerId, { displayName: candidate.title, previewUrl: candidate.previewUrl })}
                  >
                    Attach
                  </button>
                  <button type="button" aria-label="open-source-candidate" className={buttonClass} onClick={() => onOpenSourceUrl?.(candidate.sourceUrl)}>
                    Open
                  </button>
                  <button
                    type="button"
                    aria-label="ignore-source-candidate"
                    className={dangerButtonClass}
                    onClick={() => setIgnoredCandidateUrls((current) => new Set([...current, candidate.sourceUrl]))}
                  >
                    Ignore
                  </button>
                </div>
              </article>
            ))}
            {sourceLookupStatus === "idle" && !sourceLookupSearched ? <p className="text-sm text-slate-600 dark:text-slate-300">No candidates loaded yet.</p> : null}
          </section>
        ) : null}

        {mod.source === "external" && onManageExternal ? (
          <button
            type="button"
            aria-label="manage-external-mod"
            className={buttonClass}
            onClick={() => onManageExternal(mod.id)}
          >
            Manage this mod
          </button>
        ) : null}

        {onUninstall ? (
          <button
            type="button"
            aria-label="uninstall-mod"
            className={dangerButtonClass}
            onClick={() => setConfirmUninstall(true)}
          >
            Move to Trash
          </button>
        ) : null}

        {confirmUninstall ? (
          <div
            role="alertdialog"
            aria-label="uninstall-warning"
            className="grid gap-3 rounded-md border border-red-500 bg-red-50 p-4 text-sm dark:bg-red-950/20"
          >
            <p className="font-medium text-red-700 dark:text-red-300">Move mod to trash?</p>
            <p className="text-slate-700 dark:text-slate-300">
              This removes manager-created symlinks when present and moves the installed mod files to trash.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-label="confirm-uninstall"
                className={dangerButtonClass}
                onClick={() => {
                  setConfirmUninstall(false);
                  onUninstall?.(mod.id);
                }}
              >
                Move to Trash
              </button>
              <button
                type="button"
                aria-label="cancel-uninstall"
                className={buttonClass}
                onClick={() => setConfirmUninstall(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {confirmRemoveSource ? (
          <div
            role="alertdialog"
            aria-label="remove-source-warning"
            className="grid gap-3 rounded-md border border-red-500 bg-red-50 p-4 text-sm dark:bg-red-950/20"
          >
            <p className="font-medium text-red-700 dark:text-red-300">Remove saved source URL?</p>
            <p className="text-slate-700 dark:text-slate-300">
              This only removes metadata. It does not delete mod files.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-label="confirm-remove-source"
                className={dangerButtonClass}
                onClick={() => {
                  setConfirmRemoveSource(false);
                  onRemoveSourceUrl?.(mod.id);
                }}
              >
                Remove Source
              </button>
              <button
                type="button"
                aria-label="cancel-remove-source"
                className={buttonClass}
                onClick={() => setConfirmRemoveSource(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <p className="text-sm text-slate-600 dark:text-slate-300">{mod.files.length} files</p>
        <ul className="m-0 grid list-none gap-2 p-0">
          {mod.files.map((file) => (
            <li
              key={file}
              className="truncate rounded-md border !border-[var(--color-border)] px-3 py-2 text-sm"
              title={file}
            >
              {file}
            </li>
          ))}
        </ul>
      </motion.section>
    </motion.div>
  );
}
