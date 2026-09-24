import { useState } from "react";
import { isOverdue, statusTextClass } from "../lib/format";
import { filterBySearch, sortTasks, statusesForList, subtasksOf, topLevelTasks } from "../store/selectors";
import { useFlowboard } from "../store/store";
import type { Priority, Status, Task, User } from "../types";
import { AssigneePicker, DueDatePicker, PriorityPicker } from "./pickers";
import { StatusMark } from "./TaskMeta";
import { TaskComposer } from "./TaskComposer";
import { EmptyState } from "./feedback";
import { focusRing } from "./classes";
import { SelectMenu } from "./SelectMenu";

type GroupBy = "status" | "priority";

const listGrid = "grid w-full min-w-[640px] grid-cols-[minmax(0,1fr)_72px_88px_96px_120px]";

const priorityOrder: Priority[] = ["urgent", "high", "normal", "low", "none"];

export function ListView({ listId }: { listId: string }) {
  const tasks = useFlowboard((state) => state.tasks);
  const statuses = useFlowboard((state) => state.statuses);
  const users = useFlowboard((state) => state.users);
  const search = useFlowboard((state) => state.search);
  const sortKey = useFlowboard((state) => state.sortKey);
  const sortDirection = useFlowboard((state) => state.sortDirection);
  const toggleSort = useFlowboard((state) => state.toggleSort);
  const currentUserId = useFlowboard((state) => state.currentUserId);
  const openTask = useFlowboard((state) => state.openTask);
  const updateTask = useFlowboard((state) => state.updateTask);
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const listStatuses = statusesForList(statuses, listId);
  const rows = sortTasks(filterBySearch(topLevelTasks(tasks, listId), tasks, search), sortKey, sortDirection);
  const searching = search.trim().length > 0;

  const groups = groupBy === "status"
    ? listStatuses.map((status) => ({
        id: status.id,
        label: status.name,
        color: status.color,
        tasks: rows.filter((task) => task.statusId === status.id),
        statusId: status.id,
        priority: undefined as Priority | undefined,
      }))
    : priorityOrder.map((priority) => ({
        id: priority,
        label: priority,
        color: priority === "none" ? "todo" : "in_progress",
        tasks: rows.filter((task) => task.priority === priority),
        statusId: undefined as string | undefined,
        priority,
      }));

  const visibleGroups = searching ? groups.filter((group) => group.tasks.length > 0) : groups;

  if (searching && visibleGroups.length === 0) {
    return <EmptyState title="No matching tasks" body={`Nothing in this list matches “${search.trim()}”.`} />;
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className={`sticky top-0 z-10 items-center border-b border-line bg-surface-raised px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint ${listGrid}`}>
        <div className="flex items-center gap-3">
          <span>Name</span>
          <SelectMenu
            ariaLabel="Group by"
            size="compact"
            value={groupBy}
            className="w-36"
            options={[
              { value: "status", label: "Group: Status" },
              { value: "priority", label: "Group: Priority" },
            ]}
            onChange={setGroupBy}
          />
        </div>
        <span>Assignee</span>
        <SortButton label="Due date" active={sortKey === "dueDate"} direction={sortDirection} onClick={() => toggleSort("dueDate")} />
        <SortButton label="Priority" active={sortKey === "priority"} direction={sortDirection} onClick={() => toggleSort("priority")} />
        <span>Status</span>
      </div>
      {visibleGroups.map((group) => {
        const isCollapsed = collapsed[group.id] ?? false;
        return (
          <section key={group.id} className="border-b border-line">
            <button
              type="button"
              className={`flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-surface ${focusRing}`}
              aria-expanded={!isCollapsed}
              onClick={() => setCollapsed((current) => ({ ...current, [group.id]: !isCollapsed }))}
            >
              <Chevron collapsed={isCollapsed} />
              <StatusMark color={group.color} />
              <span className={`text-xs font-bold uppercase tracking-wide ${statusTextClass[group.color] ?? "text-ink"}`}>
                {group.label}
              </span>
              <span className="text-xs text-ink-faint">{group.tasks.length}</span>
            </button>
            {isCollapsed ? null : (
              <>
                {group.tasks.map((task) => (
                  <TaskRows
                    key={task.id}
                    task={task}
                    tasks={tasks}
                    users={users}
                    currentUserId={currentUserId}
                    statuses={listStatuses}
                    depth={0}
                    expanded={expanded[task.id] ?? false}
                    onToggle={() => setExpanded((current) => ({ ...current, [task.id]: !current[task.id] }))}
                    onOpen={openTask}
                    onStatus={(taskId, statusId) => updateTask(taskId, { statusId })}
                    onDue={(taskId, dueDate) => updateTask(taskId, { dueDate })}
                    onAssignees={(taskId, assigneeIds) => updateTask(taskId, { assigneeIds })}
                    onPriority={(taskId, priority) => updateTask(taskId, { priority })}
                  />
                ))}
                <AddTaskRow listId={listId} statuses={listStatuses} statusId={group.statusId} priority={group.priority} />
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TaskRows({
  task,
  tasks,
  users,
  currentUserId,
  statuses,
  depth,
  expanded,
  onToggle,
  onOpen,
  onStatus,
  onDue,
  onAssignees,
  onPriority,
}: {
  task: Task;
  tasks: Task[];
  users: User[];
  currentUserId: string;
  statuses: Status[];
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
  onStatus: (taskId: string, statusId: string) => void;
  onDue: (taskId: string, dueDate: string | null) => void;
  onAssignees: (taskId: string, assigneeIds: string[]) => void;
  onPriority: (taskId: string, priority: Priority) => void;
}) {
  const status = statuses.find((item) => item.id === task.statusId);
  const overdue = isOverdue(task.dueDate, status?.category ?? null);
  const children = depth === 0 ? subtasksOf(tasks, task.id) : [];

  return (
    <>
      <div className={`group items-center border-t border-line px-4 py-1.5 hover:bg-surface ${listGrid}`}>
        <div className={`flex min-w-0 items-center gap-2 ${depth ? "pl-7" : ""}`}>
          {children.length > 0 ? (
            <button type="button" className={`rounded-control p-0.5 text-ink-faint hover:text-ink ${focusRing}`} aria-label={`${expanded ? "Collapse" : "Expand"} subtasks`} onClick={onToggle}>
              <Chevron collapsed={!expanded} />
            </button>
          ) : (
            <span className="w-5" />
          )}
          <button type="button" className="min-w-0 flex-1 truncate text-left text-sm text-ink hover:text-accent" onClick={() => onOpen(task.id)}>
            {task.title}
          </button>
        </div>
        <AssigneePicker
          users={users}
          assigneeIds={task.assigneeIds}
          currentUserId={currentUserId}
          onChange={(assigneeIds) => onAssignees(task.id, assigneeIds)}
        />
        <DueDatePicker value={task.dueDate} overdue={overdue} onChange={(dueDate) => onDue(task.id, dueDate)} />
        <PriorityPicker value={task.priority} onChange={(priority) => onPriority(task.id, priority)} />
        <SelectMenu
          ariaLabel={`Status for ${task.title}`}
          size="compact"
          value={task.statusId}
          options={statuses.map((item) => ({
            value: item.id,
            label: item.name,
            icon: <StatusMark color={item.color} />,
          }))}
          onChange={(statusId) => onStatus(task.id, statusId)}
        />
      </div>
      {expanded
        ? children.map((child) => (
            <TaskRows
              key={child.id}
              task={child}
              tasks={tasks}
              users={users}
              currentUserId={currentUserId}
              statuses={statuses}
              depth={1}
              expanded={false}
              onToggle={() => undefined}
              onOpen={onOpen}
              onStatus={onStatus}
              onDue={onDue}
              onAssignees={onAssignees}
              onPriority={onPriority}
            />
          ))
        : null}
    </>
  );
}

function AddTaskRow({
  listId,
  statuses,
  statusId,
  priority,
}: {
  listId: string;
  statuses: Status[];
  statusId?: string;
  priority?: Priority;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button type="button" className={`px-11 py-2 text-left text-sm text-ink-faint hover:text-accent ${focusRing}`} onClick={() => setEditing(true)}>
        + Add Task
      </button>
    );
  }

  return (
    <TaskComposer
      listId={listId}
      statuses={statuses}
      defaultStatusId={statusId}
      defaultPriority={priority}
      onCancel={() => setEditing(false)}
    />
  );
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button type="button" className={`inline-flex items-center gap-1 text-left uppercase ${focusRing}`} aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"} onClick={onClick}>
      {label}
      <span aria-hidden="true">{active ? (direction === "asc" ? "↑" : "↓") : ""}</span>
    </button>
  );
}

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={`h-3.5 w-3.5 text-ink-faint ${collapsed ? "-rotate-90" : ""}`}>
      <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
