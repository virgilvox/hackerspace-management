'use client'

import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { makeHeadingSlugger, isInDocumentHref } from '@/lib/markdown-anchors'

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
  // Per-render so heading ids are stable and de-duplicated within this doc.
  const slug = makeHeadingSlugger()
  const heading = (Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') =>
    function H({ children: c }: { children?: ReactNode }) {
      return <Tag id={slug(c)}>{c}</Tag>
    }
  return (
    <div className={`prose prose-sm prose-neutral dark:prose-invert max-w-none break-words ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
          h1: heading('h1'),
          h2: heading('h2'),
          h3: heading('h3'),
          h4: heading('h4'),
          h5: heading('h5'),
          h6: heading('h6'),
          // In-document links (#section) must stay in the page so the anchor
          // jump works; everything else opens safely in a new tab.
          a: ({ href, children: c }) =>
            isInDocumentHref(href) ? (
              <a href={href}>{c}</a>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {c}
              </a>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
