import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState, type FormEvent } from "react";
import { useFlowboard } from "../store/store";
import { isError } from "../types";
import { fieldClass, focusRing, ghostButton, primaryButton } from "./classes";

export function CreateSpaceDialog({ onClose }: { onClose: () => void }) {
  const containers = useFlowboard((state) => state.containers);
  const createContainer = useFlowboard((state) => state.createContainer);
  const workspace = containers.find((container) => container.type === "workspace");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!workspace) return;
    const result = createContainer({
      name,
      type: "space",
      parentId: workspace.id,
      description,
    });
    if (!isError(result)) onClose();
  }

  return (
    <Dialog open onClose={onClose} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-ink/40" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
        <DialogPanel className="mt-10 w-full max-w-lg rounded-card bg-surface-raised shadow-pop">
          <form onSubmit={submit}>
            <div className="flex items-start gap-4 px-6 pt-6">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-semibold text-ink">Create a Space</DialogTitle>
                <p className="mt-1 text-sm leading-6 text-ink-muted">
                  A Space represents teams, departments, or groups, each with its own Lists, workflows, and settings.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                className={`shrink-0 rounded-full bg-surface-sunken p-1.5 text-ink-muted hover:text-ink ${focusRing}`}
                onClick={onClose}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Icon &amp; name</p>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line bg-accent-soft text-sm font-semibold uppercase text-accent"
                  >
                    {name.trim().charAt(0) || "S"}
                  </span>
                  <input
                    autoFocus
                    aria-label="Space name"
                    placeholder="e.g. Marketing, Engineering, HR"
                    maxLength={120}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="space-description" className="mb-2 block text-sm font-medium text-ink">
                  Description <span className="font-normal text-ink-faint">(optional)</span>
                </label>
                <input
                  id="space-description"
                  maxLength={280}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
              <button type="button" className={ghostButton} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" disabled={!name.trim()} className={primaryButton}>
                Continue
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
