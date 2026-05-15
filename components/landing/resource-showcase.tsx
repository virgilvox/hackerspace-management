import Link from 'next/link'
import { AtlasLogo } from '@/components/resources/atlas-logo'
import { CubeIcon, TraceIcon, SpaceIcon, GridIcon, KeyIcon } from '@/components/resources/icons'

// The six hackerspace.sh research/game projects, shown as a single row of
// square tiles at the foot of the landing page. Internal routes use next/link;
// the interactive learner is an external app.
const RESOURCES = [
  { title: 'Atlas', href: '/atlas', external: false, visual: <AtlasLogo /> },
  { title: 'Space After Dark', href: '/space-after-dark', external: false, visual: <CubeIcon /> },
  { title: 'Proposal Duel', href: '/proposal-duel', external: false, visual: <TraceIcon /> },
  { title: 'The Hackerspace Game', href: '/zine', external: false, visual: <SpaceIcon /> },
  { title: 'Interactive Learner', href: 'https://hackerspacegame.netlify.app/', external: true, visual: <GridIcon /> },
  { title: 'Governance in a Box', href: '/governance', external: false, visual: <KeyIcon /> },
]

export function ResourceShowcase() {
  return (
    <section className="landing-section">
      <div className="landing-container">
        <div className="landing-section-head">
          <span className="landing-section-label">From hackerspace.sh</span>
          <span className="landing-section-note">06 projects</span>
        </div>
        <div className="landing-showcase">
          {RESOURCES.map(r =>
            r.external ? (
              <a key={r.title} href={r.href} target="_blank" rel="noopener noreferrer" className="landing-tile">
                <span className="landing-tile-visual">{r.visual}</span>
                <span className="landing-tile-title">{r.title}</span>
              </a>
            ) : (
              <Link key={r.title} href={r.href} className="landing-tile">
                <span className="landing-tile-visual">{r.visual}</span>
                <span className="landing-tile-title">{r.title}</span>
              </Link>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
