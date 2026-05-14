// Iconography ported from the original hackerspace-sh Vue subsite.
// All SVGs render with `currentColor` so they inherit the surrounding
// text colour and can be tinted by parent styles. The lime accent
// (#d4ff00) is hardcoded where the original components used it.

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

export function Wordmark(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 48"
      className="wordmark"
      {...props}
    >
      <text
        x="0"
        y="34"
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="28"
        fontWeight="500"
        fill="currentColor"
        letterSpacing="-1"
      >
        hackerspace
        <tspan fill="#d4ff00">.sh</tspan>
      </text>
    </svg>
  )
}

export function SpaceIcon(props: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" {...props}>
      <path d="M6 6 L6 30 L18 30 L18 18 L30 18 L30 6 Z" fill="currentColor" />
      <path d="M18 18 L18 42 L42 42 L42 18 Z" fill="none" stroke="currentColor" strokeWidth={2.5} />
      <circle cx="30" cy="30" r="5" fill="#d4ff00" />
    </svg>
  )
}

export function TraceIcon(props: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" {...props}>
      <path
        d="M8 8 L8 24 L24 24 L24 40 L40 40"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinecap="square"
      />
      <circle cx="8" cy="8" r="5" fill="currentColor" />
      <circle cx="24" cy="24" r="5" fill="currentColor" />
      <circle cx="40" cy="40" r="6" fill="#d4ff00" />
    </svg>
  )
}

export function CubeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <path d="M24 4 L44 16 L44 36 L24 48 L4 36 L4 16 Z" stroke="currentColor" strokeWidth={2.5} />
      <path d="M24 4 L24 24 M4 16 L24 24 L44 16" stroke="currentColor" strokeWidth={2.5} />
      <path d="M24 24 L24 48" stroke="#d4ff00" strokeWidth={2.5} />
    </svg>
  )
}

export function KeyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth={3} />
      <path d="M22 22 L42 42" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
      <path d="M34 34 L40 28" stroke="#d4ff00" strokeWidth={4} strokeLinecap="round" />
      <path d="M38 38 L44 32" stroke="#d4ff00" strokeWidth={4} strokeLinecap="round" />
    </svg>
  )
}

export function GridIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <rect x="6" y="6" width="16" height="16" fill="currentColor" />
      <rect x="26" y="6" width="16" height="16" fill="currentColor" opacity={0.5} />
      <rect x="6" y="26" width="16" height="16" fill="currentColor" opacity={0.5} />
      <rect x="26" y="26" width="16" height="16" fill="#d4ff00" />
    </svg>
  )
}

export function PromptIcon(props: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" {...props}>
      <path
        d="M8 12 L24 24 L8 36"
        fill="none"
        stroke="#d4ff00"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28 36 L40 36"
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
      />
    </svg>
  )
}
