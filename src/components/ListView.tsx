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
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { isOverdue, statusTextClass } from "../lib/format";
import { filterBySearch, sortTasks, statusesForList, subtasksOf, tasksInStatus, topLevelTasks } from "../store/selectors";
import { useFlowboard } from "../store/store";
import type { Priority, Status, Task, User } from "../types";
import { isError } from "../types";
import { boardColumns, type BoardColumnModel, type BoardDirection, type BoardGroupBy } from "./boardGroups";
import { GroupByMenu } from "./GroupByMenu";
import { AssigneePicker, DueDatePicker, PriorityPicker } from "./pickers";
import { Avatar, PriorityFlag, StatusMark } from "./TaskMeta";
import { TaskComposer } from "./TaskComposer";
import { EmptyState } from "./feedback";
import { focusRing } from "./classes";
import { SelectMenu } from "./SelectMenu";

const listGrid = "grid w-full min-w-[640px] grid-cols-[minmax(0,1fr)_72px_88px_96px_120px]";

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
  const moveTask = useFlowboard((state) => state.moveTask);
  const composeTaskListId = useFlowboard((state) => state.composeTaskListId);
  const composeTaskAt = useFlowboard((state) => state.composeTaskAt);
  const clearComposeTask = useFlowboard((state) => state.clearComposeTask);
  const [groupBy, setGroupBy] = useState<BoardGroupBy>("status");
  const [subgroup, setSubgroup] = useState<BoardGroupBy | null>(null);
  const [direction, setDirection] = useState<BoardDirection>("asc");
  const [subgroupDirection, setSubgroupDirection] = useState<BoardDirection>("asc");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sortLive, setSortLive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);
  const suppressClick = useRef(false);
  const listStatuses = statusesForList(statuses, listId);
  const visible = filterBySearch(topLevelTasks(tasks, listId), tasks, search);
  const rows = sortLive ? sortTasks(visible, sortKey, sortDirection) : visible;
  const searching = search.trim().length > 0;
  const groups = boardColumns(groupBy, direction, rows, listStatuses, users).filter((group) => !searching || group.tasks.length > 0);
  const todoId = listStatuses.find((status) => status.category === "todo")?.id;
  const composeGroupId =
    composeTaskListId === listId ? (groupBy === "status" && todoId ? todoId : groups[0]?.id) : undefined;

  useEffect(() => {
    if (!composeGroupId) return;
    setCollapsed((current) => (current[composeGroupId] ? { ...current, [composeGroupId]: false } : current));
  }, [composeGroupId, composeTaskAt]);
  const activeTask = tasks.find((task) => task.id === activeId) ?? null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedIds([]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function groupFromOver(overId: string): BoardColumnModel | null {
    if (overId.startsWith("section:")) {
      const groupId = overId.slice("section:".length).split(":")[0];
      return groups.find((group) => group.id === groupId) ?? null;
    }
    if (overId.startsWith("column:")) return groups.find((group) => group.id === overId.slice("column:".length)) ?? null;
    return groups.find((group) => group.tasks.some((task) => task.id === overId)) ?? null;
  }

  function sectionFromOver(overId: string, group: BoardColumnModel): BoardColumnModel | null {
    if (!subgroup) return null;
    const sections = boardColumns(subgroup, subgroupDirection, group.tasks, listStatuses, users);
    if (overId.startsWith("section:")) {
      const sectionId = overId.slice(`section:${group.id}:`.length);
      return sections.find((section) => section.id === sectionId) ?? null;
    }
    return sections.find((section) => section.tasks.some((task) => task.id === overId)) ?? null;
  }

  function applyGroupField(taskId: string, kind: BoardGroupBy, model: BoardColumnModel) {
    if (kind === "assignee") updateTask(taskId, { assigneeIds: model.assigneeIds ?? [] });
    if (kind === "priority" && model.priority) updateTask(taskId, { priority: model.priority });
    if (kind === "due") updateTask(taskId, { dueDate: model.dueDate ?? null });
  }

  function onDragStart(event: DragStartEvent) {
    suppressClick.current = true;
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOverGroupId(null);
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = event;
    if (!over || searching) return;
    const taskId = String(active.id);
    const task = tasks.find((item) => item.id === taskId);
    const target = groupFromOver(String(over.id));
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

  function requestOpen(taskId: string) {
    if (suppressClick.current) return;
    openTask(taskId);
  }

  function toggleSelected(taskId: string) {
    setSelectedIds((current) => (current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]));
  }

  function setGroupSelected(ids: string[], on: boolean) {
    setSelectedIds((current) => {
      if (on) return [...new Set([...current, ...ids])];
      const remove = new Set(ids);
      return current.filter((id) => !remove.has(id));
    });
  }

  function applyBulkStatus(statusId: string) {
    for (const id of selectedIds) updateTask(id, { statusId });
  }

  function applyBulkAssignees(assigneeIds: string[]) {
    for (const id of selectedIds) updateTask(id, { assigneeIds });
  }

  function applyBulkPriority(priority: Priority) {
    for (const id of selectedIds) updateTask(id, { priority });
  }

  function armSort(key: "dueDate" | "priority") {
    if (!sortLive) {
      setSortLive(true);
      if (sortKey !== key) toggleSort(key);
      return;
    }
    toggleSort(key);
  }

  if (searching && groups.length === 0) {
    return <EmptyState title="No matching tasks" body={`Nothing in this list matches “${search.trim()}”.`} />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={(event) => setOverGroupId(event.over ? groupFromOver(String(event.over.id))?.id ?? null : null)}
      onDragCancel={() => {
        setActiveId(null);
        setOverGroupId(null);
        suppressClick.current = false;
      }}
      onDragEnd={onDragEnd}
    >
      <div className="w-full overflow-x-auto">
        <div className="sticky top-0 z-20 border-b border-line bg-surface-raised px-4 py-2">
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
        </div>
        {selectedIds.length > 0 ? (
          <BulkBar
            count={selectedIds.length}
            tasks={tasks}
            selectedIds={selectedIds}
            statuses={listStatuses}
            users={users}
            currentUserId={currentUserId}
            onStatus={applyBulkStatus}
            onAssignees={applyBulkAssignees}
            onPriority={applyBulkPriority}
            onClear={() => setSelectedIds([])}
          />
        ) : null}
        {groups.map((group) => {
          const isCollapsed = collapsed[group.id] ?? false;
          const sections = subgroup
            ? boardColumns(subgroup, subgroupDirection, group.tasks, listStatuses, users).filter((section) => section.tasks.length > 0)
            : [];
          const columnHeader = (
            <ColumnHeader
              ids={visibleTaskIds(group.tasks, tasks, expanded)}
              selectedIds={selectedIds}
              sortLive={sortLive}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={armSort}
              onToggleAll={setGroupSelected}
            />
          );
          return (
            <ListGroup
              key={group.id}
              group={group}
              users={users}
              collapsed={isCollapsed}
              highlighted={overGroupId === group.id}
              onToggle={() => setCollapsed((current) => ({ ...current, [group.id]: !isCollapsed }))}
            >
              {isCollapsed ? null : subgroup ? (
                sections.map((section) => (
                  <ListSection key={section.id} groupId={group.id} section={section} users={users}>
                    <ColumnHeader
                      ids={visibleTaskIds(section.tasks, tasks, expanded)}
                      selectedIds={selectedIds}
                      sortLive={sortLive}
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={armSort}
                      onToggleAll={setGroupSelected}
                    />
                    {section.tasks.map((task) => (
                      <TaskRows
                        key={task.id}
                        task={task}
                        tasks={tasks}
                        users={users}
                        currentUserId={currentUserId}
                        statuses={listStatuses}
                        depth={0}
                        expanded={expanded[task.id] ?? false}
                        disabled={searching}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelected}
                        onToggle={() => setExpanded((current) => ({ ...current, [task.id]: !current[task.id] }))}
                        onOpen={requestOpen}
                        onStatus={(taskId, statusId) => updateTask(taskId, { statusId })}
                        onDue={(taskId, dueDate) => updateTask(taskId, { dueDate })}
                        onAssignees={(taskId, assigneeIds) => updateTask(taskId, { assigneeIds })}
                        onPriority={(taskId, priority) => updateTask(taskId, { priority })}
                      />
                    ))}
                    <AddTaskRow
                      listId={listId}
                      statuses={listStatuses}
                      statusId={section.statusId ?? group.statusId ?? todoId}
                      priority={section.priority ?? group.priority}
                      dueDate={section.dueDate ?? group.dueDate}
                      assigneeIds={section.assigneeIds ?? group.assigneeIds}
                      autoOpen={group.id === composeGroupId && section.id === sections[0]?.id}
                      composeAt={composeTaskAt}
                      onOpened={clearComposeTask}
                    />
                  </ListSection>
                ))
              ) : (
                <SortableContext items={group.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                  {columnHeader}
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
                      disabled={searching}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelected}
                      onToggle={() => setExpanded((current) => ({ ...current, [task.id]: !current[task.id] }))}
                      onOpen={requestOpen}
                      onStatus={(taskId, statusId) => updateTask(taskId, { statusId })}
                      onDue={(taskId, dueDate) => updateTask(taskId, { dueDate })}
                      onAssignees={(taskId, assigneeIds) => updateTask(taskId, { assigneeIds })}
                      onPriority={(taskId, priority) => updateTask(taskId, { priority })}
                    />
                  ))}
                  <AddTaskRow
                    listId={listId}
                    statuses={listStatuses}
                    statusId={group.statusId ?? todoId}
                    priority={group.priority}
                    dueDate={group.dueDate}
                    assigneeIds={group.assigneeIds}
                    autoOpen={group.id === composeGroupId}
                    composeAt={composeTaskAt}
                    onOpened={clearComposeTask}
                  />
                </SortableContext>
              )}
            </ListGroup>
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? <ListDragPreview task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function ListGroup({
  group,
  users,
  collapsed,
  highlighted,
  onToggle,
  children,
}: {
  group: BoardColumnModel;
  users: User[];
  collapsed: boolean;
  highlighted: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `column:${group.id}` });
  return (
    <section ref={setNodeRef} className={`border-b border-line ${highlighted ? "ring-2 ring-inset ring-accent" : ""}`}>
      <GroupHeading group={group} users={users} collapsed={collapsed} onToggle={onToggle} />
      {children}
    </section>
  );
}

function ListSection({
  groupId,
  section,
  users,
  children,
}: {
  groupId: string;
  section: BoardColumnModel;
  users: User[];
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `section:${groupId}:${section.id}` });
  return (
    <div ref={setNodeRef}>
      <GroupHeading group={section} users={users} collapsed={false} nested />
      <SortableContext items={section.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}

function GroupHeading({
  group,
  users,
  collapsed,
  nested = false,
  onToggle,
}: {
  group: BoardColumnModel;
  users: User[];
  collapsed: boolean;
  nested?: boolean;
  onToggle?: () => void;
}) {
  const assignee = group.assigneeIds?.length === 1 ? users.find((user) => user.id === group.assigneeIds?.[0]) : undefined;
  const labelClass = group.statusColor ? (statusTextClass[group.statusColor] ?? "text-ink") : "text-ink";
  const body = (
    <>
      {nested ? <span className="w-3.5" /> : <Chevron collapsed={collapsed} />}
      {group.statusColor ? <StatusMark color={group.statusColor} /> : null}
      {group.priority ? <PriorityFlag priority={group.priority} decorative /> : null}
      {assignee ? <Avatar user={assignee} /> : null}
      <span className={`text-xs font-bold uppercase tracking-wide ${labelClass}`}>{group.label}</span>
      <span className="text-xs text-ink-faint">{group.tasks.length}</span>
    </>
  );
  if (nested || !onToggle) {
    return <div className="flex w-full items-center gap-2 px-8 py-2 text-left">{body}</div>;
  }
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-surface ${focusRing}`}
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      {body}
    </button>
  );
}

function visibleTaskIds(parents: Task[], allTasks: Task[], expanded: Record<string, boolean>): string[] {
  const ids: string[] = [];
  for (const task of parents) {
    ids.push(task.id);
    if (expanded[task.id]) {
      for (const child of subtasksOf(allTasks, task.id)) ids.push(child.id);
    }
  }
  return ids;
}

function ColumnHeader({
  ids,
  selectedIds,
  sortLive,
  sortKey,
  sortDirection,
  onSort,
  onToggleAll,
}: {
  ids: string[];
  selectedIds: string[];
  sortLive: boolean;
  sortKey: "dueDate" | "priority";
  sortDirection: "asc" | "desc";
  onSort: (key: "dueDate" | "priority") => void;
  onToggleAll: (ids: string[], on: boolean) => void;
}) {
  const selectedCount = ids.filter((id) => selectedIds.includes(id)).length;
  const allOn = ids.length > 0 && selectedCount === ids.length;
  const mixed = selectedCount > 0 && !allOn;
  return (
    <div className={`items-center border-t border-line px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint ${listGrid}`}>
      <div className="flex items-center gap-1.5">
        <span className="w-4 shrink-0" />
        <SelectToggle
          checked={allOn}
          mixed={mixed}
          label={allOn ? "Deselect tasks" : "Select all tasks"}
          onChange={(on) => onToggleAll(ids, on)}
        />
        <span>Name</span>
      </div>
      <span>Assignee</span>
      <SortButton label="Due date" active={sortLive && sortKey === "dueDate"} direction={sortDirection} onClick={() => onSort("dueDate")} />
      <SortButton label="Priority" active={sortLive && sortKey === "priority"} direction={sortDirection} onClick={() => onSort("priority")} />
      <span>Status</span>
    </div>
  );
}

function BulkBar({
  count,
  tasks,
  selectedIds,
  statuses,
  users,
  currentUserId,
  onStatus,
  onAssignees,
  onPriority,
  onClear,
}: {
  count: number;
  tasks: Task[];
  selectedIds: string[];
  statuses: Status[];
  users: User[];
  currentUserId: string;
  onStatus: (statusId: string) => void;
  onAssignees: (assigneeIds: string[]) => void;
  onPriority: (priority: Priority) => void;
  onClear: () => void;
}) {
  const selected = selectedIds.map((id) => tasks.find((task) => task.id === id)).filter((task): task is Task => Boolean(task));
  const statusId = selected.length > 0 && selected.every((task) => task.statusId === selected[0].statusId) ? selected[0].statusId : null;
  const assigneeKey = selected[0] ? selected[0].assigneeIds.slice().sort().join(",") : "";
  const sharedAssignees = selected.length > 0 && selected.every((task) => task.assigneeIds.slice().sort().join(",") === assigneeKey);
  const assigneeIds = sharedAssignees ? selected[0].assigneeIds : [];
  const priority = selected.length > 0 && selected.every((task) => task.priority === selected[0].priority) ? selected[0].priority : "none";
  return (
    <div className="sticky top-[41px] z-20 flex flex-wrap items-center gap-3 border-b border-line bg-accent-soft px-4 py-2">
      <span className="text-sm font-medium text-ink">{count} selected</span>
      <div className="w-40">
        <SelectMenu
          ariaLabel="Bulk status"
          size="compact"
          value={statusId}
          placeholder="Status"
          options={statuses.map((item) => ({
            value: item.id,
            label: item.name,
            icon: <StatusMark color={item.color} />,
          }))}
          onChange={onStatus}
        />
      </div>
      <AssigneePicker users={users} assigneeIds={assigneeIds} currentUserId={currentUserId} onChange={onAssignees} />
      <PriorityPicker value={priority} onChange={onPriority} />
      <button type="button" aria-label="Clear selection" className={`ml-auto rounded-control px-2 py-1 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink ${focusRing}`} onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

function SelectToggle({
  checked,
  mixed = false,
  statusColor,
  label,
  onChange,
}: {
  checked: boolean;
  mixed?: boolean;
  statusColor?: string;
  label: string;
  onChange: (on: boolean) => void;
}) {
  const filled = checked || mixed;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      aria-label={label}
      className={`relative flex h-5 w-5 shrink-0 items-center justify-center ${focusRing}`}
      onClick={() => onChange(mixed ? false : !checked)}
    >
      {statusColor && !filled ? (
        <span className="flex items-center justify-center group-hover:hidden">
          <StatusMark color={statusColor} />
        </span>
      ) : null}
      <span
        className={`h-4 w-4 items-center justify-center rounded border ${
          filled ? "flex border-accent bg-accent text-white" : statusColor ? "hidden border-ink-faint group-hover:flex" : "flex border-ink-faint bg-surface-raised"
        }`}
      >
        {mixed ? <MinusIcon /> : checked ? <CheckIcon /> : null}
      </span>
    </button>
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
  disabled = false,
  selectedIds,
  onToggleSelect,
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
  disabled?: boolean;
  selectedIds: string[];
  onToggleSelect: (taskId: string) => void;
  onToggle: () => void;
  onOpen: (id: string) => void;
  onStatus: (taskId: string, statusId: string) => void;
  onDue: (taskId: string, dueDate: string | null) => void;
  onAssignees: (taskId: string, assigneeIds: string[]) => void;
  onPriority: (taskId: string, priority: Priority) => void;
}) {
  const updateTask = useFlowboard((state) => state.updateTask);
  const status = statuses.find((item) => item.id === task.statusId);
  const overdue = isOverdue(task.dueDate, status?.category ?? null);
  const children = depth === 0 ? subtasksOf(tasks, task.id) : [];
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const isParent = depth === 0;
  const showChildren = expanded || adding;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !isParent || disabled || adding || renaming,
  });
  // dnd-kit needs this transform. See README "Drag-and-drop styles".
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const checked = selectedIds.includes(task.id);
  const row = (
    <div className={`group items-center border-t border-line px-4 py-1.5 hover:bg-surface ${checked ? "bg-accent-soft" : ""} ${listGrid}`}>
      <div className={`flex min-w-0 items-center gap-1.5 ${depth ? "pl-7" : ""}`}>
        {isParent ? (
          <button
            type="button"
            aria-label={`Drag ${task.title}`}
            className={`flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-ink-faint opacity-0 hover:text-ink group-hover:opacity-100 active:cursor-grabbing ${focusRing}`}
            {...attributes}
            {...listeners}
          >
            <GripIcon />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <SelectToggle
          checked={checked}
          statusColor={status?.color}
          label={`Select ${task.title}`}
          onChange={() => onToggleSelect(task.id)}
        />
        {children.length > 0 || adding ? (
          <button
            type="button"
            className={`rounded-control p-0.5 text-ink-faint hover:text-ink ${focusRing}`}
            aria-label={`${expanded ? "Collapse" : "Expand"} subtasks`}
            onClick={() => {
              if (adding) setAdding(false);
              onToggle();
            }}
          >
            <Chevron collapsed={!showChildren} />
          </button>
        ) : (
          <span className="w-5" />
        )}
        {renaming ? (
          <RenameField
            title={task.title}
            onRename={(title) => {
              if (title !== task.title) updateTask(task.id, { title });
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <button type="button" className="min-w-0 flex-1 truncate text-left text-sm text-ink hover:text-accent" onClick={() => onOpen(task.id)}>
            {task.title}
          </button>
        )}
        {renaming ? null : (
          <div className="hidden shrink-0 items-center group-hover:flex">
            {isParent ? (
              <button
                type="button"
                aria-label="Add subtask"
                className={`flex h-6 w-6 items-center justify-center rounded-full text-ink-faint hover:bg-surface-sunken hover:text-ink ${focusRing}`}
                onClick={() => {
                  setAdding(true);
                  if (!expanded) onToggle();
                }}
              >
                <PlusIcon />
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Rename task"
              className={`flex h-6 w-6 items-center justify-center rounded-full text-ink-faint hover:bg-surface-sunken hover:text-ink ${focusRing}`}
              onClick={() => setRenaming(true)}
            >
              <PencilIcon />
            </button>
          </div>
        )}
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
  );

  const tree = (
    <>
      {row}
      {showChildren
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
              disabled
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onToggle={() => undefined}
              onOpen={onOpen}
              onStatus={onStatus}
              onDue={onDue}
              onAssignees={onAssignees}
              onPriority={onPriority}
            />
          ))
        : null}
      {adding && isParent ? <ListSubtaskComposer parent={task} onDone={() => setAdding(false)} /> : null}
    </>
  );

  if (!isParent) return tree;

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-40" : ""}>
      {tree}
    </div>
  );
}

function ListDragPreview({ task }: { task: Task }) {
  return (
    <div className={`items-center rounded-control border border-line bg-surface-raised px-4 py-2 shadow-[0_8px_24px_rgb(var(--shadow)/0.16)] ${listGrid}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="flex h-6 w-4 items-center justify-center text-ink-faint">
          <GripIcon />
        </span>
        <span className="min-w-0 truncate text-sm text-ink">{task.title}</span>
      </div>
    </div>
  );
}

function AddTaskRow({
  listId,
  statuses,
  statusId,
  priority,
  dueDate,
  assigneeIds,
  autoOpen,
  composeAt,
  onOpened,
}: {
  listId: string;
  statuses: Status[];
  statusId?: string;
  priority?: Priority;
  dueDate?: string | null;
  assigneeIds?: string[];
  autoOpen: boolean;
  composeAt: number;
  onOpened: () => void;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!autoOpen || composeAt === 0) return;
    setEditing(true);
    onOpened();
  }, [autoOpen, composeAt, onOpened]);

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
      defaultDueDate={dueDate}
      defaultAssigneeIds={assigneeIds}
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

function GripIcon() {
  return (
    <svg viewBox="0 0 10 16" aria-hidden="true" className="h-3.5 w-2.5">
      <path
        d="M3 2.5h.01M7 2.5h.01M3 8h.01M7 8h.01M3 13.5h.01M7 13.5h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RenameField({ title, onRename, onCancel }: { title: string; onRename: (title: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    const end = node.value.length;
    node.setSelectionRange(end, end);
  }, []);
  return (
    <input
      ref={inputRef}
      aria-label="Task name"
      maxLength={500}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim();
        if (next) onRename(next);
        else onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") onCancel();
      }}
      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
    />
  );
}

function ListSubtaskComposer({ parent, onDone }: { parent: Task; onDone: () => void }) {
  const createTask = useFlowboard((state) => state.createTask);
  const users = useFlowboard((state) => state.users);
  const currentUserId = useFlowboard((state) => state.currentUserId);
  const [title, setTitle] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("none");

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = createTask({
      title,
      primaryListId: parent.primaryListId,
      parentTaskId: parent.id,
      statusId: parent.statusId,
      assigneeIds,
      dueDate,
      priority,
    });
    if (!isError(result)) onDone();
  }

  return (
    <form onSubmit={submit} className={`items-center border-t border-line bg-surface px-4 py-1.5 ${listGrid}`}>
      <div className="flex min-w-0 items-center gap-2 pl-7">
        <span className="w-5" />
        <input
          autoFocus
          aria-label="Subtask name"
          placeholder="Subtask Name..."
          maxLength={500}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onDone();
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
        />
      </div>
      <AssigneePicker users={users} assigneeIds={assigneeIds} currentUserId={currentUserId} onChange={setAssigneeIds} />
      <DueDatePicker value={dueDate} onChange={setDueDate} />
      <PriorityPicker value={priority} onChange={setPriority} />
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          className={`px-1.5 py-1 text-sm text-ink-muted hover:text-ink ${focusRing}`}
          onClick={onDone}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim()}
          className={`rounded-full bg-surface-sunken px-2.5 py-1 text-sm font-medium text-ink-muted hover:bg-line disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
        >
          Save
        </button>
      </div>
    </form>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M10 4.5v11M4.5 10h11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M12.6 4.4 15.6 7.4 7.2 15.8H4.2v-3zM11.2 5.8 14.2 8.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
      <path d="M2.2 6.2 4.8 8.8 9.8 3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
      <path d="M2.5 6h7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
