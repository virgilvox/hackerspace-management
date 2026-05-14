import type { SVGProps } from 'react'

export function AtlasLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="60 -5 280 350"
      role="img"
      aria-label="Hackerspace Atlas logo"
      {...props}
    >
      {/* Globe outer */}
      <circle cx="200" cy="185" r="115" stroke="currentColor" fill="none" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      {/* Meridians */}
      <ellipse cx="200" cy="185" rx="45" ry="115" stroke="currentColor" fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="200" cy="185" rx="85" ry="115" stroke="currentColor" fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      {/* Equator */}
      <line x1="85" y1="185" x2="315" y2="185" stroke="currentColor" fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      {/* Latitude rings */}
      <ellipse cx="200" cy="133" rx="100" ry="28" stroke="currentColor" fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="200" cy="237" rx="100" ry="28" stroke="currentColor" fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      {/* Vias at intersections */}
      <g fill="currentColor" stroke="none">
        <circle cx="85" cy="185" r="9" /><circle cx="85" cy="185" r="3.5" fill="#0c0c0c" />
        <circle cx="115" cy="185" r="7" /><circle cx="115" cy="185" r="2.5" fill="#0c0c0c" />
        <circle cx="155" cy="185" r="7" /><circle cx="155" cy="185" r="2.5" fill="#0c0c0c" />
        <circle cx="245" cy="185" r="7" /><circle cx="245" cy="185" r="2.5" fill="#0c0c0c" />
        <circle cx="285" cy="185" r="7" /><circle cx="285" cy="185" r="2.5" fill="#0c0c0c" />
        <circle cx="315" cy="185" r="9" /><circle cx="315" cy="185" r="3.5" fill="#0c0c0c" />
        <circle cx="200" cy="70" r="8" /><circle cx="200" cy="70" r="3" fill="#0c0c0c" />
        <circle cx="200" cy="300" r="8" /><circle cx="200" cy="300" r="3" fill="#0c0c0c" />
      </g>
      {/* Hackerspace markers */}
      <g>
        <circle cx="145" cy="160" r="11" fill="currentColor" />
        <circle cx="145" cy="160" r="4.5" fill="#0c0c0c" />
        <circle cx="145" cy="160" r="16" stroke="currentColor" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g>
        <circle cx="260" cy="205" r="10" fill="currentColor" />
        <circle cx="260" cy="205" r="4" fill="#0c0c0c" />
        <circle cx="260" cy="205" r="15" stroke="currentColor" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g>
        <circle cx="170" cy="255" r="9" fill="currentColor" />
        <circle cx="170" cy="255" r="3.5" fill="#0c0c0c" />
        <circle cx="170" cy="255" r="14" stroke="currentColor" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* Soldering iron compass needle */}
      <g>
        <line x1="200" y1="75" x2="200" y2="285" stroke="currentColor" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M200 28 L186 82 L200 98 L214 82 Z" fill="currentColor" />
        <rect x="192" y="96" width="16" height="12" rx="2" fill="currentColor" />
        <rect x="186" y="258" width="28" height="55" rx="6" fill="currentColor" />
        <line x1="189" y1="272" x2="211" y2="272" stroke="#0c0c0c" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <line x1="189" y1="286" x2="211" y2="286" stroke="#0c0c0c" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <line x1="189" y1="300" x2="211" y2="300" stroke="#0c0c0c" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <rect x="190" y="310" width="20" height="12" rx="4" fill="currentColor" />
        <path d="M200 335 L212 295 L200 278 L188 295 Z" fill="currentColor" opacity={0.9} />
        <g stroke="currentColor" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8}>
          <path d="M184 28 Q174 14 184 4" />
          <path d="M216 28 Q226 14 216 4" />
          <path d="M200 22 Q200 12 200 2" />
        </g>
      </g>
      {/* East/west pointers */}
      <path d="M330 185 L290 170 L275 185 L290 200 Z" fill="currentColor" opacity={0.9} />
      <path d="M70 185 L110 200 L125 185 L110 170 Z" fill="currentColor" opacity={0.9} />
      {/* Center hub */}
      <circle cx="200" cy="185" r="18" fill="currentColor" />
      <circle cx="200" cy="185" r="7" fill="#d4ff00" />
    </svg>
  )
}
