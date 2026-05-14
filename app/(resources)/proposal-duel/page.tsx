import { IframeWrapper } from '@/components/resources/iframe-wrapper'

export const metadata = {
  title: 'Proposal Duel — hackerspace.sh',
}

export default function ProposalDuelPage() {
  return (
    <IframeWrapper
      url="https://lumencanvas.nyc3.cdn.digitaloceanspaces.com/artifacts/hackerspace/proposal-duel.html"
      title="Proposal Duel"
    />
  )
}
