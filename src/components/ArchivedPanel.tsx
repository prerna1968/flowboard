import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState } from "react";
import { formatDueCompact } from "../lib/format";
import { archivedTasks, statusesForList } from "../store/selectors";
import { useFlowboard } from "../store/store";
import { dangerButton, focusRing, ghostButton, primaryButton } from "./classes";
import { AvatarStack, StatusMark } from "./TaskMeta";

export function ArchivedPanel({ listId }: { listId: string }) {
  const tasks = useFlowboard((state) => state.tasks);
  const [open, setOpen] = useState(false);
  const archived = archivedTasks(tasks, listId);

  return (
    <>
      <button
        type="button"
        className={`ml-2 mb-1 inline-flex items-center gap-1.5 self-center rounded-control px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink ${focusRing}`}
        onClick={() => setOpen(true)}
      >
        <ArchiveIcon />
        Archived
        {archived.length > 0 ? (
          <span className="rounded-full bg-surface-sunken px-1.5 text-xs font-medium text-ink-muted">{archived.length}</span>
        ) : null}
      </button>
      <ArchivedDialog listId={listId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ArchivedDialog({ listId, open, onClose }: { listId: string; open: boolean; onClose: () => void }) {
  const tasks = useFlowboard((state) => state.tasks);
  const statuses = useFlowboard((state) => state.statuses);
  const users = useFlowboard((state) => state.users);
  const unarchiveTask = useFlowboard((state) => state.unarchiveTask);
  const deleteTask = useFlowboard((state) => state.deleteTask);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const archived = archivedTasks(tasks, listId);
  const listStatuses = statusesForList(statuses, listId);

  return (
    <Dialog open={open} onClose={onClose} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-ink/40" />
      <div className="fixed inset-0 flex items-start justify-center p-4 sm:p-6">
        <DialogPanel className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-card bg-surface-raised shadow-pop">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <DialogTitle className="text-base font-semibold text-ink">Archived tasks</DialogTitle>
              <p className="mt-0.5 text-xs text-ink-muted">
                Archived tasks are hidden from the list, board, and search. Restore one to put it back in its status
                column, or delete it permanently.
              </p>
            </div>
            <button type="button" className={ghostButton} onClick={onClose}>
              Close
            </button>
          </div>
          {archived.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">Nothing archived on this list yet.</p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
              {archived.map((task) => {
                const status = listStatuses.find((item) => item.id === task.statusId);
                const parent = task.parentTaskId ? tasks.find((item) => item.id === task.parentTaskId) : undefined;
                const due = formatDueCompact(task.dueDate);
                return (
                  <li key={task.id} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{task.title}</p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                        <StatusMark color={status?.color ?? "todo"} />
                        {status?.name ?? "No status"}
                        {due ? <span>· {due}</span> : null}
                        {parent ? <span className="truncate">· Subtask of {parent.title}</span> : null}
                      </p>
                    </div>
                    <AvatarStack users={users.filter((user) => task.assigneeIds.includes(user.id))} />
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" className={primaryButton} onClick={() => unarchiveTask(task.id)}>
                        Restore
                      </button>
                      {confirmDeleteId === task.id ? (
                        <>
                          <button
                            type="button"
                            className={dangerButton}
                            onClick={() => {
                              deleteTask(task.id);
                              setConfirmDeleteId(null);
                            }}
                          >
                            Confirm delete
                          </button>
                          <button type="button" className={ghostButton} onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button type="button" className={dangerButton} onClick={() => setConfirmDeleteId(task.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path
        d="M3.5 5.5h13v3h-13v-3zm1 3h11v6.5h-11V8.5zM8 11h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
