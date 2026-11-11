import type { ComponentType } from 'react'
import type { MDXComponents } from 'mdx/types'
import GithubSlugger from 'github-slugger'

import { openInV0Url } from '#/site'

export { REPO_URL } from '#/site'

type Frontmatter = { title: string; description: string }
type Module = { default: ComponentType<{ components?: MDXComponents }>; frontmatter: Frontmatter }

export type Heading = { depth: 2 | 3; text: string; id: string }
export type Doc = Frontmatter & {
  slug: string
  href: string
  Content: Module['default']
  markdown: string
  headings: Heading[]
}

/** The order of the sidebar, and with it the order the pager walks. A page not named here is unreachable. */
export const SECTIONS: Array<{ title: string; pages: string[] }> = [
  { title: 'Start here', pages: ['', 'quickstart'] },
  { title: 'Reading an answer', pages: ['explanation', 'facts', 'sentence', 'lines'] },
  { title: 'React', pages: ['react', 'react/sentence', 'react/command-line', 'react/styling', 'react/examples'] },
  { title: 'Packs', pages: ['packs/using', 'packs/writing'] },
  { title: 'Reference', pages: ['reference/api', 'reference/limits'] },
]

const modules = import.meta.glob<Module>('../docs/**/*.mdx', { eager: true })
const sources = import.meta.glob<string>('../docs/**/*.mdx', { eager: true, query: '?raw', import: 'default' })

const slugOf = (path: string) => path.replace(/^\.\.\/docs\//, '').replace(/\.mdx$/, '').replace(/(^|\/)index$/, '')

// A pasted page has no buttons: each one becomes the link it opens.
const V0 = /^<OpenInV0 items="([^"]+)" \/>$/gm
// …and no tabs: an example is its code, followed by the link that opens it.
const PREVIEW = /^<ComponentPreview name="([^"]+)">\n\n([\s\S]*?)\n\n<\/ComponentPreview>$/gm

function body(source: string) {
  return source
    .replace(/^---\n[\s\S]*?\n---\n+/, '')
    .replace(PREVIEW, (_, name: string, code: string) => `${code}\n\n[Open ${name} in v0](${openInV0Url(name)})`)
    .replace(V0, (_, items: string) =>
      items
        .split(/\s+/)
        .map((name) => `[Open ${name} in v0](${openInV0Url(name)})`)
        .join(' · '),
    )
    .trim()
}

function plain(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .trim()
}

/** The same ids rehype-slug puts on the headings, so the contents rail can link to them without reading the DOM. */
function headingsOf(md: string): Heading[] {
  const slugger = new GithubSlugger()
  const out: Heading[] = []
  let fenced = false
  for (const line of md.split('\n')) {
    if (/^(```|~~~)/.test(line)) fenced = !fenced
    const m = !fenced && /^(#{1,6})\s+(.+?)\s*#*$/.exec(line)
    if (!m) continue
    const text = plain(m[2])
    const id = slugger.slug(text)
    const depth = m[1].length
    if (depth === 2 || depth === 3) out.push({ depth, text, id })
  }
  return out
}

const DOCS = new Map<string, Doc>(
  Object.entries(modules).map(([path, mod]) => {
    const slug = slugOf(path)
    const content = body(sources[path])
    const { title, description } = mod.frontmatter
    return [
      slug,
      {
        slug,
        href: slug ? `/docs/${slug}` : '/docs',
        title,
        description,
        Content: mod.default,
        // what Copy as Markdown hands over: the page as it was written, with its title and lead back on top
        markdown: `# ${title}\n\n> ${description}\n\n${content}\n`,
        headings: headingsOf(content),
      },
    ]
  }),
)

export const ORDER = SECTIONS.flatMap((s) => s.pages).filter((slug) => DOCS.has(slug))

export function getDoc(slug: string) {
  return DOCS.get(slug.replace(/\/+$/, ''))
}

export function neighbours(slug: string) {
  const i = ORDER.indexOf(slug)
  return { prev: i > 0 ? DOCS.get(ORDER[i - 1]) : undefined, next: i >= 0 ? DOCS.get(ORDER[i + 1]) : undefined }
}

/** A pasted page is read somewhere else, where a link starting at `/` points at nothing. */
export function absolutise(markdown: string, origin: string) {
  return markdown.replace(/\]\((\/[^)]*)\)/g, `](${origin}$1)`)
}
