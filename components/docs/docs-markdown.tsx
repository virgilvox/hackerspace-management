import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { makeHeadingSlugger, isInDocumentHref } from '@/lib/markdown-anchors'

// Docs-brand markdown renderer. Unlike components/markdown.tsx (which is bound
// to the management app's theme tokens), this emits headings with stable anchor
// ids and otherwise leans on the `.docs-prose` stylesheet in docs.css so the
// output matches the public site's dark / monospace / lime aesthetic.
//
// Content here is author-trusted (checked-in .md), but we still never enable
// rehypeRaw, so any stray HTML stays inert.
export function DocsMarkdown({ content }: { content: string }) {
  const slug = makeHeadingSlugger()

  return (
    <div className="docs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 id={slug(children)}>{children}</h1>,
          h2: ({ children }) => <h2 id={slug(children)}>{children}</h2>,
          h3: ({ children }) => <h3 id={slug(children)}>{children}</h3>,
          h4: ({ children }) => <h4 id={slug(children)}>{children}</h4>,
          // Render images as captioned figures. Uses spans (valid inside the
          // <p> react-markdown wraps a lone image in) styled as blocks; the alt
          // text doubles as the caption.
          img: ({ src, alt }) =>
            typeof src === 'string' ? (
              <span className="docs-figure">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={alt ?? ''} loading="lazy" />
                {alt ? <span className="docs-figcaption">{alt}</span> : null}
              </span>
            ) : null,
          a: ({ href, children }) =>
            isInDocumentHref(href) ? (
              <a href={href}>{children}</a>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
