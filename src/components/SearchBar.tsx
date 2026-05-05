import { MagnifyingGlass } from "@phosphor-icons/react";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative">
      <MagnifyingGlass
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300"
        size={16}
        weight="regular"
        aria-hidden="true"
      />
      <input
        className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-9 pr-3 dark:border-slate-600 dark:bg-slate-800"
        aria-label="Search mods"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search"
      />
    </div>
  );
}
