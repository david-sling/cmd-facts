import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, MouseEvent } from 'react'
import { Link } from '@tanstack/react-router'
import type { MDXComponents } from 'mdx/types'
import { Check, Copy, Github, SquareCode } from 'lucide-react'
import { REPO_URL, SECTIONS, absolutise, getDoc, neighbours } from '#/lib/docs'
import type { Doc, Heading } from '#/lib/docs'

function useCopy() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => setState('copied'),
      () => setState('failed'),
    )
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2000)
  }
  return [state, copy] as const
}

/** The page as Markdown, so a reader can paste the whole of it into whatever is asking them to approve something. */
function CopyMarkdown({ doc }: { doc: Doc }) {
  const [state, copy] = useCopy()
  return (
    <button
      type="button"
      className="docs-copy-md"
      data-state={state}
      onClick={() => copy(absolutise(doc.markdown, window.location.origin))}
    >
      {state === 'copied' ? <Check aria-hidden /> : <SquareCode aria-hidden />}
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Couldn’t copy' : 'Copy as Markdown'}
      </span>
    </button>
  )
}

function CodeBlock(props: ComponentProps<'pre'>) {
  const ref = useRef<HTMLPreElement>(null)
  const [state, copy] = useCopy()
  return (
    <div className="docs-code">
      <pre {...props} ref={ref} />
      <button
        type="button"
        className="docs-code-copy"
        aria-label={state === 'copied' ? 'Copied' : 'Copy code'}
        onClick={() => copy(ref.current?.textContent ?? '')}
      >
        {state === 'copied' ? <Check aria-hidden /> : <Copy aria-hidden />}
      </button>
    </div>
  )
}

const components: MDXComponents = {
  pre: CodeBlock,
  table: (props) => (
    <div className="docs-table">
      <table {...props} />
    </div>
  ),
  a: ({ href = '', ...props }) =>
    /^https?:/.test(href) ? <a href={href} target="_blank" rel="noreferrer" {...props} /> : <a href={href} {...props} />,
}

/**
 * Every page but the index is served by the splat route, and a <Link> to a literal path under it
 * changes the URL without matching anything, so the reader stays on the page they were on.
 */
const linkTo = (doc: Doc) =>
  doc.slug
    ? ({ to: '/docs/$', params: { _splat: doc.slug }, activeOptions: { exact: true } } as const)
    : // without this the index is active on every page under it, and two rows read as current
      ({ to: '/docs', activeOptions: { exact: true } } as const)

function Sidebar({ current }: { current: string }) {
  return (
    <nav className="docs-side" aria-label="Docs">
      {SECTIONS.map((section) => (
        <div className="docs-side-group" key={section.title}>
          <p className="docs-side-title">{section.title}</p>
          <ul>
            {section.pages.map((slug) => {
              const doc = getDoc(slug)
              if (!doc) return null
              return (
                <li key={slug}>
                  <Link {...linkTo(doc)} aria-current={slug === current ? 'page' : undefined}>
                    {doc.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function useActiveHeading(headings: Heading[]) {
  const [active, setActive] = useState(headings[0]?.id)
  useEffect(() => {
    const update = () => {
      let id = headings[0]?.id
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (el && el.getBoundingClientRect().top < 140) id = h.id
      }
      setActive(id)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [headings])
  return active
}

function jumpTo(e: MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id)
  if (!el || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  history.pushState(history.state, '', `#${id}`)
}

function Contents({ headings }: { headings: Heading[] }) {
  const active = useActiveHeading(headings)
  if (headings.length < 2) return <aside className="docs-toc" />
  return (
    <aside className="docs-toc">
      <nav aria-label="On this page">
        <p className="docs-side-title">On this page</p>
        <ul>
          {headings.map((h) => (
            <li key={h.id} data-depth={h.depth}>
              <a href={`#${h.id}`} aria-current={h.id === active ? 'location' : undefined} onClick={(e) => jumpTo(e, h.id)}>
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

export function DocsPage({ doc }: { doc: Doc }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { prev, next } = neighbours(doc.slug)
  const { Content } = doc
  useEffect(() => setMenuOpen(false), [doc.slug])
  // the sidebar is remembered across pages; the attribute is set before paint by the head script
  useEffect(() => setCollapsed(document.documentElement.dataset.docsSide === 'collapsed'), [])
  const toggleSide = () => {
    const next = !collapsed
    setCollapsed(next)
    document.documentElement.dataset.docsSide = next ? 'collapsed' : 'open'
    try {
      localStorage.setItem('docs-side', next ? 'collapsed' : 'open')
    } catch {
      /* a browser with storage switched off still gets the toggle, just not the memory of it */
    }
  }

  return (
    <div className="docs" data-menu={menuOpen ? 'open' : undefined}>
      <header className="docs-top">
        <div className="docs-top-start">
          <button
            type="button"
            className="docs-side-toggle"
            aria-controls="docs-side"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            onClick={toggleSide}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
              <path d="M9.5 4.5v15" />
            </svg>
          </button>
          <a className="docs-brand" href="/">
            cmd-facts
          </a>
          <Link className="docs-crumb" to="/docs">
            Docs
          </Link>
        </div>
        <div className="docs-top-end">
          <a className="docs-gh" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="cmd-facts on GitHub">
            <Github aria-hidden />
          </a>
          <button
            type="button"
            className="docs-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="docs-side"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 9h15" />
              <path d="M4.5 15h15" />
            </svg>
          </button>
        </div>
      </header>

      <div className="docs-body">
        <div id="docs-side" className="docs-side-wrap">
          <Sidebar current={doc.slug} />
          <div className="docs-side-foot">
            <p className="docs-version">MIT · no runtime dependencies</p>
          </div>
        </div>

        <main className="docs-main">
          <article className="docs-article">
            <header className="docs-head">
              <div className="docs-actions">
                <CopyMarkdown doc={doc} />
              </div>
              <h1>{doc.title}</h1>
              <p className="docs-lead">{doc.description}</p>
            </header>
            <div className="docs-prose">
              <Content components={components} />
            </div>
            {(prev || next) && (
              <nav className="docs-pager" aria-label="Previous and next">
                {prev ? (
                  <Link {...linkTo(prev)} className="docs-pager-link" rel="prev">
                    <span>Previous</span>
                    {prev.title}
                  </Link>
                ) : (
                  <span />
                )}
                {next && (
                  <Link {...linkTo(next)} className="docs-pager-link docs-pager-next" rel="next">
                    <span>Next</span>
                    {next.title}
                  </Link>
                )}
              </nav>
            )}
          </article>
        </main>

        <Contents headings={doc.headings} />
      </div>
    </div>
  )
}
