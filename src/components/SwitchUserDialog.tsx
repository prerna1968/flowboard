import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { roleLabel } from "../lib/format";
import { useFlowboard } from "../store/store";
import { focusRing } from "./classes";
import { Avatar } from "./TaskMeta";

export function SwitchUserDialog({ onClose }: { onClose: () => void }) {
  const users = useFlowboard((state) => state.users);
  const currentUserId = useFlowboard((state) => state.currentUserId);
  const setCurrentUser = useFlowboard((state) => state.setCurrentUser);

  return (
    <Dialog open onClose={onClose} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-ink/40" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
        <DialogPanel className="mt-16 w-full max-w-md rounded-card bg-surface-raised shadow-pop">
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <div>
              <DialogTitle className="text-lg font-semibold text-ink">Switch user</DialogTitle>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Alice sees every list. Bob can't open Sprint. Design is private to Alice and Bob.
              </p>
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
          <ul className="space-y-1 px-4 py-5">
            {users.map((item) => {
              const selected = item.id === currentUserId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-label={`${item.name}, ${roleLabel(item.role)}`}
                    aria-current={selected ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${focusRing} ${
                      selected ? "bg-accent-soft" : "hover:bg-surface-sunken"
                    }`}
                    onClick={() => {
                      setCurrentUser(item.id);
                      onClose();
                    }}
                  >
                    <Avatar user={item} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{item.name}</span>
                      <span className="block text-xs text-ink-muted">{roleLabel(item.role)}</span>
                    </span>
                    {selected ? <span className="text-xs font-medium text-accent">Current</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
