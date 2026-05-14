import type { Metadata } from 'next'
import { IBM_Plex_Mono, Libre_Baskerville } from 'next/font/google'
import './resources.css'

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
  title: 'hackerspace.sh',
  description:
    'How hackerspaces actually work. Research, tools, and games for community workshop governance.',
}

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`resources-root ${ibmPlexMono.variable} ${libreBaskerville.variable}`}>
      <div className="resources-grid-bg" aria-hidden="true" />
      {children}
    </div>
  )
}
