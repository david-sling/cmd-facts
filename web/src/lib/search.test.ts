import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { body, outline } from '#/lib/outline'
import { createSearch, marks } from '#/lib/search'
import type { Searchable } from '#/lib/search'

// the pages as the site loads them, read from disk: vitest does not compile MDX, and the search needs only the text
const root = fileURLToPath(new URL('../docs', import.meta.url))
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]))
const docs: Searchable[] = files(root)
  .filter((f) => f.endsWith('.mdx'))
  .map((file) => {
    const source = readFileSync(file, 'utf8')
    const field = (name: string) => new RegExp(`^${name}: (.+)$`, 'm').exec(source)![1]!.trim()
    const slug = relative(root, file).replace(/\.mdx$/, '').replace(/(^|\/)index$/, '')
    return { slug, href: slug ? `/docs/${slug}` : '/docs', title: field('title'), description: field('description'), ...outline(body(source)) }
  })
const search = createSearch(docs)

describe('docs search', () => {
  it('finds nothing for nothing', () => {
    expect(search('')).toEqual([])
    expect(search('   ')).toEqual([])
  })

  it('puts the page a word names first', () => {
    expect(search('fact fields')[0]!.doc.href).toBe('/docs/facts')
    expect(search('command line')[0]!.doc.href).toBe('/docs/react/command-line')
  })

  it('lands on the section that holds the words', () => {
    expect(search('ransom note')[0]).toMatchObject({ doc: { href: '/docs/react/examples' }, id: 'ransom-note' })
    // a match above a page's first heading links to the page itself
    for (const hit of search('renderValue'))
      if (hit.id) expect(docs.find((d) => d.href === hit.doc.href)!.sections.some((s) => s.id === hit.id)).toBe(true)
  })

  it('ranks prose above code that only repeats a name', () => {
    expect(search('badge')[0]!.snippet.toLowerCase()).not.toContain('import')
  })

  it('answers a page title with the page, not each of its sections', () => {
    const hits = search('quickstart')
    expect(hits[0]).toMatchObject({ doc: { href: '/docs/quickstart' }, id: undefined })
    expect(hits.filter((h) => h.doc.href === '/docs/quickstart' && h.id)).toEqual([])
  })

  it('joins words typed apart, so render value finds renderValue', () => {
    expect(search('render value', 3).some((h) => h.snippet.includes('renderValue'))).toBe(true)
  })

  it('reads code as well as prose', () => {
    expect(search('useExplain').some((h) => h.doc.href.startsWith('/docs/react'))).toBe(true)
  })

  it('wants every word', () => {
    for (const hit of search('reversible network')) {
      const text = `${hit.doc.title} ${hit.heading ?? ''} ${hit.snippet}`.toLowerCase()
      expect(text.includes('reversible') || text.includes('network'), hit.doc.href).toBe(true)
    }
    expect(search('reversible qwzxv')).toEqual([])
  })

  it('shows readable text, not markup', () => {
    for (const hit of search('install')) expect(hit.snippet, hit.doc.href).not.toMatch(/<\/?[A-Z]|\]\(|^#/)
  })

  it('marks the words it matched, whatever their case', () => {
    expect(marks('Run useExplain here', 'useexplain')).toEqual([
      { text: 'Run ', match: false },
      { text: 'useExplain', match: true },
      { text: ' here', match: false },
    ])
  })
})
