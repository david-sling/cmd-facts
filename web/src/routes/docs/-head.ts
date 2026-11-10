import docsCss from '#/docs.css?url'
import type { Doc } from '#/lib/docs'
import { SITE } from '#/site'

/** Set before paint, so a reader who collapsed the sidebar never sees it swing shut on the next page. */
const SIDE = `try{document.documentElement.dataset.docsSide=localStorage.getItem('docs-side')||'open'}catch(e){}`

export function docHead(doc: Doc | undefined) {
  if (!doc) return {}
  // the index page is already called "cmd-facts docs"; suffixing it reads as a stutter
  const title = doc.slug ? `${doc.title} · cmd-facts docs` : doc.title
  return {
    meta: [
      { title },
      { name: 'description', content: doc.description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: doc.description },
      { property: 'og:url', content: `${SITE}${doc.href}` },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: doc.description },
    ],
    scripts: [{ children: SIDE }],
    links: [
      { rel: 'stylesheet', href: docsCss },
      { rel: 'canonical', href: `${SITE}${doc.href}` },
    ],
  }
}
