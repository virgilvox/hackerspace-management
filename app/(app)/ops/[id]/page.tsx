import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import KbEntryEditor from './kb-entry-editor'

export default async function OpsEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('space_members').select('space_id, role, display_name').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member) return null

  const { data: entry } = await supabase
    .from('knowledge_base').select('*').eq('id', id).eq('space_id', member.space_id).single()

  if (!entry) notFound()

  return <KbEntryEditor entry={entry} member={member} />
}
