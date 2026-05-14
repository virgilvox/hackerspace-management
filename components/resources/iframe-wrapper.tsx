import Link from 'next/link'
import { Wordmark } from './icons'

/**
 * Renders an iframe at full-viewport size with a thin top bar that links
 * back to /resources and labels the embedded content. Used by /zine,
 * /governance, /space-after-dark, /proposal-duel, and /atlas.
 */
export function IframeWrapper({ url, title }: { url: string; title: string }) {
  return (
    <div className="resources-iframe-wrapper">
      <div className="resources-iframe-topbar">
        <Link href="/resources" className="resources-iframe-back">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M10 4L6 8l4 4" />
          </svg>
          <Wordmark />
        </Link>
        <span className="resources-iframe-title">{title}</span>
      </div>
      <iframe src={url} className="resources-iframe-frame" title={title} />
    </div>
  )
}
