import { Loader2 } from 'lucide-react'

export default function AppLoading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-mono">Loading...</p>
      </div>
    </div>
  )
}
