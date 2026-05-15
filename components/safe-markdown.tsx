'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

// Renders admin-authored markdown that MAY contain a constrained subset of raw
// HTML. rehype-raw parses the HTML; rehype-sanitize then strips anything
// dangerous (script, event handlers, javascript: URLs, etc). The author is a
// space admin/board member, but a stored-XSS payload would still run in other
// members' sessions within that tenant, so this is sanitized, not trusted.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'style'],
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'iframe',
  ],
  // Allow only video embeds from well-known hosts; everything else dropped.
  protocols: {
    ...defaultSchema.protocols,
    src: ['https'],
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
