import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState, type FormEvent } from "react";
import { isOverdue } from "../lib/format";
import { statusesForList, subtasksOf, visibleLists } from "../store/selectors";
import { useFlowboard } from "../store/store";
import type { Task } from "../types";
import { isError } from "../types";
import { dangerButton, fieldClass, focusRing, ghostButton } from "./classes";
import { AssigneePicker, DueDatePicker, PriorityPicker } from "./pickers";
import { SelectMenu } from "./SelectMenu";
import { StatusMark } from "./TaskMeta";

export function TaskDrawer() {
  const tasks = useFlowboard((state) => state.tasks);
  const selectedTaskId = useFlowboard((state) => state.selectedTaskId);
  const closeTask = useFlowboard((state) => state.closeTask);
  const task = tasks.find((item) => item.id === selectedTaskId && !item.archivedAt) ?? null;

  return (
    <Dialog open={task !== null} onClose={closeTask} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-ink/40" />
      <div
        className="fixed inset-0 flex justify-end"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeTask();
        }}
      >
        <DialogPanel className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-surface-raised shadow-pop">
          {task ? <TaskForm key={task.id} task={task} /> : null}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function TaskForm({ task }: { task: Task }) {
  const tasks = useFlowboard((state) => state.tasks);
  const statuses = useFlowboard((state) => state.statuses);
  const users = useFlowboard((state) => state.users);
  const containers = useFlowboard((state) => state.containers);
  const grants = useFlowboard((state) => state.grants);
  const currentUserId = useFlowboard((state) => state.currentUserId);
  const updateTask = useFlowboard((state) => state.updateTask);
  const createTask = useFlowboard((state) => state.createTask);
  const archiveTask = useFlowboard((state) => state.archiveTask);
  const deleteTask = useFlowboard((state) => state.deleteTask);
  const openTask = useFlowboard((state) => state.openTask);
  const closeTask = useFlowboard((state) => state.closeTask);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [confirmAction, setConfirmAction] = useState<"archive" | "delete" | null>(null);
  const user = users.find((item) => item.id === currentUserId);
  const listStatuses = statusesForList(statuses, task.primaryListId);
  const lists = user ? visibleLists(containers, user, grants) : [];
  const subtasks = subtasksOf(tasks, task.id);
  const parent = task.parentTaskId ? tasks.find((item) => item.id === task.parentTaskId) : undefined;

  function commitTitle() {
    if (title.trim() === task.title) return;
    const result = updateTask(task.id, { title });
    if (isError(result)) setTitle(task.title);
  }

  function commitDescription() {
    if (description === task.description) return;
    updateTask(task.id, { description });
  }

  function addSubtask(event: FormEvent) {
    event.preventDefault();
    const result = createTask({
      title: subtaskTitle,
      primaryListId: task.primaryListId,
      parentTaskId: task.id,
      statusId: task.statusId,
    });
    if (!isError(result)) setSubtaskTitle("");
  }

  const currentStatus = listStatuses.find((status) => status.id === task.statusId);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
        <DialogTitle className="text-xs font-medium text-ink-faint">
          {parent ? (
            <button type="button" className="hover:text-accent" onClick={() => openTask(parent.id)}>
              {parent.title}
            </button>
          ) : (
            "Task"
          )}
        </DialogTitle>
        <button type="button" className={ghostButton} onClick={closeTask}>
          Close
        </button>
      </div>
      <div className="flex flex-col gap-6 px-4 py-5 sm:px-6">
        <input
          autoFocus
          aria-label="Title"
          className={`w-full bg-transparent text-xl font-semibold tracking-tight text-ink placeholder:text-ink-faint sm:text-2xl ${focusRing}`}
          value={title}
          maxLength={500}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm">
          <span className="text-ink-muted">Status</span>
          <SelectMenu
            ariaLabel="Status"
            value={task.statusId}
            portal={false}
            className="w-full min-w-0 sm:w-48"
            options={listStatuses.map((status) => ({
              value: status.id,
              label: status.name,
              icon: <StatusMark color={status.color} />,
            }))}
            onChange={(statusId) => updateTask(task.id, { statusId })}
          />
          <span className="text-ink-muted">Assignees</span>
          <AssigneePicker
            users={users}
            assigneeIds={task.assigneeIds}
            currentUserId={currentUserId}
            onChange={(assigneeIds) => updateTask(task.id, { assigneeIds })}
          />
          <span className="text-ink-muted">Due date</span>
          <DueDatePicker
            value={task.dueDate}
            overdue={isOverdue(task.dueDate, currentStatus?.category ?? null)}
            onChange={(dueDate) => updateTask(task.id, { dueDate })}
          />
          <span className="text-ink-muted">Priority</span>
          <PriorityPicker value={task.priority} onChange={(priority) => updateTask(task.id, { priority })} />
          <span className="text-ink-muted">List</span>
          <SelectMenu
            ariaLabel="List"
            value={task.primaryListId}
            portal={false}
            className="w-full min-w-0 sm:w-48"
            options={lists.map((list) => ({ value: list.id, label: list.name }))}
            onChange={(primaryListId) => updateTask(task.id, { primaryListId })}
          />
        </div>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Description</span>
          <textarea
            className={`${fieldClass} mt-2 min-h-32 resize-y border-transparent bg-surface hover:border-line`}
            placeholder="Add a description..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={commitDescription}
          />
        </label>
        {task.parentTaskId ? null : (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Subtasks</h3>
            <ul className="mt-2">
              {subtasks.map((subtask) => (
                <li key={subtask.id} className="border-t border-line">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-accent"
                    onClick={() => openTask(subtask.id)}
                  >
                    <StatusMark color={listStatuses.find((status) => status.id === subtask.statusId)?.color ?? "todo"} />
                    {subtask.title}
                  </button>
                </li>
              ))}
            </ul>
            <form className="mt-1 flex gap-2" onSubmit={addSubtask}>
              <input
                className={fieldClass}
                placeholder="Add Task"
                aria-label="Add a subtask"
                value={subtaskTitle}
                maxLength={500}
                onChange={(event) => setSubtaskTitle(event.target.value)}
              />
            </form>
          </section>
        )}
        {confirmAction ? (
          <div className="flex gap-2">
            <button
              type="button"
              className={dangerButton}
              onClick={() => (confirmAction === "delete" ? deleteTask(task.id) : archiveTask(task.id))}
            >
              {confirmAction === "delete" ? "Confirm delete" : "Confirm archive"}
            </button>
            <button type="button" className={ghostButton} onClick={() => setConfirmAction(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={dangerButton} onClick={() => setConfirmAction("archive")}>
              Archive task
            </button>
            <button type="button" className={dangerButton} onClick={() => setConfirmAction("delete")}>
              Delete task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
