import Link from 'next/link'
import { NewThreadForm } from './new-thread-form'

export default function NewThreadPage() {
  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="mb-6">
        <Link href="/forum" className="font-mono text-[11px] tracking-widest text-muted-foreground hover:text-foreground uppercase">
          ← Forum
        </Link>
        <h1 className="font-mono text-sm tracking-widest uppercase text-muted-foreground mt-2">New thread</h1>
      </div>
      <NewThreadForm />
    </div>
  )
}
