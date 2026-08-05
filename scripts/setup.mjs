// -----------------------------------------------------------------------------
// scripts/setup.mjs — one-command setup CLI for a single-tenant deployment.
//
// A hackerspace deployer runs this once to provision their one space AND create
// the first admin login. It talks to Supabase with the service role key, so run
// it from a trusted machine only — never expose the service role key.
//
// USAGE
//   pnpm setup                 Provision the space, then create the first admin,
//                              then print a success summary + login URL.
//   pnpm setup doctor          Validate env + DB connectivity (no writes).
//   pnpm setup provision       Create the space only (idempotent).
//   pnpm setup create-admin    Create the first admin only (idempotent).
//   pnpm setup help            Print help.
//
//   node scripts/setup.mjs create-admin --admin-email you@example.org
//   node scripts/setup.mjs provision --space-name "My Space" --space-slug my-space
//
// CONFIG PRECEDENCE (earlier wins):
//   explicit CLI flag  >  process.env  >  .env.local file
//
// FLAGS
//   --space-name, --space-slug, --space-city
//   --admin-email, --admin-password, --admin-name
//   --yes     non-interactive (never prompt; error out on missing required value)
//   --force   allow provision even if a DIFFERENT space already exists
//
// REQUIRED RUNTIME ENV (see .env.example / .env.local):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
//   SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL
//
// SETUP ENV (used only here, never at runtime):
//   SETUP_SPACE_NAME, SETUP_SPACE_SLUG, SETUP_SPACE_CITY,
//   SETUP_ADMIN_EMAIL, SETUP_ADMIN_PASSWORD, SETUP_ADMIN_NAME
//
// EXIT CODES: 0 ok · 1 usage/env error · 2 runtime failure
// -----------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js'
import { randomBytes, randomInt } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

// --- Exit codes -------------------------------------------------------------
const EXIT_OK = 0
const EXIT_USAGE = 1
const EXIT_RUNTIME = 2

// A usage/env error we can throw and map to exit code 1. Any other thrown error
// is treated as a runtime failure (exit code 2).
class UsageError extends Error {}

// --- Small pretty-print helpers ---------------------------------------------
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m',
}
const useColor = stdout.isTTY
const paint = (color, s) => (useColor ? color + s + c.reset : s)
const ok = (s) => paint(c.green, s)
const bad = (s) => paint(c.red, s)
const warn = (s) => paint(c.yellow, s)
const info = (s) => console.log(s)
const pass = (label) => console.log(`  ${ok('PASS')}  ${label}`)
const fail = (label) => console.log(`  ${bad('FAIL')}  ${label}`)

// -----------------------------------------------------------------------------
// .env.local parsing. Tiny KEY=VALUE parser: ignore blank lines and #-comments,
// strip surrounding single/double quotes. No new deps.
// -----------------------------------------------------------------------------
function parseEnvFile(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return {} // No .env.local is fine — env / flags may cover everything.
  }
  const out = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (!key) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

// -----------------------------------------------------------------------------
// Arg parsing. Supports "--flag value" and "--flag=value" and boolean "--flag".
// -----------------------------------------------------------------------------
const BOOL_FLAGS = new Set(['yes', 'force', 'help'])

function parseArgs(argv) {
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const body = a.slice(2)
    const eq = body.indexOf('=')
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1)
      continue
    }
    if (BOOL_FLAGS.has(body)) {
      flags[body] = true
      continue
    }
    // "--flag value": consume the next token if it isn't itself a flag.
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      flags[body] = next
      i++
    } else {
      flags[body] = true
    }
  }
  return flags
}

// -----------------------------------------------------------------------------
// Config resolution. Precedence: CLI flag > process.env > .env.local.
// process.env is never overridden by the file (mirrors dotenv semantics).
// -----------------------------------------------------------------------------
function buildConfig(flags) {
  const fileEnv = parseEnvFile(resolve(process.cwd(), '.env.local'))
  // env: process.env wins over the file.
  const env = { ...fileEnv }
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v
  }

  // Resolve a value: CLI flag first, then env (process.env + file).
  const pick = (flagName, envName) => {
    const f = flags[flagName]
    if (typeof f === 'string' && f.trim() !== '') return f
    const e = env[envName]
    if (typeof e === 'string' && e.trim() !== '') return e
    return undefined
  }

  return { env, flags, pick }
}

// -----------------------------------------------------------------------------
// Validation / normalization helpers.
// -----------------------------------------------------------------------------
function slugify(raw) {
  return String(raw)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isValidEmail(email) {
  // Deliberately conservative: one @, non-empty local + domain with a dot.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function generateInviteCode() {
  // Mirror lib/auth-actions.ts::generateInviteCode exactly.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const prefix = 'HSL'
  const year = new Date().getFullYear()
  const bytes = randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length]
  return `${prefix}-${year}-${code}`
}

function generatePassword() {
  // Strong, readable-ish random password. 24 chars from a wide alphabet using
  // rejection-free randomInt so there is no modulo bias.
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_'
  let out = ''
  for (let i = 0; i < 24; i++) out += chars[randomInt(chars.length)]
  return out
}

// -----------------------------------------------------------------------------
// Interactive prompting (only when TTY and not --yes).
// -----------------------------------------------------------------------------
async function promptFor(label, { secret = false } = {}) {
  const rl = createInterface({ input: stdin, output: stdout })
  try {
    // node:readline/promises has no built-in masking; for a secret we write the
    // label ourselves, then install a masking output writer BEFORE awaiting the
    // (empty-query) question so each typed char echoes as '*'. Using the awaited
    // promises form is essential: rl.question(query, cb) treats the 2nd arg as
    // options (not a callback) in the promises API, so a callback never fires.
    if (secret) {
      const write = stdout.write.bind(stdout)
      stdout.write(`${label}: `)
      rl._writeToOutput = (str) => {
        if (str.includes('\n') || str.includes('\r')) write(str)
        else write('*')
      }
      const answer = await rl.question('')
      stdout.write('\n')
      return answer.trim()
    }
    const answer = await rl.question(`${label}: `)
    return answer.trim()
  } finally {
    rl.close()
  }
}

const canPrompt = (flags) => Boolean(stdin.isTTY) && !flags.yes

// Resolve a required value: flag/env, else prompt (interactive), else error.
async function requireValue(cfg, { flagName, envName, label, secret = false, optional = false }) {
  const found = cfg.pick(flagName, envName)
  if (found !== undefined) return found
  if (optional) {
    if (canPrompt(cfg.flags)) {
      const v = await promptFor(`${label} (optional, blank to skip)`, { secret })
      return v === '' ? undefined : v
    }
    return undefined
  }
  if (canPrompt(cfg.flags)) {
    let v = ''
    while (v === '') {
      v = await promptFor(label, { secret })
      if (v === '') console.log(warn('  This value is required.'))
    }
    return v
  }
  throw new UsageError(
    `Missing required value: ${label}. Provide --${flagName} or set ${envName} (in env or .env.local), or run interactively without --yes.`,
  )
}

// -----------------------------------------------------------------------------
// Supabase client (service role). Validates the 4 required runtime vars.
// -----------------------------------------------------------------------------
const REQUIRED_RUNTIME = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
]

function missingRuntimeVars(env) {
  return REQUIRED_RUNTIME.filter((k) => {
    const v = env[k]
    return typeof v !== 'string' || v.trim() === ''
  })
}

function makeAdminClient(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// appBaseUrl equivalent: NEXT_PUBLIC_APP_URL, trailing slash stripped.
function appBaseUrl(env) {
  const raw = (env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').trim()
  return raw.replace(/\/+$/, '')
}

// -----------------------------------------------------------------------------
// Subcommand: doctor
// -----------------------------------------------------------------------------
async function cmdDoctor(cfg) {
  console.log(c.bold + 'Setup doctor' + c.reset)
  console.log(paint(c.dim, 'Validating environment and database connectivity...\n'))

  let failed = false

  // 1. Required runtime vars present.
  const missing = missingRuntimeVars(cfg.env)
  for (const k of REQUIRED_RUNTIME) {
    if (missing.includes(k)) {
      fail(`${k} is set`)
      failed = true
    } else {
      pass(`${k} is set`)
    }
  }

  if (missing.length > 0) {
    console.log('\n' + bad('Cannot connect: required variables are missing (see above).'))
    console.log('Set them in your environment or .env.local, then re-run `pnpm setup doctor`.')
    return EXIT_USAGE
  }

  // 2. Connect + verify the spaces table exists via a trivial select.
  const admin = makeAdminClient(cfg.env)
  const { error } = await admin.from('spaces').select('id').limit(1)
  if (error) {
    fail('Connect with service role and query the "spaces" table')
    console.log(paint(c.dim, `        ${error.message}`))
    // 42P01 = undefined_table.
    if (error.code === '42P01' || /relation .* does not exist/i.test(error.message)) {
      console.log(
        '\n' + warn('The "spaces" table does not exist. Run the schema first:') +
        '\n  psql "$DATABASE_URL" -f scripts/schema.sql   (then apply scripts/0NN_*.sql)',
      )
    }
    failed = true
  } else {
    pass('Connect with service role and query the "spaces" table')
  }

  console.log('')
  if (failed) {
    console.log(bad('doctor: FAIL'))
    return EXIT_RUNTIME
  }
  console.log(ok('doctor: PASS') + ' — environment looks good.')
  return EXIT_OK
}

// -----------------------------------------------------------------------------
// Subcommand: provision (create the space). Idempotent.
// -----------------------------------------------------------------------------
async function cmdProvision(cfg) {
  const missing = missingRuntimeVars(cfg.env)
  if (missing.length > 0) {
    throw new UsageError(`Missing required runtime env: ${missing.join(', ')}. Run \`pnpm setup doctor\`.`)
  }
  const admin = makeAdminClient(cfg.env)

  const rawName = await requireValue(cfg, {
    flagName: 'space-name', envName: 'SETUP_SPACE_NAME', label: 'Space name',
  })
  const rawSlug = await requireValue(cfg, {
    flagName: 'space-slug', envName: 'SETUP_SPACE_SLUG', label: 'Space slug (letters, numbers, hyphens)',
  })
  const rawCity = await requireValue(cfg, {
    flagName: 'space-city', envName: 'SETUP_SPACE_CITY', label: 'Space city', optional: true,
  })

  const name = rawName.trim()
  const slug = slugify(rawSlug)
  const city = rawCity && rawCity.trim() ? rawCity.trim() : null

  if (!name) throw new UsageError('Space name cannot be empty.')
  if (!slug) throw new UsageError(`Space slug "${rawSlug}" slugifies to empty. Use letters, numbers, or hyphens.`)

  // Idempotency: if a space with this slug already exists, reuse it.
  const { data: existing, error: exErr } = await admin
    .from('spaces')
    .select('id, name, slug, invite_code')
    .eq('slug', slug)
    .maybeSingle()
  if (exErr) throw new Error(`Failed to look up existing space: ${exErr.message}`)

  if (existing) {
    console.log(ok('Space already exists') + ' (idempotent, nothing to do):')
    console.log(`  id:          ${existing.id}`)
    console.log(`  name:        ${existing.name}`)
    console.log(`  slug:        ${existing.slug}`)
    console.log(`  invite_code: ${existing.invite_code}`)
    return { id: existing.id, slug: existing.slug, invite_code: existing.invite_code, created: false }
  }

  // Safety: refuse to add a SECOND space to a single-tenant DB unless --force.
  const { data: others, error: othersErr } = await admin
    .from('spaces')
    .select('id, name, slug')
    .limit(5)
  if (othersErr) throw new Error(`Failed to check existing spaces: ${othersErr.message}`)
  if (others && others.length > 0 && !cfg.flags.force) {
    console.log(bad('Refusing to create a second space.'))
    console.log('This database already contains a different space:')
    for (const s of others) console.log(`  - ${s.name} (${s.slug})`)
    console.log(
      '\nA single-tenant deployment hosts exactly one space. If you really intend to\n' +
      'add another, re-run with --force. Otherwise check NEXT_PUBLIC_SINGLE_TENANT_SPACE_SLUG.',
    )
    throw new UsageError('Provision aborted: a different space already exists (use --force to override).')
  }

  const invite_code = generateInviteCode()
  const { data: space, error: insErr } = await admin
    .from('spaces')
    .insert({ name, slug, city, invite_code })
    .select('id, slug, invite_code')
    .single()

  if (insErr || !space) {
    if (insErr?.code === '23505') {
      throw new Error(`A space with slug "${slug}" already exists (race). Re-run to reuse it.`)
    }
    throw new Error(`Failed to create space: ${insErr?.message ?? 'unknown error'}`)
  }

  console.log(ok('Created space:'))
  console.log(`  id:          ${space.id}`)
  console.log(`  name:        ${name}`)
  console.log(`  slug:        ${space.slug}`)
  console.log(`  invite_code: ${space.invite_code}`)
  console.log(paint(c.dim, '  (default channels, areas, and tiers were created automatically.)'))
  return { id: space.id, slug: space.slug, invite_code: space.invite_code, created: true }
}

// -----------------------------------------------------------------------------
// Resolve the target space for create-admin: by --space-slug/SETUP_SPACE_SLUG,
// else the sole space in the DB.
// -----------------------------------------------------------------------------
async function resolveTargetSpace(cfg, admin) {
  const slugRaw = cfg.pick('space-slug', 'SETUP_SPACE_SLUG')
  if (slugRaw && slugRaw.trim()) {
    const slug = slugify(slugRaw)
    const { data, error } = await admin
      .from('spaces')
      .select('id, name, slug')
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw new Error(`Failed to look up space "${slug}": ${error.message}`)
    if (!data) throw new UsageError(`No space with slug "${slug}". Run \`pnpm setup provision\` first.`)
    return data
  }
  // No slug given: require exactly one space.
  const { data: spaces, error } = await admin
    .from('spaces')
    .select('id, name, slug')
    .order('created_at', { ascending: true })
    .limit(2)
  if (error) throw new Error(`Failed to list spaces: ${error.message}`)
  if (!spaces || spaces.length === 0) {
    throw new UsageError('No space exists yet. Run `pnpm setup provision` first.')
  }
  if (spaces.length > 1) {
    throw new UsageError('Multiple spaces exist; specify which with --space-slug or SETUP_SPACE_SLUG.')
  }
  return spaces[0]
}

// Find an existing auth user by email (paginates the admin list). Supabase-js
// has no getUserByEmail, so we scan pages of listUsers.
async function findAuthUserByEmail(admin, email) {
  const target = email.toLowerCase()
  const perPage = 200
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Failed to list auth users: ${error.message}`)
    const users = data?.users ?? []
    const hit = users.find((u) => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit
    if (users.length < perPage) break // last page
  }
  return null
}

// -----------------------------------------------------------------------------
// Subcommand: create-admin. Idempotent.
// -----------------------------------------------------------------------------
async function cmdCreateAdmin(cfg) {
  const missing = missingRuntimeVars(cfg.env)
  if (missing.length > 0) {
    throw new UsageError(`Missing required runtime env: ${missing.join(', ')}. Run \`pnpm setup doctor\`.`)
  }
  const admin = makeAdminClient(cfg.env)

  const space = await resolveTargetSpace(cfg, admin)

  const rawEmail = await requireValue(cfg, {
    flagName: 'admin-email', envName: 'SETUP_ADMIN_EMAIL', label: 'Admin email',
  })
  const email = rawEmail.trim().toLowerCase()
  if (!isValidEmail(email)) throw new UsageError(`"${rawEmail}" is not a valid email address.`)

  const nameVal = await requireValue(cfg, {
    flagName: 'admin-name', envName: 'SETUP_ADMIN_NAME', label: 'Admin display name', optional: true,
  })
  const displayName = (nameVal && nameVal.trim()) || email

  // Find or create the auth user.
  let authUser = await findAuthUserByEmail(admin, email)
  let generatedPassword = null

  if (authUser) {
    console.log(ok('Auth user already exists') + ` (${email}) — reusing it.`)
  } else {
    // Resolve password: flag/env, else generate (and print once).
    let password = cfg.pick('admin-password', 'SETUP_ADMIN_PASSWORD')
    if (!password || password.trim() === '') {
      if (canPrompt(cfg.flags)) {
        const typed = await promptFor('Admin password (blank to auto-generate a strong one)', { secret: true })
        password = typed === '' ? null : typed
      }
    }
    if (!password) {
      password = generatePassword()
      generatedPassword = password
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    })
    if (createErr || !created?.user) {
      throw new Error(`Failed to create auth user: ${createErr?.message ?? 'unknown error'}`)
    }
    authUser = created.user
    console.log(ok('Created auth user:') + ` ${email}`)
  }

  // Find or create the space_members admin row.
  const { data: existingMember, error: memLookupErr } = await admin
    .from('space_members')
    .select('id, role, status')
    .eq('space_id', space.id)
    .eq('user_id', authUser.id)
    .maybeSingle()
  if (memLookupErr) throw new Error(`Failed to look up membership: ${memLookupErr.message}`)

  if (existingMember) {
    console.log(ok('Admin membership already exists') + ` (role: ${existingMember.role}, status: ${existingMember.status}) — nothing to do.`)
  } else {
    const { error: memErr } = await admin.from('space_members').insert({
      space_id: space.id,
      user_id: authUser.id,
      display_name: displayName,
      email,
      role: 'admin',
      tier: 'plus',
      status: 'current',
      approved: true,
      onboarding_completed_at: new Date().toISOString(),
    })
    if (memErr) {
      if (memErr.code === '23505') {
        console.log(warn('Membership already exists (unique constraint) — treating as done.'))
      } else {
        throw new Error(`Failed to create admin membership: ${memErr.message}`)
      }
    } else {
      console.log(ok('Created admin membership') + ` in "${space.name}" (${space.slug}).`)
    }
  }

  if (generatedPassword) {
    console.log('')
    console.log(warn('A password was generated for this admin. Save it now — it is shown only once:'))
    console.log('  ' + c.bold + generatedPassword + c.reset)
  }

  return { email, spaceId: space.id, spaceSlug: space.slug, generatedPassword }
}

// -----------------------------------------------------------------------------
// Default / setup: provision THEN create-admin, then a success summary.
// -----------------------------------------------------------------------------
async function cmdSetup(cfg) {
  console.log(c.bold + 'hackerspace setup' + c.reset)
  console.log(paint(c.dim, 'Provisioning your space and first admin login...\n'))

  console.log(c.bold + 'Step 1/2 — provision space' + c.reset)
  const space = await cmdProvision(cfg)

  console.log('\n' + c.bold + 'Step 2/2 — create first admin' + c.reset)
  const adminResult = await cmdCreateAdmin(cfg)

  const base = appBaseUrl(cfg.env)
  console.log('')
  console.log(ok('Setup complete.'))
  console.log('')
  console.log(c.bold + 'Summary' + c.reset)
  console.log(`  Space:        ${space.slug}`)
  console.log(`  Space id:     ${space.id}`)
  console.log(`  Invite code:  ${space.invite_code}`)
  console.log(`  Admin email:  ${adminResult.email}`)
  console.log(`  Login URL:    ${base}/login`)
  console.log('')
  console.log(c.bold + 'Next steps' + c.reset)
  console.log(`  1. Open ${base}/login and sign in as ${adminResult.email}.`)
  if (adminResult.generatedPassword) {
    console.log('  2. Use the generated password printed above (shown only once).')
    console.log('  3. Set NEXT_PUBLIC_SINGLE_TENANT=true and NEXT_PUBLIC_SINGLE_TENANT_SPACE_SLUG=' + space.slug + ' if running single-tenant.')
    console.log('  4. You may now clear SETUP_ADMIN_PASSWORD from your env.')
  } else {
    console.log('  2. Sign in with the password you configured.')
    console.log('  3. Set NEXT_PUBLIC_SINGLE_TENANT=true and NEXT_PUBLIC_SINGLE_TENANT_SPACE_SLUG=' + space.slug + ' if running single-tenant.')
    console.log('  4. You may now clear SETUP_ADMIN_PASSWORD from your env.')
  }
  return EXIT_OK
}

// -----------------------------------------------------------------------------
// Help.
// -----------------------------------------------------------------------------
function printHelp() {
  console.log(`${c.bold}hackerspace setup CLI${c.reset}

${c.bold}Usage${c.reset}
  pnpm setup [command] [flags]
  node scripts/setup.mjs [command] [flags]

${c.bold}Commands${c.reset}
  setup            (default) provision the space, then create the first admin
  doctor           validate env + DB connectivity (no writes)
  provision        create the space only (idempotent)
  create-admin     create the first admin only (idempotent)
  help             show this help

${c.bold}Flags${c.reset}
  --space-name <name>       space display name        (env SETUP_SPACE_NAME)
  --space-slug <slug>       url slug, [a-z0-9-]       (env SETUP_SPACE_SLUG)
  --space-city <city>       optional city             (env SETUP_SPACE_CITY)
  --admin-email <email>     first admin email         (env SETUP_ADMIN_EMAIL)
  --admin-password <pw>     first admin password      (env SETUP_ADMIN_PASSWORD)
  --admin-name <name>       first admin display name  (env SETUP_ADMIN_NAME)
  --yes                     non-interactive; never prompt
  --force                   allow provision when a different space already exists

${c.bold}Config precedence${c.reset}  (earlier wins)
  CLI flag  >  process.env  >  .env.local

${c.bold}Required runtime env${c.reset}
  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL

${c.bold}Examples${c.reset}
  pnpm setup
  pnpm setup doctor
  node scripts/setup.mjs create-admin --admin-email you@example.org

Exit codes: 0 ok · 1 usage/env · 2 runtime failure
`)
}

// -----------------------------------------------------------------------------
// Entry point.
// -----------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2)
  const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'setup'
  const flags = parseArgs(argv)

  if (command === 'help' || command === '--help' || flags.help) {
    printHelp()
    return EXIT_OK
  }

  const known = new Set(['setup', 'doctor', 'provision', 'create-admin'])
  if (!known.has(command)) {
    console.log(bad(`Unknown command: ${command}`))
    console.log('')
    printHelp()
    return EXIT_USAGE
  }

  const cfg = buildConfig(flags)

  switch (command) {
    case 'doctor':
      return await cmdDoctor(cfg)
    case 'provision':
      await cmdProvision(cfg)
      return EXIT_OK
    case 'create-admin':
      await cmdCreateAdmin(cfg)
      return EXIT_OK
    case 'setup':
    default:
      return await cmdSetup(cfg)
  }
}

main()
  .then((code) => process.exit(typeof code === 'number' ? code : EXIT_OK))
  .catch((err) => {
    if (err instanceof UsageError) {
      console.error('\n' + bad('Error: ') + err.message)
      process.exit(EXIT_USAGE)
    }
    console.error('\n' + bad('Error: ') + (err?.message ?? String(err)))
    process.exit(EXIT_RUNTIME)
  })
