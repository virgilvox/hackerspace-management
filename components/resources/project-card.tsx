import Link from 'next/link'
import type { ReactNode } from 'react'

type CommonProps = {
  num: string
  title: string
  description: string
  type: string
  featured?: boolean
  visual?: ReactNode
}

type InternalProps = CommonProps & { to: string; href?: never; external?: false }
type ExternalProps = CommonProps & { href: string; to?: never; external?: true }
type Props = InternalProps | ExternalProps

/**
 * Project card on /resources. Behaves as either an internal next/link
 * (when `to` is set) or an external anchor with target=_blank (when
 * `href` is set). Featured cards span full width with the visual on the
 * right; non-featured render with a small icon in the top-right corner.
 */
export function ProjectCard(props: Props) {
  const { num, title, description, type, featured = false, visual } = props
  const hasIcon = visual && !featured

  const body = (
    <>
      {hasIcon && <span className="resources-card-icon">{visual}</span>}
      <div className="resources-card-content">
        <span className="resources-card-num">{num}</span>
        <h2 className="resources-card-title">{title}</h2>
        <p className="resources-card-desc">{description}</p>
        <div className="resources-card-footer">
          <span className="resources-card-type">{type}</span>
          <span className="resources-card-arrow">
            {'external' in props && props.external ? (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M4 12L12 4M12 4H6M12 4v6" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            )}
          </span>
        </div>
      </div>
      {featured && visual && <div className="resources-card-visual">{visual}</div>}
    </>
  )

  const className = `resources-card${featured ? ' resources-card-featured' : ''}${hasIcon ? ' resources-card-has-icon' : ''}`

  if ('to' in props && props.to) {
    return (
      <Link href={props.to} className={className}>
        {body}
      </Link>
    )
  }
  return (
    <a href={(props as ExternalProps).href} className={className} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  )
}
