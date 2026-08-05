import type { Metadata } from 'next'
import Link from 'next/link'
import { IBM_Plex_Mono, Libre_Baskerville } from 'next/font/google'
import { BrandMark } from '@/components/brand-mark'
import './docs.css'

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-libre-baskerville',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Docs — hackerspace.sh',
    template: '%s — hackerspace.sh docs',
  },
  description:
    'Documentation for hackerspace.sh: tutorials, how-to guides, reference, and explanation for running your space.',
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`docs-root ${ibmPlexMono.variable} ${libreBaskerville.variable}`}>
      <div className="docs-grid-bg" aria-hidden="true" />
      <header className="docs-header">
        <div className="docs-header-inner">
          <Link href="/docs" className="docs-wordmark" aria-label="hackerspace.sh docs">
            <BrandMark className="w-5 h-5" style={{ color: 'var(--doc-accent)' }} />
            <span>
              hackerspace<span className="doc-accent">.sh</span>{' '}
              <span style={{ color: 'var(--doc-text-muted)' }}>/ docs</span>
            </span>
          </Link>
          <nav className="docs-header-links">
            <Link href="/">Home</Link>
            <Link href="/resources" className="hidden sm:inline">Resources</Link>
            <Link href="/dashboard" className="docs-header-cta">Open app →</Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  )
}
