import { useEffect, useState } from "react";
import { desktopQuery, isDesktopLayout } from "./lib/layout";
import { useFlowboard } from "./store/store";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { KanbanBoard } from "./components/KanbanBoard";
import { ListView } from "./components/ListView";
import { TaskDrawer } from "./components/TaskDrawer";
import { ToastViewport } from "./components/ToastViewport";
import { BoardSkeleton, EmptyState } from "./components/feedback";
import { ThemeProvider } from "./theme/ThemeProvider";

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(() => isDesktopLayout());
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        setSidebarOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(desktopQuery);
    function sync() {
      setSidebarOpen(query.matches);
    }
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return (
    <div className="flex h-screen overflow-hidden bg-surface font-sans text-ink antialiased">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        <main className="min-h-0 flex-1 overflow-auto bg-surface-raised">
          <WorkspaceMain />
        </main>
      </div>
      <TaskDrawer />
      <ToastViewport />
    </div>
  );
}

function WorkspaceMain() {
  const containers = useFlowboard((state) => state.containers);
  const selectedListId = useFlowboard((state) => state.selectedListId);
  const view = useFlowboard((state) => state.view);
  const booting = useFlowboard((state) => state.booting);
  const listLoading = useFlowboard((state) => state.listLoading);
  const list = containers.find((container) => container.id === selectedListId && container.type === "list");

  if (booting || listLoading) return <div className="p-4 sm:p-6"><BoardSkeleton /></div>;
  if (!list) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          title="Choose a list"
          body="Pick a list in the sidebar. Tasks are grouped by status, the same way a ClickUp list is."
        />
      </div>
    );
  }

  return view === "board" ? (
    <div className="p-3 sm:p-4">
      <KanbanBoard listId={list.id} />
    </div>
  ) : (
    <ListView listId={list.id} />
  );
}
