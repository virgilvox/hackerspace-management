import { Skeleton } from '@/components/ui/skeleton'

export default function MembersLoading() {
  return (
    <>
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-24" />)}
        </div>
        <Skeleton className="h-9 w-full max-w-md" />
        <div className="rounded-lg border border-border divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-[40%]" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
