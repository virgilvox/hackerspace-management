import { requireCertificationsManagerPage } from '@/lib/certifications-guard'
import { CertificationsClient } from './certifications-client'

export const dynamic = 'force-dynamic'

export default async function CertificationsPage() {
  const { supabase, member } = await requireCertificationsManagerPage()

  const { data: certifications } = await supabase
    .from('certifications')
    .select('id, name, description, validity_months, is_active, created_at, updated_at')
    .eq('space_id', member.space_id)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })

  return <CertificationsClient initial={certifications ?? []} />
}
