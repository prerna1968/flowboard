import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Switch } from "@headlessui/react";
import { useState, type FormEvent } from "react";
import { useFlowboard } from "../store/store";
import type { Permission } from "../types";
import { isError } from "../types";
import { fieldClass, focusRing, ghostButton, primaryButton } from "./classes";
import { SelectMenu } from "./SelectMenu";

const permissionOptions = [
  { value: "edit" as Permission, label: "Full edit" },
  { value: "view" as Permission, label: "View only" },
];

export function CreateSpaceDialog({ onClose }: { onClose: () => void }) {
  const containers = useFlowboard((state) => state.containers);
  const createContainer = useFlowboard((state) => state.createContainer);
  const workspace = containers.find((container) => container.type === "workspace");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permission, setPermission] = useState<Permission>("edit");
  const [isPrivate, setIsPrivate] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!workspace) return;
    const result = createContainer({
      name,
      type: "space",
      parentId: workspace.id,
      description,
      defaultPermission: permission,
      visibility: isPrivate ? "private" : "public",
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

              <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <PeopleIcon />
                  Default permission
                  <span
                    title="Full edit lets members create and change tasks in this Space. View only makes it read-only for them. Admins always keep full edit."
                    className="cursor-help text-ink-faint"
                  >
                    <InfoIcon />
                  </span>
                </span>
                <SelectMenu
                  ariaLabel="Default permission"
                  size="compact"
                  className="w-32 shrink-0"
                  value={permission}
                  options={permissionOptions}
                  onChange={setPermission}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium text-ink">Make Private</span>
                  <span className="block text-sm text-ink-muted">Only you and invited members have access</span>
                </span>
                <Switch
                  checked={isPrivate}
                  onChange={setIsPrivate}
                  aria-label="Make private"
                  className={`group relative flex h-6 w-11 shrink-0 items-center rounded-full bg-line data-[checked]:bg-accent ${focusRing}`}
                >
                  <span className="h-5 w-5 translate-x-0.5 rounded-full bg-surface-raised shadow transition group-data-[checked]:translate-x-[22px]" />
                </Switch>
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

function PeopleIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 text-ink-muted">
      <path
        d="M8 9.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zm-4.5 6.3c0-2.2 2-3.6 4.5-3.6s4.5 1.4 4.5 3.6M13.4 5.2a2.2 2.2 0 0 1 0 4.2m1.3 2.7c1.4.5 2.3 1.5 2.3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
      <circle cx="10" cy="10" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 9.2v3.4M10 7.1v.1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
