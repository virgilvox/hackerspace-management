'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pin, Lock, Trash2 } from 'lucide-react'
import { updateForumThread, deleteForumThread } from '@/lib/actions'
import { useConfirm } from '@/components/ui/confirm'

interface Props {
  threadId: string
  pinned: boolean
  locked: boolean
  canModerate: boolean
  isAuthor: boolean
}

export function ThreadActions({ threadId, pinned, locked, canModerate, isAuthor }: Props) {
  const router = useRouter()
  const confirm = useConfirm()

  async function togglePinned() {
    const result = await updateForumThread(threadId, { pinned: !pinned })
    if (result.error) { toast.error(result.error); return }
    router.refresh()
  }

  async function toggleLocked() {
    const result = await updateForumThread(threadId, { locked: !locked })
    if (result.error) { toast.error(result.error); return }
    router.refresh()
  }

  async function handleDelete() {
    if (!(await confirm({ title: 'Delete thread', description: 'All comments are deleted too. This cannot be undone.', confirmText: 'Delete', destructive: true }))) return
    const result = await deleteForumThread(threadId)
    if (result.error) { toast.error(result.error); return }
    toast.success('Thread deleted')
    router.push('/forum')
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      {canModerate && (
        <>
          <button
            onClick={togglePinned}
            className={`font-mono text-[10px] border border-border px-2 py-1 rounded transition flex items-center gap-1 ${pinned ? 'text-amber-600 bg-amber-50' : 'hover:border-amber-500 hover:text-amber-600'}`}
            title={pinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="w-3 h-3" />
            {pinned ? 'Pinned' : 'Pin'}
          </button>
          <button
            onClick={toggleLocked}
            className={`font-mono text-[10px] border border-border px-2 py-1 rounded transition flex items-center gap-1 ${locked ? 'text-muted-foreground bg-muted' : 'hover:border-primary hover:text-primary'}`}
            title={locked ? 'Unlock' : 'Lock'}
          >
            <Lock className="w-3 h-3" />
            {locked ? 'Locked' : 'Lock'}
          </button>
        </>
      )}
      {(isAuthor || canModerate) && (
        <button
          onClick={handleDelete}
          className="text-muted-foreground hover:text-red-500 transition p-1.5"
          title="Delete"
          aria-label="Delete thread"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
