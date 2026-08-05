import Link from 'next/link'
import { DOC_CATEGORIES } from '@/lib/docs/nav'

export const metadata = {
  title: 'Docs',
  description:
    'Everything you need to run your space with hackerspace.sh — organized as tutorials, how-to guides, reference, and explanation.',
}

export default function DocsHomePage() {
  return (
    <main className="docs-shell" style={{ gridTemplateColumns: '1fr' }}>
      <div className="docs-content" style={{ padding: 0 }}>
        <section className="docs-home-hero">
          <p className="docs-eyebrow">Documentation</p>
          <h1 className="docs-home-title">
            Run your space, <em>documented</em>
          </h1>
          <p className="docs-home-lede">
            Everything hackerspace.sh does, written down. Organized the{' '}
            <a
              href="https://diataxis.fr"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--doc-accent)', textDecoration: 'underline' }}
            >
              Diátaxis
            </a>{' '}
            way: learn with tutorials, get things done with how-to guides, look up the
            details in reference, and understand the why in explanation.
          </p>
        </section>

        <div className="docs-cat-grid">
          {DOC_CATEGORIES.map(cat => (
            <section key={cat.id} className="docs-cat-card">
              <p className="docs-cat-eyebrow">{cat.tagline}</p>
              <h2 className="docs-cat-title">{cat.label}</h2>
              <p className="docs-cat-diataxis">{cat.diataxis}</p>
              <div className="docs-cat-list">
                {cat.pages.map(page => (
                  <Link key={page.slug} href={`/docs/${cat.id}/${page.slug}`}>
                    {page.title}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
