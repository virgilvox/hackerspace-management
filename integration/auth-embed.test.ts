// Regression guard for the PGRST201 production outage fixed by migration 052.
// The auth layout (app/(app)/layout.tsx) resolves membership with
// `space_members.select('*, spaces(*)')`. If a migration ever adds a table
// with foreign keys to BOTH space_members and spaces, PostgREST treats it as a
// junction, the spaces embed becomes ambiguous (error code PGRST201), the query
// returns null, and EVERY logged-in user is redirected to /signup. This runs
// the exact embed through PostgREST (where the ambiguity manifests -- a raw psql
// query would not catch it) and fails if it is ever ambiguous again.
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { dbReady } from './db'

function supaEnv(): { url: string; key: string } | null {
  try {
    const out = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' })
    const get = (k: string) =>
      out.split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1).replace(/^"|"$/g, '')
    const url = get('API_URL')
    const key = get('SERVICE_ROLE_KEY')
    return url && key ? { url, key } : null
  } catch {
    return null
  }
}
const env = supaEnv()
const d = describe.skipIf(!dbReady || !env)

d('auth layout membership embed (PGRST201 guard)', () => {
  const sb = createClient(env!.url, env!.key)

  it("space_members.select('*, spaces(*)') is unambiguous", async () => {
    const { error } = await sb.from('space_members').select('*, spaces(*)').limit(1)
    expect(error?.code).not.toBe('PGRST201')
    expect(error).toBeNull()
  })

  it('space_members -> spaces(id) is unambiguous', async () => {
    const { error } = await sb.from('space_members').select('id, spaces(id)').limit(1)
    expect(error?.code).not.toBe('PGRST201')
    expect(error).toBeNull()
  })
})
