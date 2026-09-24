export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface-raised px-6 text-center">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>
    </div>
  );
}

export function TreeSkeleton() {
  return (
    <div className="space-y-2 px-3 py-4" aria-hidden="true">
      {["w-36", "w-28", "w-24", "w-32", "w-20", "w-28"].map((width, index) => (
        <div key={index} className={`h-8 animate-pulse rounded-control bg-surface-sunken ${width}`} />
      ))}
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="flex gap-4" aria-busy="true" aria-label="Loading tasks">
      {[0, 1, 2].map((column) => (
        <div key={column} className="w-72 shrink-0 rounded-card bg-surface-sunken/70 p-3">
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-line" />
          <div className="space-y-2">
            <div className="h-24 animate-pulse rounded-card bg-surface-raised" />
            <div className="h-24 animate-pulse rounded-card bg-surface-raised" />
          </div>
        </div>
      ))}
    </div>
  );
}
