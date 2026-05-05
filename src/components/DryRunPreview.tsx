import type { DryRunResult } from "../lib/types";

type DryRunPreviewProps = {
  dryRun: DryRunResult | null;
};

export function DryRunPreview({ dryRun }: DryRunPreviewProps) {
  if (!dryRun) return null;

  return (
    <section aria-label="dry-run-preview">
      <h2>Dry-Run Preview</h2>
      <p>{dryRun.canApply ? "Can apply" : "Blocked"}</p>
      <ul>
        {dryRun.operations.map((op, i) => (
          <li key={`${op.action}-${op.path}-${i}`}>
            <strong>{op.action}</strong>
            <span>{op.path}</span>
            {op.reason ? <em>{op.reason}</em> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
