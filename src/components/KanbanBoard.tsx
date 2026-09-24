import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { useRef, useState } from "react";
import type { Status, Task, User } from "../types";
import { formatDue, isOverdue, statusTextClass } from "../lib/format";
import { filterBySearch, tasksInStatus, topLevelTasks } from "../store/selectors";
import { useFlowboard } from "../store/store";
import { boardColumns, boardGroupOptions, type BoardColumnModel, type BoardDirection, type BoardGroupBy } from "./boardGroups";
import { focusRing } from "./classes";
import { SelectMenu, type SelectOption } from "./SelectMenu";
import { TaskComposer } from "./TaskComposer";
import { Avatar, AvatarStack, PriorityFlag, StatusMark } from "./TaskMeta";

export function KanbanBoard({ listId }: { listId: string }) {
  const tasks = useFlowboard((state) => state.tasks);
  const statuses = useFlowboard((state) => state.statuses);
  const users = useFlowboard((state) => state.users);
  const search = useFlowboard((state) => state.search);
  const openTask = useFlowboard((state) => state.openTask);
  const moveTask = useFlowboard((state) => state.moveTask);
  const updateTask = useFlowboard((state) => state.updateTask);
  const [groupBy, setGroupBy] = useState<BoardGroupBy>("status");
  const [subgroup, setSubgroup] = useState<BoardGroupBy | null>(null);
  const [direction, setDirection] = useState<BoardDirection>("asc");
  const [subgroupDirection, setSubgroupDirection] = useState<BoardDirection>("asc");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const suppressClick = useRef(false);
  const searching = search.trim().length > 0;
  const listStatuses = statuses.filter((status) => status.listId === listId).sort((a, b) => a.position - b.position);
  const visible = filterBySearch(topLevelTasks(tasks, listId), tasks, search);
  const columns = boardColumns(groupBy, direction, visible, listStatuses, users).filter((column) => !searching || column.tasks.length > 0);
  const activeTask = tasks.find((task) => task.id === activeId) ?? null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function columnFromOver(overId: string): BoardColumnModel | null {
    if (overId.startsWith("section:")) {
      const columnId = overId.slice("section:".length).split(":")[0];
      return columns.find((column) => column.id === columnId) ?? null;
    }
    if (overId.startsWith("column:")) return columns.find((column) => column.id === overId.slice("column:".length)) ?? null;
    return columns.find((column) => column.tasks.some((task) => task.id === overId)) ?? null;
  }

  function sectionFromOver(overId: string, column: BoardColumnModel): BoardColumnModel | null {
    if (!subgroup) return null;
    const sections = boardColumns(subgroup, subgroupDirection, column.tasks, listStatuses, users);
    if (overId.startsWith("section:")) {
      const sectionId = overId.slice(`section:${column.id}:`.length);
      return sections.find((section) => section.id === sectionId) ?? null;
    }
    return sections.find((section) => section.tasks.some((task) => task.id === overId)) ?? null;
  }

  function onDragStart(event: DragStartEvent) {
    suppressClick.current = true;
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOverColumnId(null);
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = event;
    if (!over || searching) return;
    const taskId = String(active.id);
    const task = tasks.find((item) => item.id === taskId);
    const target = columnFromOver(String(over.id));
    if (!task || !target) return;
    const section = sectionFromOver(String(over.id), target);
    if (subgroup === "status" && section?.statusId && task.statusId !== section.statusId) {
      const destination = tasksInStatus(tasks, listId, section.statusId);
      moveTask({
        taskId,
        toListId: listId,
        toStatusId: section.statusId,
        orderedIds: [...destination.map((item) => item.id), taskId],
      });
    } else if (subgroup && section && !section.tasks.some((item) => item.id === taskId)) {
      applyGroupField(taskId, subgroup, section);
    }

    if (groupBy !== "status") {
      if (target.tasks.some((item) => item.id === taskId)) return;
      if (groupBy === "assignee") updateTask(taskId, { assigneeIds: target.assigneeIds ?? [] });
      if (groupBy === "priority" && target.priority) updateTask(taskId, { priority: target.priority });
      if (groupBy === "due") updateTask(taskId, { dueDate: target.dueDate ?? null });
      return;
    }

    const toStatusId = target.statusId;
    if (!toStatusId) return;
    const overId = String(over.id);
    let orderedIds: string[];
    if (task.statusId === toStatusId) {
      if (subgroup) return;
      const column = tasksInStatus(tasks, listId, toStatusId);
      if (overId.startsWith("column:") || overId.startsWith("section:")) {
        orderedIds = [...column.filter((item) => item.id !== taskId).map((item) => item.id), taskId];
      } else {
        const oldIndex = column.findIndex((item) => item.id === taskId);
        const newIndex = column.findIndex((item) => item.id === overId);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
        orderedIds = arrayMove(column, oldIndex, newIndex).map((item) => item.id);
      }
    } else {
      const destination = tasksInStatus(tasks, listId, toStatusId);
      const next = [...destination];
      const index = overId.startsWith("column:") || overId.startsWith("section:") ? next.length : next.findIndex((item) => item.id === overId);
      next.splice(index < 0 ? next.length : index, 0, task);
      orderedIds = next.map((item) => item.id);
    }

    moveTask({ taskId, toListId: listId, toStatusId, orderedIds });
  }

  function applyGroupField(taskId: string, kind: BoardGroupBy, model: BoardColumnModel) {
    if (kind === "assignee") updateTask(taskId, { assigneeIds: model.assigneeIds ?? [] });
    if (kind === "priority" && model.priority) updateTask(taskId, { priority: model.priority });
    if (kind === "due") updateTask(taskId, { dueDate: model.dueDate ?? null });
  }

  function requestOpen(taskId: string) {
    if (suppressClick.current) return;
    openTask(taskId);
  }

  if (searching && visible.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line bg-surface-raised px-4 py-10 text-center text-sm text-ink-muted">
        No tasks match “{search.trim()}”.
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={(event) => setOverColumnId(event.over ? columnFromOver(String(event.over.id))?.id ?? null : null)}
      onDragCancel={() => {
        setActiveId(null);
        setOverColumnId(null);
        suppressClick.current = false;
      }}
      onDragEnd={onDragEnd}
    >
      <GroupByMenu
        groupBy={groupBy}
        direction={direction}
        onGroupBy={setGroupBy}
        onDirection={setDirection}
        subgroup={subgroup}
        subgroupDirection={subgroupDirection}
        onSubgroup={setSubgroup}
        onSubgroupDirection={setSubgroupDirection}
        onReset={() => {
          setGroupBy("status");
          setSubgroup(null);
          setDirection("asc");
          setSubgroupDirection("asc");
        }}
      />
      <div className="mt-4 flex items-start gap-3 overflow-x-auto pb-4 sm:gap-4">
        {columns.map((column) => (
          <Column
            key={column.id}
            listId={listId}
            column={column}
            subgroup={subgroup}
            direction={subgroupDirection}
            users={users}
            statuses={listStatuses}
            highlighted={overColumnId === column.id}
            searching={searching}
            onOpen={requestOpen}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCardFace task={activeTask} users={users} statuses={statuses} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  listId,
  column,
  subgroup,
  direction,
  users,
  statuses,
  highlighted,
  searching,
  onOpen,
}: {
  listId: string;
  column: BoardColumnModel;
  subgroup: BoardGroupBy | null;
  direction: BoardDirection;
  users: User[];
  statuses: Status[];
  highlighted: boolean;
  searching: boolean;
  onOpen: (taskId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `column:${column.id}` });
  const assignee = column.assigneeIds?.length === 1 ? users.find((user) => user.id === column.assigneeIds?.[0]) : undefined;
  const sections = subgroup ? boardColumns(subgroup, direction, column.tasks, statuses, users).filter((section) => section.tasks.length > 0) : [];
  return (
    <section className="flex w-72 shrink-0 flex-col">
      <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wide">
        {column.statusColor ? <StatusMark color={column.statusColor} /> : null}
        {column.priority ? <PriorityFlag priority={column.priority} decorative /> : null}
        {assignee ? <Avatar user={assignee} /> : null}
        <span className={column.statusColor ? (statusTextClass[column.statusColor] ?? "text-ink") : "text-ink"}>{column.label}</span>
        <span className="font-medium text-ink-faint">{column.tasks.length}</span>
      </h2>
      <SortableContext items={column.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-48 flex-1 flex-col gap-2 rounded-card p-2 ${
            highlighted ? "bg-accent-soft ring-2 ring-accent" : "bg-surface"
          }`}
        >
          {column.tasks.length === 0 ? (
            <p className="rounded-control px-3 py-6 text-center text-xs text-ink-faint">No tasks</p>
          ) : subgroup ? (
            sections.map((section) => (
              <SubgroupSection key={section.id} columnId={column.id} section={section} users={users} statuses={statuses} searching={searching} onOpen={onOpen} />
            ))
          ) : (
            column.tasks.map((task) => (
              <SortableCard key={task.id} task={task} users={users} statuses={statuses} disabled={searching} onOpen={onOpen} />
            ))
          )}
          <ColumnAddTask listId={listId} statuses={statuses} column={column} />
        </div>
      </SortableContext>
    </section>
  );
}

function SubgroupSection({
  columnId,
  section,
  users,
  statuses,
  searching,
  onOpen,
}: {
  columnId: string;
  section: BoardColumnModel;
  users: User[];
  statuses: Status[];
  searching: boolean;
  onOpen: (taskId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `section:${columnId}:${section.id}` });
  const assignee = section.assigneeIds?.length === 1 ? users.find((user) => user.id === section.assigneeIds?.[0]) : undefined;
  return (
    <div ref={setNodeRef} className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {section.statusColor ? <StatusMark color={section.statusColor} /> : null}
        {section.priority ? <PriorityFlag priority={section.priority} decorative /> : null}
        {assignee ? <Avatar user={assignee} /> : null}
        {section.label}
        <span>{section.tasks.length}</span>
      </p>
      {section.tasks.map((task) => (
        <SortableCard key={task.id} task={task} users={users} statuses={statuses} disabled={searching} onOpen={onOpen} />
      ))}
    </div>
  );
}

function ColumnAddTask({ listId, statuses, column }: { listId: string; statuses: Status[]; column: BoardColumnModel }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button type="button" className={`rounded-control px-2 py-2 text-left text-sm text-ink-faint hover:bg-surface-raised hover:text-accent ${focusRing}`} onClick={() => setEditing(true)}>
        + Add Task
      </button>
    );
  }

  return (
    <TaskComposer
      listId={listId}
      statuses={statuses}
      defaultStatusId={column.statusId}
      defaultPriority={column.priority}
      defaultDueDate={column.dueDate}
      defaultAssigneeIds={column.assigneeIds}
      layout="stack"
      onCancel={() => setEditing(false)}
    />
  );
}

const directionOptions: SelectOption<BoardDirection>[] = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

function groupOptions(options: { id: BoardGroupBy; label: string }[]): SelectOption<BoardGroupBy>[] {
  return options.map((option) => ({
    value: option.id,
    label: option.label,
    icon: <GroupIcon name={option.id} />,
  }));
}

function GroupByMenu({
  groupBy,
  subgroup,
  direction,
  subgroupDirection,
  onGroupBy,
  onSubgroup,
  onDirection,
  onSubgroupDirection,
  onReset,
}: {
  groupBy: BoardGroupBy;
  subgroup: BoardGroupBy | null;
  direction: BoardDirection;
  subgroupDirection: BoardDirection;
  onGroupBy: (value: BoardGroupBy) => void;
  onSubgroup: (value: BoardGroupBy | null) => void;
  onDirection: (value: BoardDirection) => void;
  onSubgroupDirection: (value: BoardDirection) => void;
  onReset: () => void;
}) {
  const current = boardGroupOptions.find((option) => option.id === groupBy) ?? boardGroupOptions[0];
  return (
    <Popover className="relative">
      <PopoverButton className={`inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent ${focusRing}`}>
        <LayersIcon />
        Group: {current.label}
      </PopoverButton>
      <PopoverPanel anchor="bottom start" className="z-30 w-[min(420px,calc(100vw-2rem))] !overflow-visible rounded-2xl bg-surface-raised p-4 shadow-pop ring-1 ring-line [--anchor-gap:8px]">
        <p className="text-sm text-ink-muted">Group by</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SelectMenu
            ariaLabel="Group by"
            value={groupBy}
            options={groupOptions(boardGroupOptions)}
            portal={false}
            menuWidth="button"
            className="min-w-0 flex-1"
            onChange={(value) => {
              onGroupBy(value);
              if (value === subgroup) onSubgroup(null);
            }}
          />
          <SelectMenu
            ariaLabel="Group direction"
            value={direction}
            options={directionOptions}
            portal={false}
            menuWidth="button"
            className="w-36 shrink-0"
            onChange={onDirection}
          />
          <button type="button" aria-label="Clear grouping" className={`rounded-lg p-2 text-ink-muted hover:bg-surface ${focusRing}`} onClick={onReset}>
            <TrashIcon />
          </button>
        </div>
        <div className="mt-2">
          {subgroup ? (
            <div className="flex flex-wrap items-center gap-2">
              <SelectMenu
                ariaLabel="Subgroup"
                value={subgroup}
                options={groupOptions(boardGroupOptions.filter((option) => option.id !== groupBy))}
                portal={false}
                menuWidth="button"
                className="min-w-0 flex-1"
                onChange={onSubgroup}
              />
              <SelectMenu
                ariaLabel="Subgroup direction"
                value={subgroupDirection}
                options={directionOptions}
                portal={false}
                menuWidth="button"
                className="w-36 shrink-0"
                onChange={onSubgroupDirection}
              />
              <button
                type="button"
                aria-label="Remove subgroup"
                className={`rounded-lg p-2 text-ink-muted hover:bg-surface ${focusRing}`}
                onClick={() => {
                  onSubgroup(null);
                  onSubgroupDirection("asc");
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ) : (
            <SelectMenu
              ariaLabel="Add subgroup"
              value={null}
              placeholder="Add subgroup"
              options={groupOptions(boardGroupOptions.filter((option) => option.id !== groupBy))}
              portal={false}
              menuWidth="button"
              onChange={onSubgroup}
            />
          )}
        </div>
      </PopoverPanel>
    </Popover>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path d="M10 3.2 3.2 6.6 10 10l6.8-3.4L10 3.2zM3.2 9.6 10 13l6.8-3.4M3.2 12.6 10 16l6.8-3.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function GroupIcon({ name }: { name: BoardGroupBy }) {
  const path = {
    status: "M10 4.2a5.8 5.8 0 1 0 0 11.6 5.8 5.8 0 0 0 0-11.6zM10 8.3a1.7 1.7 0 1 0 .01 0z",
    assignee: "M10 9.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM5.2 15.2c.7-2 2.4-3 4.8-3s4.1 1 4.8 3",
    priority: "M5 3.5h1.1v13H5v-13zm1.1 1.1h7.6L12 7.2l1.7 2.6H6.1V4.6z",
    tags: "M4 8.2 9.2 3.5h6.3v6.3L9.8 15.5 4 8.2zm8.6-2.2h.1",
    due: "M4 5.5h12v9H4v-9zm0 3h12M7 4v2.5M13 4v2.5",
    type: "M10 3.4 16 6.7v6.6L10 16.6 4 13.3V6.7L10 3.4zM10 10.1 16 6.7M10 10.1 4 6.7M10 10.1v6.5",
  }[name];
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path d="M5 6.5h10M8 6.4V5h4v1.4M7.2 6.5l.5 8h4.6l.5-8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SortableCard({
  task,
  users,
  statuses,
  disabled,
  onOpen,
}: {
  task: Task;
  users: User[];
  statuses: Status[];
  disabled: boolean;
  onOpen: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled,
  });
  // dnd-kit needs this transform. See README "Drag-and-drop styles".
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`cursor-grab text-left active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
    >
      <TaskCardFace task={task} users={users} statuses={statuses} />
    </div>
  );
}

function TaskCardFace({ task, users, statuses }: { task: Task; users: User[]; statuses: Status[] }) {
  const status = statuses.find((item) => item.id === task.statusId);
  const overdue = isOverdue(task.dueDate, status?.category ?? null);
  const assignees = users.filter((user) => task.assigneeIds.includes(user.id));
  return (
    <article className="rounded-card bg-surface-raised p-3 shadow-card ring-1 ring-line hover:ring-accent">
      <h3 className="text-sm font-medium leading-5 text-ink">{task.title}</h3>
      <div className="mt-3 flex items-center justify-between gap-2">
        <AvatarStack users={assignees} />
        <span className="flex items-center gap-2">
          <PriorityFlag priority={task.priority} />
          <span className={`text-xs ${overdue ? "font-medium text-danger" : "text-ink-muted"}`}>
            {task.dueDate ? formatDue(task.dueDate) : ""}
          </span>
        </span>
      </div>
    </article>
  );
}
