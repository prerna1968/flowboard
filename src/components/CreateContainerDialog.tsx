import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useMemo, useState, type FormEvent } from "react";
import { sidebarContainers } from "../store/permissions";
import { useFlowboard } from "../store/store";
import type { Container } from "../types";
import { isError } from "../types";
import { fieldClass, focusRing, primaryButton } from "./classes";
import { SelectMenu } from "./SelectMenu";

export function CreateContainerDialog({
  type,
  defaultParentId,
  onClose,
}: {
  type: "list" | "folder";
  defaultParentId: string;
  onClose: () => void;
}) {
  const containers = useFlowboard((state) => state.containers);
  const grants = useFlowboard((state) => state.grants);
  const users = useFlowboard((state) => state.users);
  const currentUserId = useFlowboard((state) => state.currentUserId);
  const createContainer = useFlowboard((state) => state.createContainer);
  const selectList = useFlowboard((state) => state.selectList);
  const user = users.find((item) => item.id === currentUserId);
  const visible = useMemo(
    () => (user ? sidebarContainers(containers, user, grants) : []),
    [containers, grants, user],
  );
  const locations = locationOptions(visible, type);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState(locations.some((item) => item.id === defaultParentId) ? defaultParentId : (locations[0]?.id ?? ""));
  const creating = type === "list" ? "List" : "Folder";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!parentId) return;
    const result = createContainer({
      name,
      type,
      parentId,
      description: type === "folder" ? description : undefined,
    });
    if (isError(result)) return;
    if (result.data.type === "list") selectList(result.data.id);
    onClose();
  }

  return (
    <Dialog open onClose={onClose} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-ink/40" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
        <DialogPanel className="mt-10 w-full max-w-lg rounded-card bg-surface-raised shadow-pop">
          <form onSubmit={submit}>
            <div className="flex items-start gap-4 px-6 pt-6">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-semibold text-ink">Create {creating}</DialogTitle>
                <p className="mt-1 text-sm leading-6 text-ink-muted">
                  {type === "list"
                    ? "All Lists are located within a Space. Lists can house any type of task."
                    : "Use Folders to organize your Lists, Docs, and more."}
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
                <label htmlFor="container-name" className="mb-2 block text-sm font-medium text-ink">
                  Name<span className="text-danger">*</span>
                </label>
                <input
                  id="container-name"
                  autoFocus
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={type === "list" ? "e.g. Project, List of items, Campaign" : "e.g. Project, Client, Team"}
                  className={fieldClass}
                />
              </div>

              {type === "folder" ? (
                <div>
                  <label htmlFor="folder-description" className="mb-2 block text-sm font-medium text-ink">
                    Description
                  </label>
                  <input
                    id="folder-description"
                    maxLength={280}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Tell us a bit about your Folder (optional)"
                    className={fieldClass}
                  />
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-sm font-medium text-ink">{type === "list" ? "Space (location)" : "Select a Location"}</p>
                <SelectMenu
                  ariaLabel="Location"
                  portal={false}
                  menuWidth="button"
                  value={parentId || null}
                  options={locations.map((item) => ({
                    value: item.id,
                    label: item.name,
                    icon: <LocationIcon container={item} />,
                  }))}
                  onChange={setParentId}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
              <button type="submit" disabled={!name.trim() || !parentId} className={primaryButton}>
                Create
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function locationOptions(containers: Container[], type: "list" | "folder"): Container[] {
  const spaces = containers
    .filter((container) => container.type === "space" && !container.archivedAt)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  if (type === "folder") return spaces;
  return spaces.flatMap((space) => [
    space,
    ...containers
      .filter((container) => container.type === "folder" && container.parentId === space.id && !container.archivedAt)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
  ]);
}

function LocationIcon({ container }: { container: Container }) {
  if (container.type === "space") {
    const tone = container.id.includes("design") ? "bg-accent" : "bg-priority-normal";
    return <span className={`h-3.5 w-3.5 shrink-0 rounded-[3px] ${tone}`} />;
  }
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-faint">
      <path fill="currentColor" d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.2l1.4 1.6H15.5A1.5 1.5 0 0 1 17 7.1v7.4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
