import { useState, type FormEvent } from "react";
import { useFlowboard } from "../store/store";
import type { Priority, Status } from "../types";
import { isError } from "../types";
import { focusRing } from "./classes";
import { SelectMenu } from "./SelectMenu";
import { DueDatePicker, PriorityPicker } from "./pickers";
import { StatusMark } from "./TaskMeta";

export function TaskComposer({
  listId,
  statuses,
  defaultStatusId,
  defaultPriority = "none",
  defaultDueDate = null,
  defaultAssigneeIds = [],
  layout = "row",
  onCancel,
}: {
  listId: string;
  statuses: Status[];
  defaultStatusId?: string;
  defaultPriority?: Priority;
  defaultDueDate?: string | null;
  defaultAssigneeIds?: string[];
  layout?: "row" | "stack";
  onCancel: () => void;
}) {
  const createTask = useFlowboard((state) => state.createTask);
  const [title, setTitle] = useState("");
  const [statusId, setStatusId] = useState(defaultStatusId ?? statuses[0]?.id ?? "");
  const [priority, setPriority] = useState<Priority>(defaultPriority);
  const [dueDate, setDueDate] = useState<string | null>(defaultDueDate);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = createTask({
      title,
      primaryListId: listId,
      statusId,
      priority,
      dueDate,
      assigneeIds: defaultAssigneeIds,
    });
    if (!isError(result)) onCancel();
  }

  const statusField = (
    <SelectMenu
      ariaLabel="Status"
      size="compact"
      value={statusId}
      className="w-32 shrink-0"
      options={statuses.map((item) => ({
        value: item.id,
        label: item.name,
        icon: <StatusMark color={item.color} />,
      }))}
      onChange={setStatusId}
    />
  );

  const nameField = (
    <input
      autoFocus
      aria-label="Task name"
      placeholder="Task Name"
      maxLength={500}
      value={title}
      onChange={(event) => setTitle(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
    />
  );

  const actions = (
    <>
      <PriorityPicker value={priority} onChange={setPriority} />
      <DueDatePicker value={dueDate} onChange={setDueDate} />
      <button type="button" className={`px-2 py-1 text-sm text-ink-muted hover:text-ink ${focusRing}`} onClick={onCancel}>
        Cancel
      </button>
      <button
        type="submit"
        disabled={!title.trim()}
        className={`inline-flex items-center gap-1 rounded-md bg-ink px-2.5 py-1 text-sm font-medium text-surface hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
      >
        Save
        <span aria-hidden="true">↵</span>
      </button>
    </>
  );

  if (layout === "stack") {
    return (
      <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border border-line bg-surface-raised p-2 focus-within:border-accent">
        <div className="flex items-center gap-1">
          {statusField}
          {nameField}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">{actions}</div>
      </form>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-4 mb-2 flex items-center gap-1 rounded-lg border border-line bg-surface-raised px-2 py-1 focus-within:border-accent"
    >
      {statusField}
      {nameField}
      {actions}
    </form>
  );
}
