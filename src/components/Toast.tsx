import type { Issue } from "../lib/types";

type ToastProps = {
  issue: Issue | null;
};

export function Toast({ issue }: ToastProps) {
  if (!issue) return null;

  return (
    <div role="status" aria-live="polite">
      <strong>{issue.severity.toUpperCase()}</strong>
      <span>{issue.message}</span>
    </div>
  );
}
