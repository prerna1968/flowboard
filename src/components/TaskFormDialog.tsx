import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { statusesForList } from "../store/selectors";
import { useFlowboard } from "../store/store";
import { focusRing } from "./classes";
import { TaskComposer } from "./TaskComposer";

export function TaskFormDialog({ listId, onClose }: { listId: string; onClose: () => void }) {
  const containers = useFlowboard((state) => state.containers);
  const statuses = useFlowboard((state) => state.statuses);
  const list = containers.find((container) => container.id === listId);
  const listStatuses = statusesForList(statuses, listId);

  return (
    <Dialog open onClose={onClose} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-ink/40" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
        <DialogPanel className="mt-16 w-full max-w-lg rounded-card bg-surface-raised shadow-pop">
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div>
              <DialogTitle className="text-base font-semibold text-ink">Create a Task</DialogTitle>
              <p className="mt-0.5 text-xs text-ink-muted">Adding to {list?.name ?? "this list"}.</p>
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
          <div className="px-5 pb-5 pt-4">
            <TaskComposer listId={listId} statuses={listStatuses} layout="stack" onCancel={onClose} />
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
