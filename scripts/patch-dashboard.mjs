import { readFileSync, writeFileSync } from 'fs'

const path = '/vercel/share/v0-project/app/(app)/dashboard/page.tsx'
let content = readFileSync(path, 'utf8')

// 1. Fix the payments query
content = content.replace(
  `.is('linked_member_id', null)`,
  `.eq('link_status', 'unlinked')`
)

// 2. Add ClaimButton import after the redirect import
if (!content.includes('ClaimButton')) {
  content = content.replace(
    "import { redirect } from 'next/navigation'",
    "import { redirect } from 'next/navigation'\nimport { ClaimButton } from '@/components/task-claim-button'"
  )
}

// 3. Replace the static CLAIM link with ClaimButton
content = content.replace(
  /<Link href="\/tasks" className="font-mono text-\[10px\] border border-border px-2 py-0\.5 rounded hover:border-primary hover:text-primary transition">CLAIM<\/Link>/,
  '{task.status === \'open\' && <ClaimButton taskId={task.id} />}'
)

// 4. Fix project.name -> project.title 
content = content.replace(/project\.name\b/g, 'project.title')

writeFileSync(path, content, 'utf8')
console.log('[v0] Dashboard patched successfully')
console.log('[v0] Content preview (lines 1-10):')
content.split('\n').slice(0, 10).forEach((line, i) => console.log(`${i+1}: ${line}`))
console.log('[v0] Check linked_member_id still present:', content.includes('linked_member_id'))
console.log('[v0] Check link_status present:', content.includes('link_status'))
console.log('[v0] Check ClaimButton import:', content.includes('ClaimButton'))
