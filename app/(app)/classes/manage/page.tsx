import { requireClassesManagerPage } from '@/lib/classes-guard'
import { ClassesManageClient } from './classes-manage-client'

export const dynamic = 'force-dynamic'

export default async function ClassesManagePage() {
  const { supabase, member } = await requireClassesManagerPage()

  const [{ data: classes }, { data: sessions }, { data: certs }, { data: forms }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, title, description, payment_link, capacity, is_active, grants_certification_id, required_form_id, created_at, updated_at')
      .eq('space_id', member.space_id)
      .order('is_active', { ascending: false })
      .order('title', { ascending: true }),
    supabase
      .from('class_sessions')
      .select('id, class_id, starts_at, ends_at, location, capacity, status, notes')
      .eq('space_id', member.space_id)
      .order('starts_at', { ascending: true }),
    supabase
      .from('certifications')
      .select('id, name, is_active')
      .eq('space_id', member.space_id)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('forms')
      .select('id, title, kind')
      .eq('space_id', member.space_id)
      .eq('status', 'published')
      .order('title', { ascending: true }),
  ])

  return (
    <ClassesManageClient
      initialClasses={classes ?? []}
      initialSessions={sessions ?? []}
      certs={certs ?? []}
      forms={forms ?? []}
    />
  )
}
