import type { Doc } from '#/lib/docs'

/** What the search reads of a page. */
export type Searchable = Pick<Doc, 'slug' | 'href' | 'title' | 'description' | 'sections'>

/** One place a query was found: a page, or a section of one, with the words around the first match. */
export type Hit = {
  doc: Pick<Doc, 'slug' | 'href' | 'title'>
  heading?: string
  /** The heading's id, for a link that lands on it. */
  id?: string
  snippet: string
  score: number
}

const termsOf = (query: string) =>
  query
    .toLowerCase()
    .split(/[^\p{L}\p{N}_.@/-]+/u)
    .map((t) => t.replace(/^[.@/-]+|[.@/-]+$/g, ''))
    .filter(Boolean)

/** How a field holds a term: 3 as a whole word, 2 as the start of one, 1 inside one, 0 not at all. */
function fit(field: string, term: string) {
  let at = field.indexOf(term)
  if (at < 0) return 0
  let best = 1
  while (at >= 0) {
    const start = at === 0 || !/[\p{L}\p{N}]/u.test(field[at - 1]!)
    const end = at + term.length === field.length || !/[\p{L}\p{N}]/u.test(field[at + term.length]!)
    best = Math.max(best, start ? (end ? 3 : 2) : 1)
    if (best === 3) break
    at = field.indexOf(term, at + 1)
  }
  return best
}

/** A stretch of `text` around its first match, cut at word boundaries. */
function snippetOf(text: string, terms: string[], width = 160) {
  const lower = text.toLowerCase()
  const at = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0))
  if (!Number.isFinite(at) || text.length <= width) return text.slice(0, width)
  let start = Math.max(0, at - Math.floor(width / 3))
  if (start > 0) start = text.indexOf(' ', start) + 1 || start
  let end = Math.min(text.length, start + width)
  if (end < text.length) end = text.lastIndexOf(' ', end) > start ? text.lastIndexOf(' ', end) : end
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

function indexOf(docs: Searchable[]) {
  return docs.flatMap((doc) =>
  doc.sections.map((s) => ({
    doc: { slug: doc.slug, href: doc.href, title: doc.title },
    heading: s.heading,
    id: s.id,
    text: s.text,
    code: s.code,
    // the lead belongs to the top of the page, where a reader meets it
    body: (s.heading ? s.text : `${doc.description} ${s.text}`).toLowerCase(),
    lowCode: s.code.toLowerCase(),
    lowTitle: doc.title.toLowerCase(),
    lowHeading: (s.heading ?? '').toLowerCase(),
    description: doc.description,
  })),
  )
}

/**
 * The sections holding every word of the query, best first: a word in the page title counts most, then in the
 * heading, then in the text, and a whole word more than part of one. A page answers once per section.
 */
export function createSearch(docs: Searchable[]) {
  const index = indexOf(docs)
  return (query: string, limit = 12): Hit[] => search(index, query, limit)
}

type Entry = ReturnType<typeof indexOf>[number]

/** How well a section holds every term, or 0 if it misses one; and whether anything beyond the page title matched. */
function scoreOf(s: Entry, terms: string[]) {
  let score = 0
  let titled = false
  let own = false
  for (const term of terms) {
    const t = fit(s.lowTitle, term)
    const h = fit(s.lowHeading, term)
    const b = fit(s.body, term)
    const c = fit(s.lowCode, term)
    if (!t && !h && !b && !c) return { score: 0, titled, own }
    // a word in code counts for less than in prose: code repeats names that prose explains
    score += t * 6 + h * 4 + b + c * 0.4
    titled ||= t > 0
    own ||= h + b + c > 0
  }
  return { score, titled, own }
}

function search(index: Entry[], query: string, limit: number): Hit[] {
  const words = termsOf(query)
  if (!words.length) return []
  // "render value" finds renderValue too
  const tries = words.length > 1 ? [words, [words.join('')]] : [words]
  const phrase = words.join(' ')
  const hits: Hit[] = []
  for (const s of index) {
    let best = { score: 0, titled: false, own: false, terms: words }
    for (const terms of tries) {
      const r = scoreOf(s, terms)
      // the words found as one name are the words found as a phrase
      if (r.score && terms !== words) r.score += 6
      if (r.score > best.score) best = { ...r, terms }
    }
    const { score: base, titled, own, terms } = best
    // a section answers for what it holds; one that only shares its page's title leaves that to the page's top
    if (!base || (s.heading && !own)) continue
    let score = base
    if (words.length > 1 && (s.lowHeading.includes(phrase) || s.body.includes(phrase))) score += 6
    // the top of a page stands for the page when it is the title that matched
    if (!s.heading && titled) score += 1
    const inProse = terms.some((t) => s.body.includes(t))
    const text = inProse || !s.code ? s.text || s.description : s.code
    hits.push({ doc: s.doc, heading: s.heading, id: s.id, snippet: snippetOf(text, terms), score })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** `text` cut into runs, each marked if it is one of the query's words, for a result to highlight them. */
export function marks(text: string, query: string): Array<{ text: string; match: boolean }> {
  const terms = termsOf(query).sort((a, b) => b.length - a.length)
  if (!terms.length) return [{ text, match: false }]
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return text
    .split(new RegExp(`(${escaped.join('|')})`, 'gi'))
    .filter(Boolean)
    .map((part) => ({ text: part, match: terms.includes(part.toLowerCase()) }))
}
