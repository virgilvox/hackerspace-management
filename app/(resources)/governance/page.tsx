import { IframeWrapper } from '@/components/resources/iframe-wrapper'

export const metadata = {
  title: 'Governance in a Box — hackerspace.sh',
}

export default function GovernancePage() {
  return (
    <IframeWrapper
      url="https://hackerspaceinabox.netlify.app/"
      title="Governance in a Box"
    />
  )
}
