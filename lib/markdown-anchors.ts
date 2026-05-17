// Dependency-free heading anchors for the markdown renderers, so an
// in-document link like [Back to top](#overview) resolves to the matching
// heading. (We can't add rehype-slug as a dependency here.) Pure and
// unit-tested; no React/Next imports beyond the ReactNode type.

import type { ReactNode } from 'react'

// Flatten a React markdown heading's children to its plain text.
export function headingText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(headingText).join('')
  if (typeof node === 'object' && 'props' in (node as { props?: { children?: ReactNode } })) {
    return headingText((node as { props?: { children?: ReactNode } }).props?.children)
  }
  return ''
}

// GitHub-ish slug: lowercase, drop punctuation, spaces to hyphens. Matches
// what an author would naturally type as the link target.
export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Per-render slugger that de-duplicates repeated headings (foo, foo-1, ...)
// the same way GitHub does, so links stay unambiguous within one document.
export function makeHeadingSlugger(): (node: ReactNode) => string {
  const seen = new Map<string, number>()
  return (node: ReactNode) => {
    const base = slugifyHeading(headingText(node)) || 'section'
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  }
}

// True for an in-document target ("#section"): such a link must navigate in
// place, NOT open a new tab, or the anchor jump is lost.
export function isInDocumentHref(href: string | undefined): boolean {
  return typeof href === 'string' && href.startsWith('#')
}
