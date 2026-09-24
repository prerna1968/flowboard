import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { useState } from "react";
import { roleLabel } from "../lib/format";
import { ancestorChain } from "../store/selectors";
import { useFlowboard } from "../store/store";
import { ArchivedPanel } from "./ArchivedPanel";
import { SwitchUserDialog } from "./SwitchUserDialog";
import { ThemeDialog } from "./ThemeDialog";
import { focusRing, ghostButton } from "./classes";
import { Avatar } from "./TaskMeta";

export function TopBar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const containers = useFlowboard((state) => state.containers);
  const users = useFlowboard((state) => state.users);
  const currentUserId = useFlowboard((state) => state.currentUserId);
  const selectedListId = useFlowboard((state) => state.selectedListId);
  const view = useFlowboard((state) => state.view);
  const search = useFlowboard((state) => state.search);
  const setView = useFlowboard((state) => state.setView);
  const setSearch = useFlowboard((state) => state.setSearch);
  const resetDemo = useFlowboard((state) => state.resetDemo);
  const [themeOpen, setThemeOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const user = users.find((item) => item.id === currentUserId);
  const crumbs = selectedListId ? ancestorChain(containers, selectedListId) : [];
  const list = crumbs.at(-1);
  const parents = crumbs.filter((item) => item.type !== "workspace" && item.id !== list?.id);

  return (
    <header className="border-b border-line bg-surface-raised">
      <div className="flex items-center gap-2 px-3 pt-3 sm:gap-3 sm:px-4">
        <button
          type="button"
          className={ghostButton}
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          onClick={onToggleSidebar}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
            <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7.5 3.5v13" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <p className="min-w-0 flex-1 truncate text-xs text-ink-faint">
          {parents.length === 0
            ? "Spaces"
            : parents.map((crumb, index) => (
                <span key={crumb.id}>
                  {index > 0 ? <span className="px-1">/</span> : null}
                  {crumb.name}
                </span>
              ))}
        </p>
        {user ? (
          <button
            type="button"
            className={ghostButton}
            onClick={() => setSwitchOpen(true)}
          >
            Switch user
          </button>
        ) : null}
        {user ? (
          <Menu>
            <MenuButton
              className={`flex shrink-0 items-center gap-2 rounded-full border border-line py-1 pl-1 pr-1 sm:pr-3 ${focusRing}`}
              aria-label={`Account menu, ${user.name}, ${roleLabel(user.role)}`}
            >
              <Avatar user={user} />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-medium">{user.name}</span>
                <span className="block text-[11px] text-ink-muted">{roleLabel(user.role)}</span>
              </span>
            </MenuButton>
            <MenuItems
              anchor="bottom end"
              className="z-30 w-56 rounded-card bg-surface-raised p-1 shadow-pop ring-1 ring-line [--anchor-gap:8px]"
            >
              <MenuItem>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm text-ink data-[focus]:bg-surface-sunken"
                  onClick={() => setSwitchOpen(true)}
                >
                  <SwitchUserIcon />
                  Switch user
                </button>
              </MenuItem>
              <MenuItem>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm text-ink data-[focus]:bg-surface-sunken"
                  onClick={() => setThemeOpen(true)}
                >
                  <ThemeIcon />
                  Themes
                </button>
              </MenuItem>
              <MenuItem>
                <button
                  type="button"
                  className="w-full rounded-control px-3 py-2 text-left text-sm text-ink-muted data-[focus]:bg-surface-sunken"
                  onClick={resetDemo}
                >
                  Reset demo data
                </button>
              </MenuItem>
            </MenuItems>
          </Menu>
        ) : null}
        {switchOpen ? <SwitchUserDialog onClose={() => setSwitchOpen(false)} /> : null}
        {themeOpen ? <ThemeDialog onClose={() => setThemeOpen(false)} /> : null}
      </div>
      <div className="px-3 pb-1 pt-2 sm:px-5">
        <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">{list?.type === "list" ? list.name : "Select a list"}</h1>
        {list?.description ? <p className="truncate text-sm text-ink-muted">{list.description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1 px-3">
        {(["list", "board"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={view === mode}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${focusRing} ${
              view === mode ? "border-accent text-accent" : "border-transparent text-ink-muted hover:text-ink"
            }`}
            onClick={() => setView(mode)}
          >
            {mode}
          </button>
        ))}
        {list?.type === "list" ? <ArchivedPanel listId={list.id} /> : null}
        <label className="sr-only" htmlFor="task-search">
          Search tasks
        </label>
        <input
          id="task-search"
          className="mb-1 w-full min-w-0 rounded-control border border-line bg-surface px-3 py-1.5 text-sm placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:ml-auto sm:w-56"
          placeholder="Search tasks"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
    </header>
  );
}

function SwitchUserIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 text-ink-muted">
      <path
        d="M7.2 9.2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zm-3.6 6.2c0-2 1.8-3.3 3.6-3.3s3.6 1.3 3.6 3.3M13.6 6.2a2 2 0 1 1 0 4M15 10.8c1.3.4 2.1 1.4 2.1 2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 text-ink-muted">
      <path
        d="M5.2 13.4c1.8 1.8 4.6 1.6 6.2.2 2.2-2 2.4-4.8.4-7.4C10 4 7.2 3.2 5.2 5.2 3.4 7 3.4 11.6 5.2 13.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.4 14.8c.2 1.2 1.4 2.2 2.6 1.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
