import { cn } from '@/lib/utils'

// The app's standard page chrome. PageHeader is the sidebar-colored bar that
// every top-level page opens with; PageTitle is its semantic h1; SectionTitle
// is the mono-uppercase h2 used for content sections within a page. Routing
// every page through these keeps the heading style and the document outline
// consistent for sighted and assistive-tech users alike.

function PageHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between gap-3',
        className,
      )}
      {...props}
    />
  )
}

function PageTitle({ className, ...props }: React.ComponentProps<'h1'>) {
  return (
    <h1
      className={cn('text-white font-sans text-lg font-semibold', className)}
      {...props}
    />
  )
}

function SectionTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      className={cn(
        'font-mono text-[10px] tracking-widest text-muted-foreground uppercase',
        className,
      )}
      {...props}
    />
  )
}

export { PageHeader, PageTitle, SectionTitle }
