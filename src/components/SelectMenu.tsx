import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import type { ReactNode } from "react";
import { focusRing } from "./classes";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  className = "",
  size = "field",
  portal = true,
  menuWidth = "content",
}: {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  size?: "field" | "compact";
  portal?: boolean;
  menuWidth?: "content" | "button";
}) {
  const current = options.find((option) => option.value === value);
  const adding = !current && Boolean(placeholder);
  const items = options.map((option) => (
    <ListboxOption
      key={option.value}
      value={option.value}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink data-[focus]:bg-surface-sunken"
    >
      {({ selected }) => (
        <>
          {option.icon ?? null}
          <span className="flex-1 truncate text-left">{option.label}</span>
          {selected ? <span className="text-ink">✓</span> : null}
        </>
      )}
    </ListboxOption>
  ));
  const menuClass = `z-50 rounded-xl bg-surface-raised p-1.5 shadow-pop ring-1 ring-line focus:outline-none ${
    menuWidth === "button" ? "w-full" : "min-w-56"
  }`;

  return (
    <div className={`relative ${className}`}>
      <Listbox
        value={value ?? undefined}
        onChange={(next: T) => {
          if (next) onChange(next);
        }}
      >
        <ListboxButton
          aria-label={ariaLabel}
          className={`group flex w-full items-center gap-2 ${focusRing} ${
            adding
              ? "h-10 rounded-lg bg-surface-sunken px-3 text-sm text-ink-muted hover:bg-line"
              : size === "compact"
                ? "h-8 rounded-lg border border-line bg-surface-raised px-2.5 text-xs font-medium text-ink data-[open]:border-ink"
                : "h-10 rounded-lg border border-line bg-surface-raised px-3 text-sm text-ink data-[open]:border-ink"
          }`}
        >
          {current?.icon ?? (adding ? <span className="text-base leading-none">+</span> : null)}
          <span className="min-w-0 flex-1 truncate text-left">{current?.label ?? placeholder}</span>
          {current ? <ChevronIcon /> : null}
        </ListboxButton>
        {portal ? (
          <ListboxOptions anchor="bottom start" className={`${menuClass} [--anchor-gap:6px]`}>
            {items}
          </ListboxOptions>
        ) : (
          <ListboxOptions className={`absolute left-0 top-full z-50 mt-1.5 ${menuClass}`}>{items}</ListboxOptions>
        )}
      </Listbox>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 text-ink-faint group-data-[open]:rotate-180">
      <path d="M6 8.5 10 12l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
