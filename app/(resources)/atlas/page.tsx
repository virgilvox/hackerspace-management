import { IframeWrapper } from '@/components/resources/iframe-wrapper'

export const metadata = {
  title: 'Hackerspace Atlas — hackerspace.sh',
}

export default function AtlasPage() {
  // atlas.html lives in /public, served by Next.js at the same path.
  return <IframeWrapper url="/atlas.html" title="Hackerspace Atlas" />
}
