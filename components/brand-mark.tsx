import type { CSSProperties } from 'react'

// The hackerspace.sh brand mark: a minimal terminal prompt glyph (a chevron
// and an underscore). Inherits the surrounding text color via currentColor,
// or set an explicit color via `style`.
export function BrandMark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="hackerspace.sh"
    >
      <path d="M5 7l5 5-5 5" />
      <path d="M13 17h6" />
    </svg>
  )
}
