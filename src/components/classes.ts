export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

export const fieldClass = `w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint ${focusRing}`;

export const primaryButton = `inline-flex items-center justify-center rounded-control bg-accent px-3 py-2 text-sm font-medium text-on hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const ghostButton = `inline-flex items-center justify-center rounded-control px-2 py-1 text-sm font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink ${focusRing}`;

export const dangerButton = `inline-flex items-center justify-center rounded-control px-3 py-2 text-sm font-medium text-danger hover:bg-danger-soft ${focusRing}`;
