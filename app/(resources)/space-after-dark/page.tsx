import { IframeWrapper } from '@/components/resources/iframe-wrapper'

export const metadata = {
  title: 'The Space After Dark — hackerspace.sh',
}

export default function SpaceAfterDarkPage() {
  return (
    <IframeWrapper
      url="https://lumencanvas.nyc3.cdn.digitaloceanspaces.com/artifacts/hackerspace/space_dynamics.html"
      title="The Space After Dark"
    />
  )
}
