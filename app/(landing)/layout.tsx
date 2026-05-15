import type { Metadata } from 'next'
import { IBM_Plex_Mono, Libre_Baskerville } from 'next/font/google'
import './landing.css'

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
  title: 'hackerspace.sh — Operational software for makerspaces',
  description:
    'Member management, dues tracking, task coordination, and project visibility. Built by people who have actually run these spaces.',
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`landing-root ${ibmPlexMono.variable} ${libreBaskerville.variable}`}>
      <div className="landing-grid-bg" aria-hidden="true" />
      {children}
    </div>
  )
}
