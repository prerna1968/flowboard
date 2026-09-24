import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { accents, type Accent, type Appearance } from "../lib/theme";
import { useTheme } from "../theme/ThemeProvider";
import { focusRing } from "./classes";

const swatchClass: Record<Accent, string> = {
  black: "bg-[#1b2430]",
  purple: "bg-[#7b68ee]",
  blue: "bg-[#2f6bff]",
  pink: "bg-[#e85d8e]",
  violet: "bg-[#8b5cf6]",
  indigo: "bg-[#6366f1]",
  orange: "bg-[#ea7e2b]",
  teal: "bg-[#14b8a6]",
  bronze: "bg-[#b4825a]",
  mint: "bg-[#34a884]",
};

const appearances: { id: Appearance; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "auto", label: "Auto" },
];

export function ThemeDialog({ onClose }: { onClose: () => void }) {
  const { prefs, setAppearance, setAccent } = useTheme();

  return (
    <Dialog open onClose={onClose} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-ink/40" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
        <DialogPanel className="mt-10 w-full max-w-lg rounded-card bg-surface-raised shadow-pop">
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <div>
              <DialogTitle className="text-lg font-semibold text-ink">Customize</DialogTitle>
              <p className="mt-1 text-sm leading-6 text-ink-muted">Personalize the Flowboard interface.</p>
            </div>
            <button
              type="button"
              aria-label="Close"
              className={`shrink-0 rounded-full bg-surface-sunken p-1.5 text-ink-muted hover:text-ink ${focusRing}`}
              onClick={onClose}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                <path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="px-6 pb-6 pt-5">
            <p className="mb-3 text-sm font-medium text-ink">Appearance</p>
            <div className="grid grid-cols-3 gap-3">
              {appearances.map((option) => {
                const selected = prefs.appearance === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    className={`rounded-xl p-1 text-center ${focusRing} ${
                      selected ? "ring-2 ring-accent" : "ring-1 ring-line hover:ring-ink-faint"
                    }`}
                    onClick={() => setAppearance(option.id)}
                  >
                    <AppearancePreview kind={option.id} />
                    <span className="mt-2 block pb-1 text-xs font-medium text-ink">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <p className="mb-3 mt-6 text-sm font-medium text-ink">Accent</p>
            <div className="grid grid-cols-3 gap-2">
              {accents.map((option) => (
                <AccentSwatch
                  key={option.id}
                  option={option}
                  selected={prefs.accent === option.id}
                  onSelect={setAccent}
                />
              ))}
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function AccentSwatch({
  option,
  selected,
  onSelect,
}: {
  option: { id: Accent; label: string; swatch: string };
  selected: boolean;
  onSelect: (accent: Accent) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`flex items-center gap-2 rounded-control border px-2.5 py-2 text-left text-sm ${focusRing} ${
        selected ? "border-ink bg-surface-sunken" : "border-line bg-surface-raised hover:bg-surface-sunken"
      }`}
      onClick={() => onSelect(option.id)}
    >
      <span className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${swatchClass[option.id]}`}>
        {selected ? (
          <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5 text-on">
            <path d="M2.4 6.2 4.7 8.5 9.6 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ) : null}
      </span>
      {option.label}
    </button>
  );
}

function AppearancePreview({ kind }: { kind: Appearance }) {
  if (kind === "dark") {
    return (
      <span className="flex h-16 items-center justify-center rounded-lg bg-[#1b1f27] px-3">
        <span className="flex h-10 w-full overflow-hidden rounded-md bg-[#11141a] ring-1 ring-white/10">
          <span className="w-4 bg-[#2a303b]" />
          <span className="flex flex-1 flex-col gap-1 p-1.5">
            <span className="h-1 w-8 rounded-full bg-white/40" />
            <span className="h-1 w-full rounded-full bg-white/15" />
            <span className="h-1 w-3/4 rounded-full bg-white/15" />
          </span>
        </span>
      </span>
    );
  }
  if (kind === "auto") {
    return (
      <span className="flex h-16 overflow-hidden rounded-lg">
        <span className="flex w-1/2 items-center justify-end bg-[#f4f5f7] pr-0.5">
          <span className="h-10 w-[calc(100%-6px)] rounded-l-md bg-white ring-1 ring-black/10" />
        </span>
        <span className="flex w-1/2 items-center justify-start bg-[#1b1f27] pl-0.5">
          <span className="h-10 w-[calc(100%-6px)] rounded-r-md bg-[#11141a] ring-1 ring-white/10" />
        </span>
      </span>
    );
  }
  return (
    <span className="flex h-16 items-center justify-center rounded-lg bg-[#f4f5f7] px-3">
      <span className="flex h-10 w-full overflow-hidden rounded-md bg-white ring-1 ring-black/10">
        <span className="w-4 bg-[#e9ebef]" />
        <span className="flex flex-1 flex-col gap-1 p-1.5">
          <span className="h-1 w-8 rounded-full bg-black/40" />
          <span className="h-1 w-full rounded-full bg-black/10" />
          <span className="h-1 w-3/4 rounded-full bg-black/10" />
        </span>
      </span>
    </span>
  );
}
