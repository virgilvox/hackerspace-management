import { createClient } from '@/lib/supabase/server'
import ImportClient from './import-client'
import { PageTitle } from '@/components/ui/page-title'

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()

  const isAdmin = member?.role === 'admin' || member?.role === 'board' || member?.role === 'treasurer'

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-sans text-sm text-muted-foreground">Admin or Treasurer access required</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-6 py-3 flex items-center justify-between">
        <PageTitle>Import & Sync</PageTitle>
        <p className="font-mono text-xs text-sidebar-foreground/50">CSV import · member & payment data</p>
      </div>
      <ImportClient spaceId={member!.space_id} role={member!.role} />
    </div>
  )
}
