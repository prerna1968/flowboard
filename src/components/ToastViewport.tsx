import { useFlowboard } from "../store/store";

export function ToastViewport() {
  const toasts = useFlowboard((state) => state.toasts);
  const dismissToast = useFlowboard((state) => state.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex max-w-sm flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-80" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-start justify-between gap-3 rounded-card bg-ink px-3 py-3 text-sm text-surface shadow-pop"
        >
          <p>{toast.message}</p>
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-surface/80 hover:text-surface"
            onClick={() => dismissToast(toast.id)}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
