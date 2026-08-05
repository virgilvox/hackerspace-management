import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DOC_CATEGORIES, findPage, flatPages } from '@/lib/docs/nav'
import { loadDocContent } from '@/lib/docs/load'
import { DocsMarkdown } from '@/components/docs/docs-markdown'
import { DocsSidebar } from '@/components/docs/docs-sidebar'

export function generateStaticParams() {
  return DOC_CATEGORIES.flatMap(cat =>
    cat.pages.map(page => ({ category: cat.id, slug: page.slug })),
  )
}

export const dynamicParams = false

type Params = { category: string; slug: string }

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { category, slug } = await params
  const found = findPage(category, slug)
  if (!found) return {}
  return { title: found.page.title, description: found.page.summary }
}

export default async function DocPage({ params }: { params: Promise<Params> }) {
  const { category, slug } = await params
  const found = findPage(category, slug)
  if (!found) notFound()
  const { category: cat, page } = found

  const content = await loadDocContent(cat.id, page.slug)

  const flat = flatPages()
  const idx = flat.findIndex(p => p.categoryId === cat.id && p.slug === page.slug)
  const prev = idx > 0 ? flat[idx - 1] : null
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null

  return (
    <main className="docs-shell">
      <DocsSidebar />
      <article className="docs-content">
        <nav className="docs-breadcrumb" aria-label="Breadcrumb">
          <Link href="/docs">Docs</Link>
          <span>/</span>
          <span>{cat.label}</span>
        </nav>

        <header className="docs-page-head">
          <p className="docs-eyebrow">{cat.label}</p>
          <h1 className="docs-page-title">{page.title}</h1>
          <p className="docs-page-summary">{page.summary}</p>
        </header>
        <hr className="docs-rule" />

        {content ? (
          <DocsMarkdown content={content} />
        ) : (
          <div className="docs-prose">
            <p style={{ color: 'var(--doc-text-muted)' }}>
              This page is being written. Check back shortly.
            </p>
          </div>
        )}

        <nav className="docs-pager" aria-label="Pagination">
          {prev ? (
            <Link href={`/docs/${prev.categoryId}/${prev.slug}`} className="docs-pager-prev">
              <span className="docs-pager-dir">← Previous</span>
              <span className="docs-pager-title">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/docs/${next.categoryId}/${next.slug}`} className="docs-pager-next">
              <span className="docs-pager-dir">Next →</span>
              <span className="docs-pager-title">{next.title}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
    </main>
  )
}
