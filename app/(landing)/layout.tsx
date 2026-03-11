import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'hackerspace.sh — Operational Software for Makerspaces',
  description: 'Member management, dues tracking, task coordination, and project visibility. Built by people who have actually run these spaces.',
}

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
