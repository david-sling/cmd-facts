import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Dialog } from 'radix-ui'
import { CornerDownLeft, FileText, Hash, Search } from 'lucide-react'
import { allDocs } from '#/lib/docs'
import { createSearch, marks } from '#/lib/search'
import type { Hit } from '#/lib/search'

const search = createSearch(allDocs())

function Marked({ text, query }: { text: string; query: string }) {
  return marks(text, query).map((part, i) => (part.match ? <mark key={i}>{part.text}</mark> : part.text))
}

/** A place in the docs as the router takes it: every page but the index is the splat route. */
function goTo(navigate: ReturnType<typeof useNavigate>, hit: Hit) {
  const hash = hit.id
  const done = navigate(
    hit.doc.slug ? { to: '/docs/$', params: { _splat: hit.doc.slug }, hash } : { to: '/docs', hash },
  )
  // the router restores scroll after a navigation settles, which can undo a jump made before it; so the heading is
  // brought in view once the new page has painted, and again a moment later in case it was still loading
  void Promise.resolve(done).then(() => {
    if (!hash) return
    const land = () => document.getElementById(hash)?.scrollIntoView({ block: 'start' })
    requestAnimationFrame(() => requestAnimationFrame(land))
    setTimeout(land, 120)
  })
}

/**
 * Search across every docs page, opened by the button in the top bar, ⌘K / Ctrl K, or `/`. Each result is a section,
 * so choosing one lands on its heading.
 */
export function DocsSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [mac, setMac] = useState(false)
  const list = useRef<HTMLUListElement>(null)
  const navigate = useNavigate()
  const hits = useMemo(() => search(query), [query])

  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), [])
  useEffect(() => setActive(0), [query])
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.preventDefault()
        setOpen((o) => !o || e.key === '/')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (hit: Hit | undefined) => {
    if (!hit) return
    setOpen(false)
    goTo(navigate, hit)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (hits.length) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(hits[active])
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery('')
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="docs-search-btn" aria-label="Search docs">
          <Search aria-hidden />
          <span className="docs-search-label">Search docs</span>
          <kbd aria-hidden>{mac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="docs-search-overlay" />
        <Dialog.Content className="docs-search" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Search docs</Dialog.Title>
          <div className="docs-search-field">
            <Search aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search docs"
              aria-label="Search docs"
              role="combobox"
              aria-expanded={hits.length > 0}
              aria-controls="docs-search-results"
              aria-activedescendant={hits.length ? `docs-search-hit-${active}` : undefined}
              aria-autocomplete="list"
              spellCheck={false}
              autoComplete="off"
            />
            <Dialog.Close className="docs-search-esc" aria-label="Close search">
              Esc
            </Dialog.Close>
          </div>
          {query.trim() &&
            (hits.length ? (
              <ul id="docs-search-results" ref={list} role="listbox" aria-label="Results" className="docs-search-results">
                {hits.map((hit, i) => (
                  <li
                    key={`${hit.doc.href}#${hit.id ?? ''}`}
                    id={`docs-search-hit-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(hit)}
                  >
                    {hit.heading ? <Hash aria-hidden /> : <FileText aria-hidden />}
                    <span className="docs-search-hit">
                      <span className="docs-search-where">
                        {hit.heading ? (
                          <>
                            <span className="docs-search-page">{hit.doc.title}</span>
                            <span className="docs-search-heading">
                              <Marked text={hit.heading} query={query} />
                            </span>
                          </>
                        ) : (
                          <span className="docs-search-heading">
                            <Marked text={hit.doc.title} query={query} />
                          </span>
                        )}
                      </span>
                      <span className="docs-search-snippet">
                        <Marked text={hit.snippet} query={query} />
                      </span>
                    </span>
                    <CornerDownLeft aria-hidden className="docs-search-enter" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="docs-search-empty" role="status">
                Nothing in the docs matches “{query.trim()}”.
              </p>
            ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
