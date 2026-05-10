import { CaretDown } from "@phosphor-icons/react";
import { useState } from "react";

type ThemedSelectOption = {
  value: string;
  label: string;
};

type ThemedSelectProps = {
  label: string;
  value: string;
  options: ThemedSelectOption[];
  onChange: (value: string) => void;
  className?: string;
};

export function ThemedSelect({ label, value, options, onChange, className = "" }: ThemedSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <label className={`grid gap-1 text-sm font-medium ${className}`}>
      {label}
      <span className="relative inline-flex min-w-48">
        <button
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={`${label.replace(/\s+/g, "-").toLowerCase()}-options`}
          className="theme-control inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border !border-[var(--color-border)] !bg-[var(--color-surface)] px-3 py-1.5 text-left !text-[var(--color-text)] hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{selected?.label ?? value}</span>
          <CaretDown size={14} weight="regular" aria-hidden="true" />
        </button>
        {open ? (
          <div
            id={`${label.replace(/\s+/g, "-").toLowerCase()}-options`}
            role="listbox"
            className="theme-surface absolute left-0 top-full z-50 mt-1 grid max-h-56 w-full overflow-auto rounded-md border !border-[var(--color-border)] !bg-[var(--color-surface)] p-1 shadow-lg"
            style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent/10 hover:text-accent"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </span>
    </label>
  );
}
