import { IframeWrapper } from '@/components/resources/iframe-wrapper'

export const metadata = {
  title: 'The Hackerspace Game — hackerspace.sh',
}

export default function ZinePage() {
  return (
    <IframeWrapper
      url="https://lumencanvas.nyc3.cdn.digitaloceanspaces.com/artifacts/hackerspace-zine.html"
      title="The Hackerspace Game"
    />
  )
}
