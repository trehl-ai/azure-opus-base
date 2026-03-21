import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
}

export function TableSkeleton({ columns = 5, rows = 6 }: TableSkeletonProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-border bg-muted/30">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 bg-[hsl(228,33%,91%)]" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 px-4 py-4 border-b border-border last:border-0"
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-4 flex-1 bg-[hsl(228,33%,91%)]"
              style={{ maxWidth: c === 0 ? "180px" : "120px" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <Skeleton className="h-5 w-48 bg-[hsl(228,33%,91%)]" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20 bg-[hsl(228,33%,91%)]" />
            <Skeleton className="h-4 w-32 bg-[hsl(228,33%,91%)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <Skeleton className="h-10 w-10 rounded-xl mb-3 bg-[hsl(228,33%,91%)]" />
      <Skeleton className="h-8 w-24 mb-2 bg-[hsl(228,33%,91%)]" />
      <Skeleton className="h-3 w-20 bg-[hsl(228,33%,91%)]" />
    </div>
  );
}

export function BoardColumnSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-4 min-w-max pb-4">
      {Array.from({ length: columns }).map((_, c) => (
        <div
          key={c}
          className="flex w-[280px] shrink-0 flex-col rounded-xl border border-transparent bg-[hsl(228,33%,93%)] p-3"
        >
          <div className="mb-3 px-1 space-y-1.5">
            <Skeleton className="h-4 w-24 bg-[hsl(228,33%,88%)]" />
            <Skeleton className="h-3 w-16 bg-[hsl(228,33%,88%)]" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 2 + (c % 2) }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-2">
                <Skeleton className="h-4 w-full bg-[hsl(228,33%,91%)]" />
                <Skeleton className="h-3 w-20 bg-[hsl(228,33%,91%)]" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16 bg-[hsl(228,33%,91%)]" />
                  <Skeleton className="h-5 w-5 rounded-full bg-[hsl(228,33%,91%)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
