'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMember, requireMemberWithRole, logActivity, parseInput } from '@/lib/auth-helpers'
import { createChannelSchema, sendMessageSchema, uuidSchema } from '@/lib/validations'

export async function createChannel(input: {
  name: string
  description?: string | null
  channel_type?: 'general' | 'area' | 'ops' | 'project'
}) {
  const v = parseInput(createChannelSchema, input)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Uniqueness check: channel names must be unique within a space.
  const { data: existing } = await supabase
    .from('comms_channels')
    .select('id')
    .eq('space_id', member.space_id)
    .eq('name', v.data.name)
    .maybeSingle()
  if (existing) return { error: `A channel named "${v.data.name}" already exists.` }

  const { data, error } = await supabase
    .from('comms_channels')
    .insert({
      space_id: member.space_id,
      name: v.data.name,
      description: v.data.description ?? null,
      channel_type: v.data.channel_type ?? 'general',
      created_by: user.id,
      is_default: false,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/comms')
  return { id: data.id }
}

export async function deleteChannel(channelId: string) {
  const v = parseInput(uuidSchema, channelId)
  if (!v.ok) return { error: 'Invalid channel ID' }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // Default channels are protected at the RLS layer too.
  const { error, count } = await supabase
    .from('comms_channels')
    .delete({ count: 'exact' })
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  if (count === 0) return { error: 'Cannot delete this channel' }
  revalidatePath('/comms')
  return { success: true as const }
}

export async function sendMessage(input: { channel_id: string; content: string }) {
  const v = parseInput(sendMessageSchema, input)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // The channel must belong to the caller's space, or a forged channel_id
  // could post into another tenant's channel.
  const { data: channel } = await supabase
    .from('comms_channels')
    .select('id')
    .eq('id', v.data.channel_id)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!channel) return { error: 'Channel not found' }

  // Identity is derived from the session — never from client input.
  const { data, error } = await supabase
    .from('comms_messages')
    .insert({
      channel_id: v.data.channel_id,
      space_id: member.space_id,
      user_id: user.id,
      display_name: member.display_name,
      handle: member.handle,
      content: v.data.content,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'message.send', 'comms_message', data.id)

  revalidatePath('/comms')
  return { data }
}

export async function renameChannel(channelId: string, name: string, description?: string | null) {
  const idCheck = parseInput(uuidSchema, channelId)
  if (!idCheck.ok) return { error: 'Invalid channel ID' }
  const v = parseInput(createChannelSchema, { name, description })
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('comms_channels')
    .update({ name: v.data.name, description: v.data.description ?? null })
    .eq('id', idCheck.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/comms')
  return { success: true as const }
}
