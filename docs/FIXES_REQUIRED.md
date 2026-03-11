# Hackerspace.sh - Required Fixes for Production

> **Last Updated**: 2026-03-10  
> **Priority**: CRITICAL > HIGH > MEDIUM > LOW

This document provides a prioritized, actionable checklist of all required fixes.

---

## CRITICAL Fixes (Block Production)

### 1. Add Input Validation

**Files**: `lib/actions.ts`

**Action**: Add Zod schemas to all server actions.

```bash
pnpm add zod
```

**Example Implementation**:
```typescript
// lib/schemas.ts
import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title required').max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(['task', 'chore']),
  area: z.string().max(50).optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'biweekly', 'monthly']).default('none'),
  due_date: z.string().optional(),
})

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  area: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  due_date: z.string().optional(),
})

export const addMemberSchema = z.object({
  display_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  handle: z.string().max(50).optional(),
  tier: z.enum(['plus', 'basic', 'associate']),
  role: z.enum(['admin', 'board', 'treasurer', 'member', 'associate']),
  joined_at: z.string().optional(),
  has_card_access: z.boolean().optional(),
})

// Add schemas for all other actions...
```

**Update actions.ts**:
```typescript
import { createTaskSchema } from './schemas'

export async function createTask(formData: unknown) {
  const parsed = createTaskSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: 'Invalid input', details: parsed.error.flatten() }
  }
  
  const { title, description, type, area, recurrence, due_date } = parsed.data
  // Continue with validated data...
}
```

---

### 2. Implement Rate Limiting

**Files**: `middleware.ts`, new `lib/ratelimit.ts`

**Action**: Add Upstash rate limiting.

```bash
pnpm add @upstash/ratelimit @upstash/redis
```

**Environment Variables**:
```env
UPSTASH_REDIS_REST_URL=your-url
UPSTASH_REDIS_REST_TOKEN=your-token
```

**Implementation**:
```typescript
// lib/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m'), // 60 requests per minute
  analytics: true,
})

export const authRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 auth attempts per minute
})
```

**Update middleware.ts**:
```typescript
import { ratelimit } from '@/lib/ratelimit'

export async function middleware(request: NextRequest) {
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  
  const { success, limit, remaining, reset } = await ratelimit.limit(ip)
  
  if (!success) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
        'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
      },
    })
  }
  
  // Continue with existing middleware...
}
```

---

### 3. Encrypt Secrets

**Files**: New `lib/encryption.ts`, update `lib/actions.ts`

**Environment Variables**:
```env
SECRETS_ENCRYPTION_KEY=your-32-byte-hex-key
```

Generate key: `openssl rand -hex 32`

**Implementation**:
```typescript
// lib/encryption.ts
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

export function encrypt(text: string): string {
  const key = Buffer.from(process.env.SECRETS_ENCRYPTION_KEY!, 'hex')
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(encrypted: string): string {
  const key = Buffer.from(process.env.SECRETS_ENCRYPTION_KEY!, 'hex')
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':')
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM, 
    key, 
    Buffer.from(ivHex, 'hex')
  )
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
```

**Update createSecret action**:
```typescript
import { encrypt } from './encryption'

export async function createSecret(formData: { /* ... */ }) {
  // ... validation and auth checks ...
  
  const { data, error } = await supabase.from('secrets').insert({
    space_id: member.space_id,
    title: formData.title,
    value: encrypt(formData.value),  // Encrypt before storing
    description: formData.description,
    // ...
  })
}
```

---

### 4. Add Error Boundaries

**Files**: New error handling files

**Create app/(app)/error.tsx**:
```typescript
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to error reporting service
    console.error('[v0] App error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-4">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Something went wrong
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">
          We encountered an unexpected error. Please try again.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="text-xs text-red-500 bg-red-50 p-2 rounded mb-4 text-left overflow-auto">
            {error.message}
          </pre>
        )}
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
```

**Create app/(app)/loading.tsx**:
```typescript
import { Spinner } from '@/components/ui/spinner'

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Spinner className="w-8 h-8 text-primary" />
    </div>
  )
}
```

**Create app/error.tsx** and **app/loading.tsx** with similar patterns.

---

### 5. Add CSRF/Origin Check

**Files**: `lib/actions.ts`

**Add helper function**:
```typescript
import { headers } from 'next/headers'

function verifyOrigin() {
  const headersList = headers()
  const origin = headersList.get('origin')
  const host = headersList.get('host')
  
  // In production, verify origin matches host
  if (process.env.NODE_ENV === 'production') {
    if (origin && host && !origin.includes(host)) {
      throw new Error('Invalid origin')
    }
  }
}
```

**Add to sensitive actions**:
```typescript
export async function deleteSecret(secretId: string) {
  verifyOrigin()
  // ... rest of action
}

export async function removeMember(memberId: string) {
  verifyOrigin()
  // ... rest of action
}
```

---

## HIGH Priority Fixes

### 6. Wire Social Auth

**File**: `app/login/page.tsx`

```typescript
async function handleGitHubLogin() {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) setError(error.message)
}

async function handleGoogleLogin() {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
  if (error) setError(error.message)
}
```

**Update auth callback** (already exists but verify):
```typescript
// app/auth/callback/route.ts
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

**Supabase Dashboard**: Enable GitHub and Google providers, add credentials.

---

### 7. Implement CSV Import

**File**: `app/(app)/import/page.tsx` - convert to client component

```bash
pnpm add papaparse
pnpm add -D @types/papaparse
```

**Implementation**:
```typescript
'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { importMembers } from '@/lib/actions'

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ count?: number; error?: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const appFields = ['display_name', 'email', 'phone', 'tier', 'joined_at', 'last_paid_at', 'has_card_access']

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    Papa.parse(selectedFile, {
      header: true,
      preview: 5,
      complete: (results) => {
        setPreview(results.data)
        // Auto-map matching columns
        const headers = results.meta.fields || []
        const autoMap: Record<string, string> = {}
        headers.forEach(header => {
          const lower = header.toLowerCase().replace(/[^a-z]/g, '')
          if (lower.includes('name')) autoMap[header] = 'display_name'
          else if (lower.includes('email')) autoMap[header] = 'email'
          else if (lower.includes('phone')) autoMap[header] = 'phone'
          else if (lower.includes('tier')) autoMap[header] = 'tier'
          else if (lower.includes('join')) autoMap[header] = 'joined_at'
          else if (lower.includes('paid') || lower.includes('dues')) autoMap[header] = 'last_paid_at'
          else if (lower.includes('card')) autoMap[header] = 'has_card_access'
        })
        setMapping(autoMap)
        setStep('map')
      },
      error: (error) => setResult({ error: error.message }),
    })
  }

  async function handleImport() {
    if (!file) return
    setImporting(true)
    
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const mappedRows = results.data.map((row: any) => {
          const mapped: any = {}
          Object.entries(mapping).forEach(([csvCol, appField]) => {
            if (appField && row[csvCol]) {
              mapped[appField] = row[csvCol]
            }
          })
          return mapped
        }).filter((row: any) => row.display_name && row.email)

        const result = await importMembers(mappedRows)
        setResult(result)
        setStep('done')
        setImporting(false)
      },
    })
  }

  // ... render UI based on step
}
```

---

### 8. Create Webhook Endpoint

**File**: New `app/api/webhook/[slug]/members/route.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import crypto from 'crypto'

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const headersList = headers()
  const signature = headersList.get('x-webhook-signature')
  const timestamp = headersList.get('x-webhook-timestamp')
  
  // Verify timestamp is recent (prevent replay attacks)
  if (timestamp) {
    const age = Date.now() - parseInt(timestamp)
    if (age > 300000) { // 5 minutes
      return Response.json({ error: 'Request expired' }, { status: 401 })
    }
  }
  
  const admin = createAdminClient()
  
  // Get space and verify it exists
  const { data: space } = await admin
    .from('spaces')
    .select('id, webhook_secret')
    .eq('slug', params.slug)
    .single()

  if (!space) {
    return Response.json({ error: 'Space not found' }, { status: 404 })
  }

  if (!space.webhook_secret) {
    return Response.json({ error: 'Webhook not configured' }, { status: 400 })
  }

  // Verify signature
  const body = await request.text()
  const expectedSignature = crypto
    .createHmac('sha256', space.webhook_secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  if (signature !== `sha256=${expectedSignature}`) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Process payload
  try {
    const data = JSON.parse(body)
    
    // Handle different event types
    switch (data.event) {
      case 'member.create':
        await admin.from('space_members').insert({
          space_id: space.id,
          display_name: data.member.name,
          email: data.member.email,
          // ... other fields
        })
        break
      
      case 'member.update':
        await admin.from('space_members').update({
          display_name: data.member.name,
          // ... other fields
        }).eq('space_id', space.id).eq('email', data.member.email)
        break
      
      // ... other events
    }
    
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: 'Invalid payload' }, { status: 400 })
  }
}
```

---

## MEDIUM Priority Fixes

### 9. Add Email Notifications

Use Resend or similar service:

```bash
pnpm add resend
```

```typescript
// lib/email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendMemberApprovalEmail(
  to: string,
  spaceName: string
) {
  await resend.emails.send({
    from: 'noreply@hackerspace.sh',
    to,
    subject: `Welcome to ${spaceName}!`,
    html: `<p>Your membership has been approved...</p>`,
  })
}

export async function sendTaskAssignmentEmail(
  to: string,
  taskTitle: string,
  spaceName: string
) {
  await resend.emails.send({
    from: 'noreply@hackerspace.sh',
    to,
    subject: `New task assigned: ${taskTitle}`,
    html: `<p>You have been assigned a task in ${spaceName}...</p>`,
  })
}
```

---

### 10. Add Test Suite

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

**vitest.config.ts**:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
})
```

**tests/setup.ts**:
```typescript
import '@testing-library/jest-dom'
```

**Example test**:
```typescript
// tests/lib/actions.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('Server Actions', () => {
  describe('createTask', () => {
    it('requires authentication', async () => {
      // Mock unauthenticated user
      // ...
    })
    
    it('validates input', async () => {
      // Test with invalid data
      // ...
    })
    
    it('creates task successfully', async () => {
      // Test happy path
      // ...
    })
  })
})
```

---

## Quick Reference: All Files to Create/Update

### New Files
- `lib/schemas.ts` - Zod schemas
- `lib/ratelimit.ts` - Rate limiting
- `lib/encryption.ts` - Secrets encryption
- `lib/email.ts` - Email sending
- `app/(app)/error.tsx` - Error boundary
- `app/(app)/loading.tsx` - Loading state
- `app/error.tsx` - Root error boundary
- `app/loading.tsx` - Root loading state
- `app/api/webhook/[slug]/members/route.ts` - Webhook endpoint
- `vitest.config.ts` - Test config
- `tests/setup.ts` - Test setup
- `tests/**/*.test.ts` - Test files

### Files to Update
- `lib/actions.ts` - Add validation, origin checks
- `middleware.ts` - Add rate limiting
- `app/login/page.tsx` - Wire social auth
- `app/(app)/import/page.tsx` - Implement CSV processing

### Dependencies to Add
```json
{
  "dependencies": {
    "zod": "^3.x",
    "@upstash/ratelimit": "^1.x",
    "@upstash/redis": "^1.x",
    "papaparse": "^5.x",
    "resend": "^3.x"
  },
  "devDependencies": {
    "@types/papaparse": "^5.x",
    "vitest": "^1.x",
    "@testing-library/react": "^14.x",
    "@testing-library/jest-dom": "^6.x",
    "@vitejs/plugin-react": "^4.x",
    "jsdom": "^24.x"
  }
}
```

### Environment Variables to Add
```env
# Rate Limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Encryption
SECRETS_ENCRYPTION_KEY=

# Email
RESEND_API_KEY=

# OAuth (configure in Supabase)
# GitHub and Google credentials set in Supabase Dashboard
```
