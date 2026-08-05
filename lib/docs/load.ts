import { promises as fs } from 'node:fs'
import path from 'node:path'

// Doc bodies are authored as markdown under content/docs/<category>/<slug>.md
// and read at build time (the /docs routes are statically generated, so the
// files are only needed during `next build`, never at runtime).
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'docs')

export async function loadDocContent(categoryId: string, slug: string): Promise<string | null> {
  const file = path.join(CONTENT_ROOT, categoryId, `${slug}.md`)
  try {
    const raw = await fs.readFile(file, 'utf8')
    return raw.trim().length > 0 ? raw : null
  } catch {
    return null
  }
}
