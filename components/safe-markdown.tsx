'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

// Renders admin-authored markdown that MAY contain a constrained subset of raw
// HTML. rehype-raw parses the HTML; rehype-sanitize then strips anything
// dangerous. The author is a space admin/board member, but a stored-XSS or
// UI-redress payload would still run in other members' sessions within that
// tenant, so this is sanitized hard, not trusted:
//   - no `iframe` (no unsandboxed third-party embeds / token theft frame)
//   - no global `style` attribute (no full-viewport overlay redress)
//   - links forced to safe protocols; rel/target locked down
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className'],
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['https', 'http', 'mailto'],
  },
}

export function SafeMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`prose prose-sm prose-neutral dark:prose-invert max-w-none break-words ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
