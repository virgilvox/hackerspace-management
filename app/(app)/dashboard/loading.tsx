import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3">
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded border border-border p-4 md:p-5 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-40 w-full rounded border border-border" />
            <Skeleton className="h-40 w-full rounded border border-border" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded border border-border" />
            <Skeleton className="h-24 w-full rounded border border-border" />
          </div>
        </div>
      </div>
    </div>
  )
}
