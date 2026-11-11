import type { ComponentType } from 'react'
import type { MDXComponents } from 'mdx/types'
import { body, outline } from '#/lib/outline'
import type { Heading, Section } from '#/lib/outline'

export { REPO_URL } from '#/site'
export type { Heading, Section } from '#/lib/outline'

type Frontmatter = { title: string; description: string }
type Module = { default: ComponentType<{ components?: MDXComponents }>; frontmatter: Frontmatter }

export type Doc = Frontmatter & {
  slug: string
  href: string
  Content: Module['default']
  markdown: string
  headings: Heading[]
  sections: Section[]
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
        ...outline(content),
      },
    ]
  }),
)

export const ORDER = SECTIONS.flatMap((s) => s.pages).filter((slug) => DOCS.has(slug))

/** Every page the sidebar reaches, in its order. */
export function allDocs() {
  return ORDER.map((slug) => DOCS.get(slug)!)
}

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
