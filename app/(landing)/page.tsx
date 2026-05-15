import Link from 'next/link'
import { BrandMark } from '@/components/brand-mark'
import { GithubIcon, ArrowIcon } from '@/components/landing/icons'
import { ResourceShowcase } from '@/components/landing/resource-showcase'
import { HeroPreviewCluster } from '@/components/landing/mini-previews'

const MODULES = [
  { num: '01', title: 'Members', desc: 'Tiers, dues status, contact info, custom roles. Know who is current and who is not, at a glance.' },
  { num: '02', title: 'Tasks and chores', desc: 'One-off and recurring work with assignments, due dates, and area tags. Claim and complete from anywhere.' },
  { num: '03', title: 'Projects', desc: 'A board for what the space is building. Progress, areas, and who is on it, visible to everyone.' },
  { num: '04', title: 'Payments', desc: 'Import from PayPal, Venmo, or Zeffy. Reconcile transactions to members by hand or by email match.' },
  { num: '05', title: 'Ops and knowledge', desc: 'Procedures, area leads, and an encrypted secrets vault. Role-gated, revealed on demand.' },
  { num: '06', title: 'Governance', desc: 'Proposals with quorum and voting, incident reports, a versioned policy library, and a member forum.' },
]

const STEPS = [
  { num: '01', title: 'Import your members', desc: 'Paste from a spreadsheet or add them one by one. Set tiers, statuses, and contact info.' },
  { num: '02', title: 'Connect payments', desc: 'Link PayPal or Zeffy, import transactions, and match them to members.' },
  { num: '03', title: 'Seed your ops docs', desc: 'Drop in SOPs, credentials, and area leads. The whole board has one place to look things up.' },
]

export default function LandingPage() {
  return (
    <>
      <nav className="landing-nav">
        <div className="landing-container landing-nav-inner">
          <Link href="/" className="landing-wordmark" aria-label="hackerspace.sh">
            <BrandMark className="w-5 h-5" style={{ color: 'var(--ln-accent)' }} />
            <span>hackerspace<span style={{ color: 'var(--ln-accent)' }}>.sh</span></span>
          </Link>
          <div className="landing-nav-links">
            <Link href="/resources" className="hidden sm:inline">Resources</Link>
            <a
              href="https://github.com/virgilvox/hackerspace-management"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View source on GitHub"
              className="inline-flex"
            >
              <GithubIcon className="w-[18px] h-[18px]" />
            </a>
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="landing-btn-accent">Get started</Link>
          </div>
        </div>
      </nav>

      <header className="landing-hero">
        <div className="landing-container landing-hero-grid">
          <div>
            <p className="landing-eyebrow">Operating system for hackerspaces</p>
            <h1 className="landing-display">
              Run your <em>space</em>, not a spreadsheet
            </h1>
            <p className="landing-lede">
              Members, dues, tasks, projects, ops docs, and governance in one
              place. Built by people who have actually run these spaces, for the
              people who keep them running.
            </p>
            <div className="landing-cta-row">
              <Link href="/signup" className="landing-btn-accent">
                Get started <ArrowIcon className="w-3.5 h-3.5" />
              </Link>
              <Link href="/login" className="landing-btn">Log in</Link>
            </div>
          </div>
          <div className="landing-hero-visual">
            <div className="landing-preview-frame">
              <div className="landing-preview-chrome" aria-hidden="true">
                <span /><span /><span />
              </div>
              <HeroPreviewCluster />
            </div>
          </div>
        </div>
      </header>

      <section className="landing-section">
        <div className="landing-container">
          <div className="landing-section-head">
            <span className="landing-section-label">What it does</span>
            <span className="landing-section-note">06 modules</span>
          </div>
          <div className="landing-grid">
            {MODULES.map(m => (
              <div key={m.num} className="landing-card">
                <span className="landing-card-num">{m.num}</span>
                <h2 className="landing-card-title">{m.title}</h2>
                <p className="landing-card-desc">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <div className="landing-section-head">
            <span className="landing-section-label">Setup</span>
            <span className="landing-section-note">under an hour</span>
          </div>
          <div className="landing-steps">
            {STEPS.map(s => (
              <div key={s.num}>
                <p className="landing-step-num">{s.num}</p>
                <h3 className="landing-step-title">{s.title}</h3>
                <p className="landing-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ResourceShowcase />

      <section className="landing-cta">
        <div className="landing-container">
          <h2 className="landing-cta-title">Stop running your space from memory.</h2>
          <div className="landing-cta-row">
            <Link href="/signup" className="landing-btn-accent">
              Get started <ArrowIcon className="w-3.5 h-3.5" />
            </Link>
            <Link href="/login" className="landing-btn">Log in</Link>
          </div>
          <p className="landing-cta-foot">
            Not running a space? Read the{' '}
            <Link href="/resources">hackerspace research and games</Link>.
          </p>
        </div>
      </section>

      <footer>
        <div className="landing-container landing-foot-inner">
          <div className="flex items-center gap-2">
            <BrandMark className="w-4 h-4" style={{ color: 'var(--ln-accent)' }} />
            <span>hackerspace.sh</span>
          </div>
          <a
            href="https://github.com/virgilvox/hackerspace-management"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            source
          </a>
        </div>
      </footer>
    </>
  )
}
