// The hackerspace.sh brand mark: a minimal terminal prompt glyph (a chevron
// and an underscore). Inherits the surrounding text color via currentColor,
// so it picks up the lime accent wherever it sits on the dark sidebar.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
