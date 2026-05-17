import { Skeleton } from '@/components/ui/skeleton'

export default function PaymentsLoading() {
  return (
    <>
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded border border-border" />)}
        </div>
        <div className="rounded-lg border border-border divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1 max-w-[30%]" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
