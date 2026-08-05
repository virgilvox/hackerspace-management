'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DOC_CATEGORIES } from '@/lib/docs/nav'

export function DocsSidebar() {
  const pathname = usePathname()

  return (
    <aside className="docs-sidebar" aria-label="Docs navigation">
      {DOC_CATEGORIES.map(cat => (
        <div key={cat.id} className="docs-sidebar-group">
          <p className="docs-sidebar-group-label">{cat.label}</p>
          {cat.pages.map(page => {
            const href = `/docs/${cat.id}/${page.slug}`
            const isActive = pathname === href
            return (
              <Link
                key={page.slug}
                href={href}
                className={`docs-sidebar-link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {page.title}
              </Link>
            )
          })}
        </div>
      ))}
    </aside>
  )
}
