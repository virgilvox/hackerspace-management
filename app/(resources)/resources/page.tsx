import Link from 'next/link'
import { ProjectCard } from '@/components/resources/project-card'
import {
  Wordmark,
  PromptIcon,
  SpaceIcon,
  TraceIcon,
  CubeIcon,
  KeyIcon,
  GridIcon,
} from '@/components/resources/icons'
import { AtlasLogo } from '@/components/resources/atlas-logo'

export const metadata = {
  title: 'hackerspace.sh — projects',
  description:
    'How hackerspaces actually work: research, governance frameworks, games, and a global atlas of community workshops.',
}

export default function ResourcesLandingPage() {
  return (
    <>
      <header>
        <div className="resources-container">
          <div className="resources-header-inner">
            <Link href="/resources" className="resources-site-title" aria-label="hackerspace.sh">
              <Wordmark />
            </Link>
            <nav className="resources-header-links">
              <a href="https://github.com/virgilvox">GitHub</a>
              <a href="https://hackster.io/virgilvox">Hackster</a>
              <Link href="/" className="resources-header-link-accent">
                Manage your space →
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main>
        <div className="resources-container">
          <section className="resources-hero">
            <div className="resources-hero-content">
              <h1 className="resources-hero-title">
                How <em>hackerspaces</em> actually work
              </h1>
              <PromptIcon className="resources-hero-prompt" />
            </div>
            <p className="resources-hero-sub">
              The dynamics, the drama, the governance patterns that make or break community
              workshops. Research turned into tools you can use.
            </p>
          </section>

          <section>
            <div className="resources-section-header">
              <span className="resources-section-label">Projects</span>
              <span className="resources-section-count">07 tools</span>
            </div>

            <div className="resources-projects">
              <ProjectCard
                to="/atlas"
                num="01"
                title="Hackerspace Atlas"
                description="An interactive map of hackerspaces around the world. Find active spaces, discover closed ones, and explore the global maker community network."
                type="Map · Global"
                featured
                visual={<AtlasLogo />}
              />

              <ProjectCard
                to="/space-after-dark"
                num="02"
                title="The Space After Dark"
                description="An isometric exploration game set in a hackerspace at night. Talk to the regulars — each one an archetype you'll recognize."
                type="Game · 6 characters"
                visual={<CubeIcon />}
              />

              <ProjectCard
                to="/proposal-duel"
                num="03"
                title="Proposal Duel"
                description="Fallout-style dialogue combat for hackerspace governance. You have a proposal. Someone opposes it. Survive the meeting."
                type="Game · 5 opponents"
                visual={<TraceIcon />}
              />

              <ProjectCard
                to="/zine"
                num="04"
                title="The Hackerspace Game"
                description="A printable zine covering archetypes, trust dynamics, and the lifecycle of community spaces. Based on research from HeatSync Labs, Noisebridge, Hackerspace Gent, and years of watching spaces rise and fall."
                type="Zine · 12 pages"
                visual={<SpaceIcon />}
              />

              <ProjectCard
                href="https://hackerspacegame.netlify.app/"
                external
                num="05"
                title="Interactive Learner"
                description="Nicky Case-style simulations for hackerspace dynamics. Tweak member ratios, watch trust networks form and collapse, run governance scenarios."
                type="Web App · 8 chapters"
                visual={<GridIcon />}
              />

              <ProjectCard
                to="/governance"
                num="06"
                title="Governance in a Box"
                description="Templates and frameworks for running a hackerspace. Do-ocracy guidelines, conflict resolution, burnout prevention, succession planning. Fork it and make it yours."
                type="Resource Kit"
                featured
                visual={<KeyIcon />}
              />

              <ProjectCard
                href="https://hack.build/hacking-your-hackerspace.html"
                external
                num="07"
                title="Hacking Your Hackerspace"
                description="A talk on the patterns, pitfalls, and governance lessons behind keeping a hackerspace alive — the research from these projects, condensed into one interactive session."
                type="Talk · Interactive"
                visual={<img src="/hackbuild-mark.png" alt="" />}
              />
            </div>
          </section>

          <section className="resources-author">
            <div className="resources-author-content">
              <span className="resources-author-label">Made by</span>
              <h2 className="resources-author-name">Moheeb Zara</h2>
              <p className="resources-author-bio">
                Hardware hacker, new media artist, maker community advocate
              </p>
            </div>
            <a href="https://hack.build" className="resources-author-link">
              hack.build
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M4 12L12 4M12 4H6M12 4v6" />
              </svg>
            </a>
          </section>
        </div>
      </main>

      <footer>
        <div className="resources-container resources-footer-inner">
          <p>
            A project from{' '}
            <a href="https://heatsynclabs.org">HeatSync Labs</a>. Run your own space?{' '}
            <Link href="/">Manage it here →</Link>
          </p>
          <nav className="resources-footer-links">
            <a href="https://github.com/virgilvox">Source</a>
          </nav>
        </div>
      </footer>
    </>
  )
}
