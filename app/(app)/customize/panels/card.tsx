// Shared section card chrome for every Customize panel.
export function Card({
  title,
  blurb,
  action,
  children,
}: {
  title: string
  blurb: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{title}</p>
          <p className="font-sans text-sm text-muted-foreground mt-1">{blurb}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
