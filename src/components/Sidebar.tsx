import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { Container, ContainerType } from "../types";
import { childContainers } from "../store/selectors";
import { useFlowboard } from "../store/store";
import { sidebarContainers } from "../store/permissions";
import { isDesktopLayout } from "../lib/layout";
import { focusRing } from "./classes";
import { CreateContainerDialog } from "./CreateContainerDialog";
import { CreateSpaceDialog } from "./CreateSpaceDialog";
import { TreeSkeleton } from "./feedback";

const indent = ["pl-1", "pl-4", "pl-7", "pl-10"];
const sidebarMin = 200;
const sidebarMax = 480;
const sidebarDefault = 288;

function clampSidebar(width: number): number {
  return Math.min(sidebarMax, Math.max(sidebarMin, width));
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const containers = useFlowboard((state) => state.containers);
  const grants = useFlowboard((state) => state.grants);
  const users = useFlowboard((state) => state.users);
  const currentUserId = useFlowboard((state) => state.currentUserId);
  const selectedListId = useFlowboard((state) => state.selectedListId);
  const booting = useFlowboard((state) => state.booting);
  const selectList = useFlowboard((state) => state.selectList);
  const requestComposeTask = useFlowboard((state) => state.requestComposeTask);
  const renameContainer = useFlowboard((state) => state.renameContainer);
  const archiveContainer = useFlowboard((state) => state.archiveContainer);
  const unarchiveContainer = useFlowboard((state) => state.unarchiveContainer);
  const deleteContainer = useFlowboard((state) => state.deleteContainer);
  const reorderContainers = useFlowboard((state) => state.reorderContainers);
  const [width, setWidth] = useState(sidebarDefault);
  const [hintY, setHintY] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const lastClick = useRef(0);
  const closeTimer = useRef<number | null>(null);
  const closeShortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘\\" : "Ctrl \\";
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [renameId, setRenameId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; kind: "archive" | "delete" } | null>(null);
  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false);
  const [createDialog, setCreateDialog] = useState<{ type: "list" | "folder"; parentId: string } | null>(null);
  const [showArchived, setShowArchived] = useState(true);
  const [hiddenArchived, setHiddenArchived] = useState<Record<string, boolean>>({});

  const user = users.find((item) => item.id === currentUserId);
  const visible = useMemo(
    () => (user ? sidebarContainers(containers, user, grants) : []),
    [containers, grants, user],
  );
  const isAdmin = user?.role === "admin";
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeContainer = visible.find((container) => container.id === active.id && !container.archivedAt);
    const overContainer = visible.find((container) => container.id === over.id && !container.archivedAt);
    if (!activeContainer || !overContainer || activeContainer.parentId !== overContainer.parentId) return;
    const siblings = childContainers(visible, activeContainer.parentId);
    const oldIndex = siblings.findIndex((container) => container.id === active.id);
    const newIndex = siblings.findIndex((container) => container.id === over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    reorderContainers(
      activeContainer.parentId ?? "",
      arrayMove(siblings, oldIndex, newIndex).map((container) => container.id),
    );
  }

  function cancelClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  useEffect(() => cancelClose, []);

  function onResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    cancelClose();
    const handle = event.currentTarget;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // The pointer can already be gone if the browser released it.
    }
    draggingRef.current = true;
    setHintY(null);
    const startX = event.clientX;
    const startWidth = width;
    let moved = false;
    const move = (pointer: PointerEvent) => {
      if (Math.abs(pointer.clientX - startX) > 3) moved = true;
      if (moved) setWidth(clampSidebar(startWidth + pointer.clientX - startX));
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      document.body.classList.remove("cursor-col-resize", "select-none");
      draggingRef.current = false;
      if (moved) return;
      const now = Date.now();
      if (now - lastClick.current < 300) {
        lastClick.current = 0;
        setWidth(sidebarDefault);
        return;
      }
      lastClick.current = now;
      closeTimer.current = window.setTimeout(() => onClose(), 280);
    };
    document.body.classList.add("cursor-col-resize", "select-none");
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  function onEdgeMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (draggingRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const next = event.clientY - bounds.top;
    setHintY(Math.min(Math.max(next, 56), bounds.height - 56));
  }

  return (
    <>
    {open ? (
      <button
        type="button"
        aria-label="Close sidebar"
        className="fixed inset-0 z-20 bg-ink/40 md:hidden"
        onClick={onClose}
      />
    ) : null}
    <aside
      aria-label="Workspace tree"
      aria-hidden={open ? undefined : true}
      style={open ? { width } : undefined}
      className={`relative shrink-0 border-line bg-surface-raised ${
        open
          ? "border-r max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-30"
          : "pointer-events-none w-0 overflow-hidden border-0"
      }`}
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center gap-2 border-b border-line px-3 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-control bg-accent text-xs font-bold text-on">F</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">Flowboard</p>
            <p className="text-[11px] text-ink-faint">Workspace</p>
          </div>
        </div>
        {booting || !user ? (
          <TreeSkeleton />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <Tree
                parentId={null}
                depth={0}
                visible={visible}
                grants={grants}
                isAdmin={isAdmin}
                collapsed={collapsed}
                selectedListId={selectedListId}
                renameId={renameId}
                confirmAction={confirmAction}
                showArchived={showArchived}
                hiddenArchived={hiddenArchived}
                onToggleShowArchived={() => {
                  setShowArchived((current) => !current);
                  setHiddenArchived({});
                }}
                onToggle={(id) => setCollapsed((current) => ({ ...current, [id]: !current[id] }))}
                onSelect={(id) => {
                  selectList(id);
                  if (!isDesktopLayout()) onClose();
                }}
                onCreateList={(parentId) => {
                  setCollapsed((current) => ({ ...current, [parentId]: false }));
                  setCreateDialog({ type: "list", parentId });
                }}
                onCreateFolder={(parentId) => {
                  setCollapsed((current) => ({ ...current, [parentId]: false }));
                  setCreateDialog({ type: "folder", parentId });
                }}
                onCreateSpace={() => setSpaceDialogOpen(true)}
                onCreateTask={(listId) => {
                  requestComposeTask(listId);
                  if (!isDesktopLayout()) onClose();
                }}
                onStartRename={setRenameId}
                onRename={(id, name) => {
                  const result = renameContainer(id, name);
                  if (!("error" in result)) setRenameId(null);
                }}
                onCancelRename={() => setRenameId(null)}
                onAskArchive={(id) => setConfirmAction({ id, kind: "archive" })}
                onAskDelete={(id) => setConfirmAction({ id, kind: "delete" })}
                onCancelConfirm={() => setConfirmAction(null)}
                onArchive={(id) => {
                  archiveContainer(id);
                  setConfirmAction(null);
                }}
                onDelete={(id) => {
                  deleteContainer(id);
                  setConfirmAction(null);
                }}
                onRestore={(id) => unarchiveContainer(id)}
                onHideArchived={(id) => setHiddenArchived((current) => ({ ...current, [id]: true }))}
              />
            </DndContext>
          </div>
        )}
        {spaceDialogOpen ? <CreateSpaceDialog onClose={() => setSpaceDialogOpen(false)} /> : null}
        {createDialog ? (
          <CreateContainerDialog
            type={createDialog.type}
            defaultParentId={createDialog.parentId}
            onClose={() => setCreateDialog(null)}
          />
        ) : null}
      </div>
      {open ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Sidebar edge"
          aria-valuemin={sidebarMin}
          aria-valuemax={sidebarMax}
          aria-valuenow={width}
          aria-keyshortcuts="Meta+\\"
          tabIndex={0}
          className="group absolute inset-y-0 -right-1.5 z-20 hidden w-3 cursor-col-resize touch-none md:block"
          onPointerDown={onResizeStart}
          onPointerMove={onEdgeMove}
          onPointerLeave={() => setHintY(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setWidth((current) => clampSidebar(current - 16));
            if (event.key === "ArrowRight") setWidth((current) => clampSidebar(current + 16));
          }}
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent group-hover:bg-accent" />
          {hintY === null ? null : (
            <div
              role="tooltip"
              style={{ top: hintY }}
              className="pointer-events-none absolute left-4 z-30 w-44 -translate-y-1/2 rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-pop"
            >
              <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-ink" />
              <EdgeHint label="Close" value={closeShortcut} />
              <EdgeHint label="Resize" value="Drag" />
              <EdgeHint label="Reset" value="Double-click" />
            </div>
          )}
        </div>
      ) : null}
    </aside>
    </>
  );
}

function EdgeHint({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 leading-5">
      <span>{label}</span>
      <span className="text-white/60">{value}</span>
    </p>
  );
}

interface TreeProps {
  parentId: string | null;
  depth: number;
  visible: Container[];
  grants: { resourceId: string; mode: string }[];
  isAdmin: boolean;
  collapsed: Record<string, boolean>;
  selectedListId: string | null;
  renameId: string | null;
  confirmAction: { id: string; kind: "archive" | "delete" } | null;
  showArchived: boolean;
  hiddenArchived: Record<string, boolean>;
  onToggleShowArchived: () => void;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onCreateList: (parentId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onCreateSpace: () => void;
  onCreateTask: (listId: string) => void;
  onStartRename: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onAskArchive: (id: string) => void;
  onAskDelete: (id: string) => void;
  onCancelConfirm: () => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onHideArchived: (id: string) => void;
}

function Tree(props: TreeProps) {
  const children = childContainers(props.visible, props.parentId, {
    archived: props.isAdmin && props.showArchived,
  }).filter((container) => !container.archivedAt || !props.hiddenArchived[container.id]);
  if (props.parentId === null) {
    const workspace = children[0];
    if (!workspace) return null;
    const archivedCount = props.visible.filter((container) => container.archivedAt && container.type !== "workspace").length;
    return (
      <div>
        <div className="flex items-center gap-1 px-2 pb-1">
          <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Spaces</p>
          {props.isAdmin && archivedCount > 0 ? (
            <button
              type="button"
              aria-pressed={props.showArchived}
              className={`rounded-control px-1.5 py-0.5 text-[11px] font-medium ${focusRing} ${
                props.showArchived ? "bg-surface-sunken text-ink" : "text-ink-faint hover:bg-surface-sunken hover:text-ink"
              }`}
              onClick={props.onToggleShowArchived}
            >
              Archived
            </button>
          ) : null}
          {props.isAdmin ? (
            <button
              type="button"
              aria-label="Create a space"
              className={`rounded-control p-1 text-ink-faint hover:bg-surface-sunken hover:text-ink ${focusRing}`}
              onClick={props.onCreateSpace}
            >
              <PlusIcon />
            </button>
          ) : null}
        </div>
        <Tree {...props} parentId={workspace.id} depth={0} />
      </div>
    );
  }
  return (
    <SortableContext items={children.map((container) => container.id)} strategy={verticalListSortingStrategy}>
      <ul className="space-y-0.5">
        {children.map((container) => (
          <TreeNode key={container.id} container={container} {...props} />
        ))}
      </ul>
    </SortableContext>
  );
}

function TreeNode({ container, depth, ...props }: TreeProps & { container: Container }) {
  const archived = Boolean(container.archivedAt);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: container.id,
    disabled: !props.isAdmin || container.type === "workspace" || archived,
  });
  // dnd-kit needs this transform. See README "Drag-and-drop styles".
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const isCollapsed = props.collapsed[container.id] ?? false;
  const selected = container.type === "list" && container.id === props.selectedListId;
  const restricted = props.grants.some((grant) => grant.resourceId === container.id && grant.mode === "deny");
  const renaming = props.renameId === container.id;
  const manageable = props.isAdmin && container.type !== "workspace" && !archived;
  const confirming =
    props.isAdmin && container.type !== "workspace" && props.confirmAction?.id === container.id
      ? props.confirmAction.kind
      : null;
  const createItems = archived ? [] : createOptions(container, props.isAdmin, props);

  return (
    <li ref={container.type === "workspace" ? undefined : setNodeRef} style={container.type === "workspace" ? undefined : style} className={isDragging ? "relative z-10 opacity-70" : ""}>
      <div className={`group flex items-center gap-1 rounded-md ${indent[depth] ?? "pl-10"} ${
        archived ? "bg-surface-sunken/70" : selected ? "bg-accent-soft" : "hover:bg-surface"
      }`}>
        {container.type === "list" ? (
          <span className="w-4" />
        ) : (
          <button
            type="button"
            className={`rounded-control p-1 text-ink-faint hover:text-ink ${focusRing}`}
            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${container.name}`}
            onClick={() => props.onToggle(container.id)}
          >
            <Chevron collapsed={isCollapsed} />
          </button>
        )}
        {renaming ? (
          <RenameField
            initial={container.name}
            onCancel={props.onCancelRename}
            onSave={(name) => props.onRename(container.id, name)}
          />
        ) : (
          <button
            type="button"
            className={`flex min-w-0 flex-1 items-center gap-2 truncate rounded-control py-1.5 text-left text-[13px] ${
              archived ? "text-ink-faint" : selected ? "font-semibold text-accent" : "text-ink"
            } ${focusRing}`}
            aria-current={selected ? "page" : undefined}
            title={archived ? `${container.name} is archived` : container.description ?? undefined}
            onClick={() => {
              if (archived) return;
              if (container.type === "list") props.onSelect(container.id);
              else props.onToggle(container.id);
            }}
            onDoubleClick={() => {
              if (props.isAdmin && container.type !== "workspace" && !archived) props.onStartRename(container.id);
            }}
            {...(props.isAdmin && container.type !== "workspace" && !archived ? { ...attributes, ...listeners } : {})}
          >
            <NodeIcon type={container.type} id={container.id} />
            {archived ? (
              <span title="Archived" className="shrink-0 text-ink-faint">
                <ArchiveBoxIcon />
              </span>
            ) : null}
            <span className="truncate">{container.name}</span>
          </button>
        )}
        {container.visibility === "private" ? (
          <span title="Private" className="text-ink-faint">
            <svg viewBox="0 0 20 20" aria-label="Private" className="h-3.5 w-3.5">
              <path fill="currentColor" d="M6.2 8.5V6.8a3.8 3.8 0 0 1 7.6 0v1.7H15v8H5v-8h1.2zm1.6 0h4.4V6.8a2.2 2.2 0 0 0-4.4 0v1.7z" />
            </svg>
          </span>
        ) : null}
        {restricted ? (
          <span className="rounded-full bg-priority-urgentSoft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-priority-urgent">
            Restricted
          </span>
        ) : null}
        {confirming ? (
          <span className="flex shrink-0 items-center">
            <button
              type="button"
              className={`rounded-control px-2 py-1 text-xs font-medium text-danger hover:bg-danger-soft ${focusRing}`}
              onClick={() => (confirming === "delete" ? props.onDelete(container.id) : props.onArchive(container.id))}
            >
              {confirming === "delete" ? "Delete" : "Confirm"}
            </button>
            <button
              type="button"
              className={`rounded-control px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-sunken ${focusRing}`}
              onClick={props.onCancelConfirm}
            >
              Cancel
            </button>
          </span>
        ) : archived ? (
          <span className="flex shrink-0 items-center">
            <button
              type="button"
              aria-label={`Restore ${container.name}`}
              className={`rounded-control p-1 text-ink-faint hover:bg-surface-raised hover:text-ink ${focusRing}`}
              onClick={() => props.onRestore(container.id)}
            >
              <RestoreIcon />
            </button>
            <button
              type="button"
              aria-label={`Hide archived ${container.name}`}
              className={`rounded-control p-1 text-ink-faint hover:bg-surface-raised hover:text-ink ${focusRing}`}
              onClick={() => props.onHideArchived(container.id)}
            >
              <CloseIcon />
            </button>
          </span>
        ) : (
          <span className="flex shrink-0 items-center">
            {manageable ? (
              <NodeMenu
                name={container.name}
                onRename={() => props.onStartRename(container.id)}
                onArchive={() => props.onAskArchive(container.id)}
                onDelete={() => props.onAskDelete(container.id)}
              />
            ) : null}
            {createItems.length > 0 ? <CreateMenu name={container.name} items={createItems} /> : null}
          </span>
        )}
      </div>
      {!archived && !isCollapsed && container.type !== "list" ? <Tree {...props} parentId={container.id} depth={depth + 1} /> : null}
    </li>
  );
}

interface CreateItem {
  key: string;
  label: string;
  hint: string;
  icon: ReactNode;
  run: () => void;
}

function createOptions(
  container: Container,
  isAdmin: boolean,
  props: Pick<TreeProps, "onCreateList" | "onCreateFolder" | "onCreateTask">,
): CreateItem[] {
  const listItem = (parentId: string): CreateItem => ({
    key: "list",
    label: "List",
    hint: "Track tasks, projects, people & more",
    icon: <ListIcon />,
    run: () => props.onCreateList(parentId),
  });

  if (container.type === "list") {
    const items: CreateItem[] = [
      {
        key: "task",
        label: "Task",
        hint: "Create individual tasks to manage your work",
        icon: <TaskIcon />,
        run: () => props.onCreateTask(container.id),
      },
    ];
    // A sibling list lands next to this one, so it reuses the parent.
    if (isAdmin && container.parentId) items.push(listItem(container.parentId));
    return items;
  }

  if (!isAdmin || container.type === "workspace") return [];

  const items = [listItem(container.id)];
  if (container.type === "space") {
    items.push({
      key: "folder",
      label: "Folder",
      hint: "Group Lists, Docs & more",
      icon: <FolderOutlineIcon />,
      run: () => props.onCreateFolder(container.id),
    });
  }
  return items;
}

function CreateMenu({ name, items }: { name: string; items: CreateItem[] }) {
  return (
    <Menu>
      <MenuButton
        aria-label={`Create inside ${name}`}
        className={`rounded-control p-1 text-ink-faint hover:bg-surface-sunken hover:text-ink data-[open]:bg-surface-sunken data-[open]:text-ink ${focusRing}`}
      >
        <PlusIcon />
      </MenuButton>
      <MenuItems
        anchor="bottom start"
        className="z-30 w-72 rounded-xl bg-surface-raised p-1.5 shadow-pop ring-1 ring-line [--anchor-gap:4px] focus:outline-none"
      >
        <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-ink-faint">Create</p>
        {items.map((item) => (
          <MenuItem key={item.key}>
            <button
              type="button"
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left data-[focus]:bg-surface-sunken"
              onClick={item.run}
            >
              <span className="mt-0.5 shrink-0 text-ink-muted">{item.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{item.label}</span>
                <span className="block text-xs text-ink-muted">{item.hint}</span>
              </span>
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

function NodeMenu({
  name,
  onRename,
  onArchive,
  onDelete,
}: {
  name: string;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <Menu>
      <MenuButton
        aria-label={`More options for ${name}`}
        className={`hidden rounded-control p-1 text-ink-faint hover:bg-surface-sunken hover:text-ink max-md:block group-hover:block group-focus-within:block data-[open]:block data-[open]:bg-surface-sunken data-[open]:text-ink ${focusRing}`}
      >
        <DotsIcon />
      </MenuButton>
      <MenuItems
        anchor="bottom start"
        className="z-30 w-44 rounded-xl bg-surface-raised p-1.5 shadow-pop ring-1 ring-line [--anchor-gap:4px] focus:outline-none"
      >
        <MenuItem>
          <button type="button" className={nodeMenuRow} onClick={onRename}>
            <PencilIcon />
            Rename
          </button>
        </MenuItem>
        <MenuItem>
          <button type="button" className={nodeMenuRow} onClick={onArchive}>
            <ArchiveBoxIcon />
            Archive
          </button>
        </MenuItem>
        <MenuItem>
          <button type="button" className={nodeMenuDangerRow} onClick={onDelete}>
            <TrashIcon />
            Delete
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}

const nodeMenuRow =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink data-[focus]:bg-surface-sunken";

const nodeMenuDangerRow =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-danger data-[focus]:bg-danger-soft";

function DotsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M10 6.4a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm0 4.9a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm0 4.9a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path d="M10 5v10M5 10h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path
        d="M15.4 10a5.4 5.4 0 1 1-1.5-3.7M15.4 4.8v2.8h-2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path
        d="M3 6.2 4.4 7.6 6.9 5M3 13.2l1.4 1.4L6.9 12M9.4 6.3h7.3M9.4 13.3h7.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderOutlineIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path
        d="M3.4 6.3A1.3 1.3 0 0 1 4.7 5h2.5l1.4 1.7h6.7a1.3 1.3 0 0 1 1.3 1.3v6.3a1.3 1.3 0 0 1-1.3 1.3H4.7a1.3 1.3 0 0 1-1.3-1.3V6.3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TaskIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="2.8" fill="currentColor" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted">
      <path
        d="M4.5 15.5h2.2l7.6-7.6-2.2-2.2-7.6 7.6v2.2zM13 4.6l2.4 2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArchiveBoxIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted">
      <path
        d="M3.5 4.5h13v3h-13v-3zm1 3h11v8h-11v-8zM8 10.5h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path
        d="M5 6.5h10M8 6.5V5h4v1.5M6.5 6.5l.6 8.2h5.8l.6-8.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RenameField({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <input
      autoFocus
      className="min-w-0 flex-1 rounded-control border border-line px-2 py-1 text-sm"
      value={name}
      aria-label="Rename"
      onChange={(event) => setName(event.target.value)}
      onBlur={() => onSave(name)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSave(name);
        if (event.key === "Escape") onCancel();
      }}
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
}

function NodeIcon({ type, id }: { type: ContainerType; id: string }) {
  if (type === "space") {
    const tone = id.includes("design") ? "bg-accent" : "bg-priority-normal";
    return <span className={`h-3.5 w-3.5 shrink-0 rounded-[3px] ${tone}`} />;
  }
  if (type === "folder") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-faint">
        <path fill="currentColor" d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.2l1.4 1.6H15.5A1.5 1.5 0 0 1 17 7.1v7.4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-faint">
      <path fill="currentColor" d="M4 5h12v1.6H4V5zm0 4.2h12v1.6H4V9.2zm0 4.2h8v1.6H4v-1.6z" />
    </svg>
  );
}

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`h-4 w-4 ${collapsed ? "-rotate-90" : ""}`}
    >
      <path
        d="M5.5 7.5 10 12l4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
