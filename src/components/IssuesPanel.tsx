import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import type { Issue } from "../lib/types";

type IssuesPanelProps = {
  issues: Issue[];
};

export function IssuesPanel({ issues }: IssuesPanelProps) {
  return (
    <aside className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="issues-panel">
      <h2 className="text-lg font-semibold">Issues</h2>
      {issues.length === 0 ? (
        <p className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <CheckCircle size={18} weight="regular" aria-hidden="true" />
          No issues detected
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {issues.map((issue) => (
            <li key={issue.id} className="grid gap-1 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
              <strong className="inline-flex items-center gap-2 text-sm">
                <WarningCircle size={16} weight="regular" aria-hidden="true" />
                {issue.severity.toUpperCase()}
              </strong>
              <span>{issue.message}</span>
              {issue.code ? <code className="text-sm">{issue.code}</code> : null}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
