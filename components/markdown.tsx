import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Server-renderable markdown component for governance text (proposals,
 * incidents, policies). Renders bold, italic, lists, links, code, tables,
 * strikethrough, and autolinks via GFM. All HTML is escaped by react-markdown
 * by default; we never pass `rehypeRaw` so embedded `<script>` tags or
 * arbitrary HTML in user input are inert.
 *
 * `content` is treated as untrusted member input.
 */
export function MarkdownBody({ content, className = '' }: { content: string | null | undefined; className?: string }) {
  if (!content || content.trim().length === 0) {
    return null
  }

  return (
    <div className={`markdown-body font-sans text-sm text-foreground/90 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-semibold text-foreground mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold text-foreground mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-foreground mt-3 mb-1">{children}</h3>,
          p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-outside pl-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside pl-5 my-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted border border-border rounded p-3 my-2 overflow-x-auto font-mono text-xs">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 bg-muted text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
          hr: () => <hr className="my-4 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
