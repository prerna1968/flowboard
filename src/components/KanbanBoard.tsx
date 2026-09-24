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
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Priority, Status, Task, User } from "../types";
import { isError } from "../types";
import { formatDue, isOverdue, priorityLabel, statusAddClass, statusWellClass } from "../lib/format";
import { filterBySearch, subtasksOf, tasksInStatus, topLevelTasks } from "../store/selectors";
import { useFlowboard } from "../store/store";
import { boardColumns, type BoardColumnModel, type BoardDirection, type BoardGroupBy } from "./boardGroups";
import { focusRing } from "./classes";
import { GroupByMenu } from "./GroupByMenu";
import { AssigneePicker, DueDatePicker, PriorityPicker } from "./pickers";
import { EmptyState } from "./feedback";
import { TaskComposer } from "./TaskComposer";
import { Avatar, AvatarStack, PriorityFlag, StatusChip, StatusMark } from "./TaskMeta";

export function KanbanBoard({ listId }: { listId: string }) {
  const tasks = useFlowboard((state) => state.tasks);
  const statuses = useFlowboard((state) => state.statuses);
  const users = useFlowboard((state) => state.users);
  const search = useFlowboard((state) => state.search);
  const openTask = useFlowboard((state) => state.openTask);
  const moveTask = useFlowboard((state) => state.moveTask);
  const updateTask = useFlowboard((state) => state.updateTask);
  const composeTaskListId = useFlowboard((state) => state.composeTaskListId);
  const composeTaskAt = useFlowboard((state) => state.composeTaskAt);
  const clearComposeTask = useFlowboard((state) => state.clearComposeTask);
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
  const todoId = listStatuses.find((status) => status.category === "todo")?.id;
  const composeColumnId =
    composeTaskListId === listId ? (groupBy === "status" && todoId ? todoId : columns[0]?.id) : undefined;
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
    return <EmptyState title="No matching tasks" body={`Nothing in this list matches “${search.trim()}”.`} />;
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
      {!searching && visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="This list is empty" body="Add a task in To do, or use + on a list in the sidebar." />
        </div>
      ) : null}
      <div className="mt-4 flex items-start gap-4 overflow-x-auto pb-4">
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
            autoCompose={composeColumnId === column.id}
            composeAt={composeTaskAt}
            onComposeOpened={clearComposeTask}
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
  autoCompose,
  composeAt,
  onComposeOpened,
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
  autoCompose: boolean;
  composeAt: number;
  onComposeOpened: () => void;
  onOpen: (taskId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `column:${column.id}` });
  const assignee = column.assigneeIds?.length === 1 ? users.find((user) => user.id === column.assigneeIds?.[0]) : undefined;
  const sections = subgroup ? boardColumns(subgroup, direction, column.tasks, statuses, users).filter((section) => section.tasks.length > 0) : [];
  const well = column.statusColor ? (statusWellClass[column.statusColor] ?? statusWellClass.todo) : statusWellClass.todo;
  return (
    <section className="flex w-72 shrink-0 flex-col">
      <SortableContext items={column.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-48 flex-1 flex-col gap-2.5 rounded-2xl p-3 ${well} ${highlighted ? "ring-2 ring-accent" : ""}`}
        >
          <h2 className="flex items-center gap-2 px-0.5">
            {column.statusColor ? (
              <StatusChip color={column.statusColor} label={column.label} />
            ) : (
              <>
                {column.priority ? <PriorityFlag priority={column.priority} decorative /> : null}
                {assignee ? <Avatar user={assignee} /> : null}
                <span className="text-xs font-bold uppercase tracking-wide text-ink">{column.label}</span>
              </>
            )}
            <span className="text-xs font-medium text-ink-faint">{column.tasks.length}</span>
          </h2>
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
          <ColumnAddTask
            listId={listId}
            statuses={statuses}
            column={column}
            autoOpen={autoCompose}
            composeAt={composeAt}
            onOpened={onComposeOpened}
          />
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

function ColumnAddTask({
  listId,
  statuses,
  column,
  autoOpen,
  composeAt,
  onOpened,
}: {
  listId: string;
  statuses: Status[];
  column: BoardColumnModel;
  autoOpen: boolean;
  composeAt: number;
  onOpened: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const todoId = statuses.find((status) => status.category === "todo")?.id;
  useEffect(() => {
    if (!autoOpen || composeAt === 0) return;
    setEditing(true);
    onOpened();
  }, [autoOpen, composeAt, onOpened]);

  if (!editing) {
    const addClass = column.statusColor ? (statusAddClass[column.statusColor] ?? statusAddClass.todo) : statusAddClass.todo;
    return (
      <button type="button" className={`rounded-control px-1 py-1.5 text-left text-sm ${addClass} ${focusRing}`} onClick={() => setEditing(true)}>
        + Add Task
      </button>
    );
  }

  return (
    <TaskComposer
      listId={listId}
      statuses={statuses}
      defaultStatusId={column.statusId ?? todoId}
      defaultPriority={column.priority}
      defaultDueDate={column.dueDate}
      defaultAssigneeIds={column.assigneeIds}
      layout="stack"
      onCancel={() => setEditing(false)}
    />
  );
}

function stopCardInteract(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

const cardActionClass = `flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink ${focusRing}`;

function CardToolbar({
  pinned,
  onAddSubtask,
  onRename,
}: {
  pinned: boolean;
  onAddSubtask?: () => void;
  onRename: () => void;
}) {
  return (
    <div
      className={`absolute right-2 top-2 z-10 items-center gap-0.5 rounded-full bg-surface-raised p-0.5 shadow-[0_1px_2px_rgb(var(--shadow)/0.08)] ring-1 ring-line ${
        pinned ? "flex" : "hidden group-hover/card:flex group-focus-within/card:flex"
      }`}
      onPointerDown={stopCardInteract}
      onClick={stopCardInteract}
    >
      {onAddSubtask ? (
        <button type="button" aria-label="Add subtask" className={cardActionClass} onClick={onAddSubtask}>
          <PlusIcon />
        </button>
      ) : null}
      <button type="button" aria-label="Rename task" className={cardActionClass} onClick={onRename}>
        <PencilIcon />
      </button>
    </div>
  );
}

function CardTitle({
  title,
  renaming,
  onOpen,
  onRename,
  onCancelRename,
}: {
  title: string;
  renaming: boolean;
  onOpen: () => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
}) {
  if (!renaming) {
    return (
      <button type="button" className={`block w-full pr-16 text-left text-sm font-medium leading-5 text-ink hover:text-accent ${focusRing}`} onClick={onOpen}>
        {title}
      </button>
    );
  }
  return <RenameField title={title} onRename={onRename} onCancel={onCancelRename} />;
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
      onPointerDown={stopCardInteract}
      onClick={stopCardInteract}
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
      className="w-full border-0 bg-transparent p-0 text-sm font-medium leading-5 text-ink shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
    />
  );
}

function CardSubtaskComposer({ parent, onDone }: { parent: Task; onDone: () => void }) {
  const createTask = useFlowboard((state) => state.createTask);
  const users = useFlowboard((state) => state.users);
  const currentUserId = useFlowboard((state) => state.currentUserId);
  const [title, setTitle] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("none");
  const assignees = users.filter((user) => assigneeIds.includes(user.id));

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
    <form
      onSubmit={submit}
      onPointerDown={stopCardInteract}
      onClick={stopCardInteract}
      className="rounded-[10px] bg-surface-raised p-3 shadow-[0_1px_2px_rgb(var(--shadow)/0.06)] ring-1 ring-line"
    >
      <div className="flex items-center gap-2">
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
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <button
          type="button"
          className={`shrink-0 px-1.5 py-1 text-sm text-ink-muted hover:text-ink ${focusRing}`}
          onClick={onDone}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim()}
          className={`shrink-0 rounded-full bg-surface-sunken px-3 py-1 text-sm font-medium text-ink-muted hover:bg-line disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
        >
          Save
        </button>
      </div>
      <div className="mt-2 flex flex-col">
        <AssigneePicker users={users} assigneeIds={assigneeIds} currentUserId={currentUserId} onChange={setAssigneeIds}>
          <ComposerPersonIcon />
          {assignees.length > 0 ? <AvatarStack users={assignees} /> : <span className="text-ink-faint">Assignee</span>}
        </AssigneePicker>
        <DueDatePicker value={dueDate} onChange={setDueDate}>
          <ComposerCalendarIcon />
          <span className={dueDate ? "text-ink" : "text-ink-faint"}>{dueDate ? formatDue(dueDate) : "Add date"}</span>
        </DueDatePicker>
        <PriorityPicker value={priority} onChange={setPriority}>
          <PriorityFlag priority={priority} decorative />
          <span className={priority === "none" ? "text-ink-faint" : "text-ink"}>
            {priority === "none" ? "Add priority" : priorityLabel[priority]}
          </span>
        </PriorityPicker>
      </div>
    </form>
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
  const allTasks = useFlowboard((state) => state.tasks);
  const currentUserId = useFlowboard((state) => state.currentUserId);
  const updateTask = useFlowboard((state) => state.updateTask);
  const children = subtasksOf(allTasks, task.id);
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: disabled || adding || renaming,
  });
  // dnd-kit needs this transform. See README "Drag-and-drop styles".
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const showTree = expanded || adding;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`cursor-grab text-left active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
      {...attributes}
      {...listeners}
    >
      <article className="group/card relative rounded-[10px] bg-surface-raised p-3.5 shadow-[0_1px_2px_rgb(var(--shadow)/0.06)]">
        {renaming ? null : (
          <CardToolbar
            pinned={adding}
            onAddSubtask={() => {
              setAdding(true);
              setExpanded(true);
            }}
            onRename={() => setRenaming(true)}
          />
        )}
        <CardTitle
          title={task.title}
          renaming={renaming}
          onOpen={() => onOpen(task.id)}
          onRename={(title) => {
            if (title !== task.title) updateTask(task.id, { title });
            setRenaming(false);
          }}
          onCancelRename={() => setRenaming(false)}
        />
        <CardMeta
          task={task}
          users={users}
          currentUserId={currentUserId}
          status={statuses.find((item) => item.id === task.statusId)}
          onAssignees={(assigneeIds) => updateTask(task.id, { assigneeIds })}
          onDue={(dueDate) => updateTask(task.id, { dueDate })}
          onPriority={(priority) => updateTask(task.id, { priority })}
        />
        {children.length > 0 ? (
          <SubtaskToggle count={children.length} expanded={expanded} onToggle={() => setExpanded((open) => !open)} />
        ) : null}
      </article>
      {showTree ? (
        <ul className="relative mt-1.5 flex flex-col gap-1.5 pl-4" aria-label={subtaskLabel(children.length)}>
          <span className="absolute bottom-3 left-1.5 top-0 w-px bg-line" aria-hidden="true" />
          {children.map((child) => (
            <li key={child.id} className="relative">
              <span className="absolute -left-2.5 top-4 h-px w-2.5 bg-line" aria-hidden="true" />
              <SubtaskCard
                task={child}
                users={users}
                currentUserId={currentUserId}
                status={statuses.find((item) => item.id === child.statusId)}
                onOpen={onOpen}
                onAssignees={(assigneeIds) => updateTask(child.id, { assigneeIds })}
                onDue={(dueDate) => updateTask(child.id, { dueDate })}
                onPriority={(priority) => updateTask(child.id, { priority })}
              />
            </li>
          ))}
          {adding ? (
            <li className="relative">
              <span className="absolute -left-2.5 top-4 h-px w-2.5 bg-line" aria-hidden="true" />
              <CardSubtaskComposer parent={task} onDone={() => setAdding(false)} />
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function SubtaskCard({
  task,
  users,
  currentUserId,
  status,
  onOpen,
  onAssignees,
  onDue,
  onPriority,
}: {
  task: Task;
  users: User[];
  currentUserId: string;
  status?: Status;
  onOpen: (taskId: string) => void;
  onAssignees: (assigneeIds: string[]) => void;
  onDue: (dueDate: string | null) => void;
  onPriority: (priority: Priority) => void;
}) {
  const updateTask = useFlowboard((state) => state.updateTask);
  const [renaming, setRenaming] = useState(false);
  return (
    <article className="group/card relative rounded-[10px] bg-surface-raised p-3 shadow-[0_1px_2px_rgb(var(--shadow)/0.06)]">
      {renaming ? null : <CardToolbar pinned={false} onRename={() => setRenaming(true)} />}
      <CardTitle
        title={task.title}
        renaming={renaming}
        onOpen={() => onOpen(task.id)}
        onRename={(title) => {
          if (title !== task.title) updateTask(task.id, { title });
          setRenaming(false);
        }}
        onCancelRename={() => setRenaming(false)}
      />
      <CardMeta task={task} users={users} currentUserId={currentUserId} status={status} onAssignees={onAssignees} onDue={onDue} onPriority={onPriority} />
    </article>
  );
}

function subtaskLabel(count: number): string {
  return count === 1 ? "1 subtask" : `${count} subtasks`;
}

function SubtaskToggle({ count, expanded, onToggle }: { count: number; expanded: boolean; onToggle: () => void }) {
  const label = subtaskLabel(count);
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={expanded ? `Hide ${label}` : `Show ${label}`}
      className={`mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink ${focusRing}`}
      onPointerDown={stopCardInteract}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {expanded ? <ChevronDownIcon /> : <TreeBranchIcon />}
      {label}
    </button>
  );
}

function CardMeta({
  task,
  users,
  currentUserId,
  status,
  onAssignees,
  onDue,
  onPriority,
}: {
  task: Task;
  users: User[];
  currentUserId: string;
  status?: Status;
  onAssignees: (assigneeIds: string[]) => void;
  onDue: (dueDate: string | null) => void;
  onPriority: (priority: Priority) => void;
}) {
  const overdue = isOverdue(task.dueDate, status?.category ?? null);
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5" onPointerDown={stopCardInteract} onClick={stopCardInteract}>
      <AssigneePicker users={users} assigneeIds={task.assigneeIds} currentUserId={currentUserId} onChange={onAssignees} />
      <DueDatePicker chip value={task.dueDate} overdue={overdue} onChange={onDue} />
      <PriorityPicker chip value={task.priority} onChange={onPriority} />
    </div>
  );
}

function TreeBranchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
      <circle cx="6" cy="5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="6" cy="15" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 6.6v6.8M6 10h5.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="13.4" cy="10" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
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

function ComposerPersonIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted">
      <circle cx="10" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 15.5c.6-2.2 2.3-3.3 4.5-3.3s3.9 1.1 4.5 3.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ComposerCalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted">
      <rect x="3" y="4.5" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 8h14M7 3.5v3M13 3.5v3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TaskCardFace({ task, users, statuses }: { task: Task; users: User[]; statuses: Status[] }) {
  const status = statuses.find((item) => item.id === task.statusId);
  const overdue = isOverdue(task.dueDate, status?.category ?? null);
  const assignees = users.filter((user) => task.assigneeIds.includes(user.id));
  return (
    <article className="rounded-[10px] bg-surface-raised p-3.5 shadow-[0_1px_2px_rgb(var(--shadow)/0.06)]">
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
