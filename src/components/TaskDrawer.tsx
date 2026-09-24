import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { isOverdue } from "../lib/format";
import { statusesForList, subtasksOf, visibleLists } from "../store/selectors";
import { useFlowboard } from "../store/store";
import type { Priority, StatusCategory, Task, User } from "../types";
import { isError } from "../types";
import { dangerButton, fieldClass, focusRing, ghostButton } from "./classes";
import { AssigneePicker, DueDatePicker, PriorityPicker } from "./pickers";
import { SelectMenu } from "./SelectMenu";
import { TaskEditMenu } from "./TaskEditMenu";
import { StatusMark } from "./TaskMeta";

const drawerMin = 360;
const drawerDefault = 672;

function drawerMax(): number {
  return typeof window === "undefined" ? 960 : Math.min(960, Math.round(window.innerWidth * 0.92));
}

function clampDrawer(width: number): number {
  return Math.min(drawerMax(), Math.max(drawerMin, width));
}

export function TaskDrawer() {
  const tasks = useFlowboard((state) => state.tasks);
  const selectedTaskId = useFlowboard((state) => state.selectedTaskId);
  const closeTask = useFlowboard((state) => state.closeTask);
  const task = tasks.find((item) => item.id === selectedTaskId && !item.archivedAt) ?? null;
  const [width, setWidth] = useState(drawerDefault);
  const lastClick = useRef(0);
  const resizing = useRef(false);

  function onResizeStart(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // The pointer can already be gone if the browser released it.
    }
    resizing.current = true;
    const startX = event.clientX;
    const startWidth = width;
    let moved = false;
    const move = (pointer: PointerEvent) => {
      if (Math.abs(pointer.clientX - startX) > 3) moved = true;
      if (moved) setWidth(clampDrawer(startWidth - (pointer.clientX - startX)));
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      document.body.classList.remove("cursor-col-resize", "select-none");
      window.setTimeout(() => {
        resizing.current = false;
      }, 0);
      if (moved) return;
      const now = Date.now();
      if (now - lastClick.current < 300) {
        lastClick.current = 0;
        setWidth(drawerDefault);
        return;
      }
      lastClick.current = now;
    };
    document.body.classList.add("cursor-col-resize", "select-none");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  return (
    <Dialog
      open={task !== null}
      onClose={() => {
        if (!resizing.current) closeTask();
      }}
      className="relative z-40"
    >
      <DialogBackdrop className="fixed inset-0 bg-ink/40 md:bg-transparent" />
      <div
        className="fixed inset-0 flex justify-end md:pointer-events-none"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeTask();
        }}
      >
        <DialogPanel
          style={task ? { width } : undefined}
          className="relative flex h-full w-full max-w-none flex-col overflow-y-auto border-l border-line bg-surface-raised shadow-pop max-md:!w-full md:pointer-events-auto"
        >
          {task ? (
            <>
              <button
                type="button"
                aria-orientation="vertical"
                aria-label="Resize task drawer"
                aria-valuemin={drawerMin}
                aria-valuemax={drawerMax()}
                aria-valuenow={width}
                className={`group absolute inset-y-0 left-0 z-20 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none md:block ${focusRing}`}
                onPointerDown={onResizeStart}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") setWidth((current) => clampDrawer(current + 16));
                  if (event.key === "ArrowRight") setWidth((current) => clampDrawer(current - 16));
                }}
              >
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent group-hover:bg-accent group-focus-visible:bg-accent" />
              </button>
              <TaskForm key={task.id} task={task} />
            </>
          ) : null}
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
  const [subtaskAssignees, setSubtaskAssignees] = useState<string[]>([]);
  const [subtaskDue, setSubtaskDue] = useState<string | null>(null);
  const [subtaskPriority, setSubtaskPriority] = useState<Priority>("none");
  const [addingSubtask, setAddingSubtask] = useState(false);
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

  function resetComposer() {
    setSubtaskTitle("");
    setSubtaskAssignees([]);
    setSubtaskDue(null);
    setSubtaskPriority("none");
    setAddingSubtask(false);
  }

  function addSubtask(event: FormEvent) {
    event.preventDefault();
    const result = createTask({
      title: subtaskTitle,
      primaryListId: task.primaryListId,
      parentTaskId: task.id,
      statusId: task.statusId,
      assigneeIds: subtaskAssignees,
      dueDate: subtaskDue,
      priority: subtaskPriority,
    });
    if (!isError(result)) resetComposer();
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
            portal={false}
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
                <SubtaskRow
                  key={subtask.id}
                  task={subtask}
                  users={users}
                  currentUserId={currentUserId}
                  statusColor={listStatuses.find((status) => status.id === subtask.statusId)?.color ?? "todo"}
                  statusCategory={listStatuses.find((status) => status.id === subtask.statusId)?.category ?? null}
                  onOpen={openTask}
                  onAssignees={(assigneeIds) => updateTask(subtask.id, { assigneeIds })}
                  onDue={(dueDate) => updateTask(subtask.id, { dueDate })}
                  onPriority={(priority) => updateTask(subtask.id, { priority })}
                />
              ))}
            </ul>
            {addingSubtask ? (
              <form className="group relative mt-1 flex items-center gap-1 overflow-visible border-t border-line py-1.5" onSubmit={addSubtask}>
                <StatusMark color={currentStatus?.color ?? "todo"} />
                <input
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                  placeholder="Task Name"
                  aria-label="Add a subtask"
                  value={subtaskTitle}
                  maxLength={500}
                  onChange={(event) => setSubtaskTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") resetComposer();
                  }}
                />
                <SubtaskMeta
                  users={users}
                  currentUserId={currentUserId}
                  assigneeIds={subtaskAssignees}
                  dueDate={subtaskDue}
                  priority={subtaskPriority}
                  onAssignees={setSubtaskAssignees}
                  onDue={setSubtaskDue}
                  onPriority={setSubtaskPriority}
                />
                <TaskEditMenu
                  name="new subtask"
                  users={users}
                  currentUserId={currentUserId}
                  assigneeIds={subtaskAssignees}
                  dueDate={subtaskDue}
                  priority={subtaskPriority}
                  alwaysVisible
                  onAssignees={setSubtaskAssignees}
                  onDue={setSubtaskDue}
                  onPriority={setSubtaskPriority}
                />
                <button
                  type="button"
                  aria-label="Cancel"
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-ink-faint hover:bg-surface-sunken hover:text-ink ${focusRing}`}
                  onClick={resetComposer}
                >
                  ×
                </button>
                <button
                  type="submit"
                  aria-label="Save subtask"
                  className={`flex h-7 w-7 items-center justify-center rounded-full bg-ink text-surface hover:bg-ink-muted ${focusRing}`}
                >
                  <ReturnIcon />
                </button>
              </form>
            ) : (
              <button
                type="button"
                className={`mt-1 flex w-full items-center gap-2 rounded-control px-1 py-2 text-left text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink ${focusRing}`}
                onClick={() => setAddingSubtask(true)}
              >
                <span className="text-base leading-none">+</span>
                Add Task
              </button>
            )}
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

function SubtaskRow({
  task,
  users,
  currentUserId,
  statusColor,
  statusCategory,
  onOpen,
  onAssignees,
  onDue,
  onPriority,
}: {
  task: Task;
  users: User[];
  currentUserId: string;
  statusColor: string;
  statusCategory: StatusCategory | null;
  onOpen: (id: string) => void;
  onAssignees: (assigneeIds: string[]) => void;
  onDue: (dueDate: string | null) => void;
  onPriority: (priority: Priority) => void;
}) {
  return (
    <li className="group relative flex items-center gap-2 overflow-visible border-t border-line py-2">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm hover:text-accent"
        onClick={() => onOpen(task.id)}
      >
        <StatusMark color={statusColor} />
        <span className="truncate">{task.title}</span>
      </button>
      <SubtaskMeta
        users={users}
        currentUserId={currentUserId}
        assigneeIds={task.assigneeIds}
        dueDate={task.dueDate}
        priority={task.priority}
        overdue={isOverdue(task.dueDate, statusCategory)}
        onAssignees={onAssignees}
        onDue={onDue}
        onPriority={onPriority}
      />
      <TaskEditMenu
        name={task.title}
        users={users}
        currentUserId={currentUserId}
        assigneeIds={task.assigneeIds}
        dueDate={task.dueDate}
        priority={task.priority}
        overdue={isOverdue(task.dueDate, statusCategory)}
        onAssignees={onAssignees}
        onDue={onDue}
        onPriority={onPriority}
      />
    </li>
  );
}

function SubtaskMeta({
  users,
  currentUserId,
  assigneeIds,
  dueDate,
  priority,
  overdue = false,
  onAssignees,
  onDue,
  onPriority,
}: {
  users: User[];
  currentUserId: string;
  assigneeIds: string[];
  dueDate: string | null;
  priority: Priority;
  overdue?: boolean;
  onAssignees: (assigneeIds: string[]) => void;
  onDue: (dueDate: string | null) => void;
  onPriority: (priority: Priority) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <AssigneePicker
        users={users}
        assigneeIds={assigneeIds}
        currentUserId={currentUserId}
        onChange={onAssignees}
      />
      <PriorityPicker value={priority} onChange={onPriority} />
      <DueDatePicker value={dueDate} overdue={overdue} portal={false} placement="up" onChange={onDue} />
    </div>
  );
}

function ReturnIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M6 10h8.2c.9 0 1.3-.4 1.3-1.3V6M6 10l3-3M6 10l3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
