import GithubSlugger from 'github-slugger'

import { openInV0Url } from '#/site'

export type Heading = { depth: 2 | 3; text: string; id: string }
/** A stretch of a page under one heading (or above the first), as the search reads it: its prose, and its code. */
export type Section = { heading?: string; id?: string; text: string; code: string }

// A pasted page has no buttons: each one becomes the link it opens.
const V0 = /^<OpenInV0 item="([^"]+)" \/>$/gm
// …and no tabs: an example is its code, followed by the link that opens it.
const PREVIEW = /^<ComponentPreview name="([^"]+)">\n\n([\s\S]*?)\n\n<\/ComponentPreview>$/gm

export function body(source: string) {
  return source
    .replace(/^---\n[\s\S]*?\n---\n+/, '')
    .replace(PREVIEW, (_, name: string, code: string) => `${code}\n\n[Open ${name} in v0](${openInV0Url(name)})`)
    .replace(V0, (_, name: string) => `[Open ${name} in v0](${openInV0Url(name)})`)
    .trim()
}

function plain(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .trim()
}

/** A line of Markdown as words a reader would search for: no link targets, tags, fences or table rules. */
function words(line: string) {
  return plain(line)
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*(?:[-*+>]|\d+\.)\s+/, '')
    .replace(/^\|?[\s:|-]+\|?$/, '')
    .replace(/\s*\|\s*/g, ' · ')
    // an empty cell leaves two separators side by side
    .replace(/(?:\s*·)+\s*·\s*/g, ' · ')
    .replace(/^\s*·\s*|\s*·\s*$/g, '')
    .trim()
}

/**
 * The page cut at its headings. Ids are the ones rehype-slug puts on the headings (every heading takes one, so a
 * section under an h4 still counts it), so the contents rail and the search can link to them without reading the DOM.
 */
export function outline(md: string): { headings: Heading[]; sections: Section[] } {
  const slugger = new GithubSlugger()
  const headings: Heading[] = []
  const sections: Section[] = [{ text: '', code: '' }]
  let fenced = false
  for (const line of md.split('\n')) {
    if (/^(```|~~~)/.test(line)) {
      fenced = !fenced
      continue
    }
    const m = !fenced && /^(#{1,6})\s+(.+?)\s*#*$/.exec(line)
    if (!m) {
      // code is searched too, apart from the prose: a name like useExplain is often only in an example
      const section = sections[sections.length - 1]!
      if (fenced) section.code += line.trim() ? `${line.trim()} ` : ''
      else if (words(line)) section.text += `${words(line)} `
      continue
    }
    const text = plain(m[2]!)
    const id = slugger.slug(text)
    const depth = m[1]!.length
    if (depth === 2 || depth === 3) {
      headings.push({ depth, text, id })
      sections.push({ heading: text, id, text: '', code: '' })
    }
  }
  for (const s of sections) {
    s.text = s.text.trim()
    s.code = s.code.trim()
  }
  // the top of the page stays even when it is empty: it is where a result for the page as a whole lands
  return { headings, sections: sections.filter((s, i) => i === 0 || s.heading || s.text || s.code) }
}
