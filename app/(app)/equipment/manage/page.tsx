import { requireEquipmentManagerPage } from '@/lib/equipment-guard'
import { EquipmentManageClient } from './equipment-manage-client'

export const dynamic = 'force-dynamic'

export default async function EquipmentManagePage() {
  const { supabase, member } = await requireEquipmentManagerPage()

  const [{ data: equipment }, { data: certs }] = await Promise.all([
    supabase
      .from('equipment')
      .select('id, name, description, location, status, required_certification_id, asset_tag, is_active')
      .eq('space_id', member.space_id)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('certifications')
      .select('id, name')
      .eq('space_id', member.space_id)
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ])

  return <EquipmentManageClient initial={equipment ?? []} certs={certs ?? []} />
}
