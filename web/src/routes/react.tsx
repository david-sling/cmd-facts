import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Check, Copy, Github } from 'lucide-react'
import { CommandField } from '#/components/command-field'
import { Sentence } from '#/components/sentence'
import sentenceSource from '#/components/sentence.tsx?raw'
import demoSource from '#/registry/examples/sentence-demo.tsx?raw'
import { OpenInV0 } from '#/components/open-in-v0'
import { REPO_URL, SITE } from '#/site'

const TITLE = 'cmd-facts for React — say what a command does'
const DESCRIPTION =
  'Two shadcn components you install into your own project: the command line with every word labelled, and the plain sentence with the command’s own text kept apart from the words around it.'

export const Route = createFileRoute('/react')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: `${SITE}/react` },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE}/react` }],
  }),
  component: ReactPage,
})

const EXAMPLES = [
  'curl -fsSL https://get.example.com/install.sh -o install.sh',
  'sudo rm -rf /var/tmp/build',
  'curl https://get.example.com/i.sh | sh',
  'git -C ~/src/app commit -m "ship it" && git push',
  'echo token 2>&1 >> ~/.profile',
  'ls -Z ~/Documents',
] as const

// The sentence alone; the docs install the rest. The item also pulls in cmd-facts itself and shadcn's `cn` helper.
const INSTALL = `npx shadcn@latest add ${SITE}/r/sentence.json`

/** Where everything this page leaves out is explained. */
const DOCS = [
  { href: '/docs/react', title: 'Install', says: 'All three registry items, what each one adds to your project, and useExplain.' },
  { href: '/docs/react/sentence', title: 'Sentence', says: 'Why values are drawn apart from the prose, its props, and renderValue.' },
  { href: '/docs/react/command-line', title: 'Command line', says: 'The line exactly as written, each word drawn by what it was read as.' },
  { href: '/docs/react/styling', title: 'Styling', says: 'Where the colours live in your copy, and how to change them.' },
] as const

// Enough of TSX to tell the parts of the page's own snippets apart; not a parser.
const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(import|from|function|const|return|export|type)\b|(<\/?[A-Z][A-Za-z.]*|<\/?>|\/>)/g
const TONE = ['text-ink-3', 'text-[#9fc7ff]', 'text-pink', 'text-ink']

function highlight(code: string) {
  const out: React.ReactNode[] = []
  let at = 0
  for (const m of code.matchAll(TOKEN)) {
    if (m.index > at) out.push(code.slice(at, m.index))
    const group = [m[1], m[2], m[3], m[4]].findIndex((g) => g !== undefined)
    out.push(
      <span key={m.index} className={TONE[group]}>
        {m[0]}
      </span>,
    )
    at = m.index + m[0].length
  }
  out.push(code.slice(at))
  return out
}

function Code({ children, className = '' }: { children: string; className?: string }) {
  return (
    <pre
      className={`overflow-x-auto rounded-xl border border-line bg-panel px-5 py-4 font-mono text-[12.5px] leading-[1.7] text-ink-2 sm:text-[13px] ${className}`}
    >
      <code>{highlight(children)}</code>
    </pre>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        } catch {
          /* clipboard unavailable; the text is selectable either way */
        }
      }}
      className="shrink-0 text-ink-3 transition-colors hover:text-pink"
    >
      {copied ? <Check className="size-4 text-pink" /> : <Copy className="size-4" />}
    </button>
  )
}

function Install() {
  return (
    <div className="flex max-w-[52rem] items-start gap-3 rounded-xl border border-line-2 bg-panel px-4 py-3 font-mono text-[13px] sm:text-[14px]">
      <span aria-hidden className="text-ink-3">
        $
      </span>
      <span className="min-w-0 flex-1 break-all text-ink">{INSTALL}</span>
      <CopyButton text={INSTALL} label="Copy install command" />
    </div>
  )
}

/** The example's `command="…"` set to another line, quoted the way JSX needs it. */
const withCommand = (source: string, line: string) =>
  source.replace(/command="[^"]*"/, line.includes('"') ? `command={${JSON.stringify(line)}}` : `command="${line}"`)

// Each tab is a file as it is served from the registry, and opens in v0 as that same item.
const TABS = [
  { id: 'sentence-demo', label: 'app/page.tsx', source: demoSource },
  { id: 'sentence', label: 'components/sentence.tsx', source: sentenceSource },
] as const

function Playground() {
  const [line, setLine] = useState<string>(EXAMPLES[0])
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('sentence-demo')
  const shown = TABS.find((t) => t.id === tab)!
  // the example as served, with the command typed above written into it; v0 opens the file with its own
  const code = (shown.id === 'sentence-demo' ? withCommand(shown.source, line) : shown.source).trimEnd()

  return (
    <div className="rounded-2xl border border-line bg-panel">
      <div className="flex items-start gap-3.5 rounded-t-2xl bg-white/[0.015] px-5 py-5 font-mono text-[13px] sm:px-7 sm:text-[14px]">
        <span aria-hidden className="select-none text-ink-3/60">
          &rsaquo;
        </span>
        <CommandField
          value={line}
          onChange={setLine}
          presets={EXAMPLES}
          onPreset={setLine}
          playing={false}
          dwell={0}
          onElapsed={() => {}}
        />
      </div>

      <div className="grid border-t border-line lg:grid-cols-2">
        <div className="min-w-0 px-5 py-6 sm:px-7 lg:py-8">
          <p className="eyebrow normal-case tracking-[0.04em]">&lt;Sentence /&gt;</p>
          <p className="mt-5 text-[21px] font-light leading-snug text-ink sm:text-[26px]">
            <Sentence command={line} />
          </p>
        </div>

        {/* beside the previews, so the code and what it draws are read together; long lines wrap rather than hide */}
        <div className="min-w-0 border-t border-line bg-white/[0.015] lg:border-t-0 lg:border-l">
          <div className="flex items-center justify-between gap-3 border-b border-line pr-3 sm:pr-5">
          <div role="tablist" aria-label="Code" className="flex gap-1 overflow-x-auto px-3 pt-3 sm:px-5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-t-md px-3 py-2 font-mono text-[12px] transition-colors ${
                  tab === t.id ? 'bg-white/[0.06] text-pink' : 'text-ink-3 hover:text-ink-2'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <OpenInV0 items={shown.id} className="shrink-0" />
          </div>
          <div className="relative px-5 py-5 sm:px-7">
            <div className="absolute top-5 right-5 sm:right-7">
              <CopyButton text={code} label={`Copy ${shown.label}`} />
            </div>
            <Code className="max-h-[36rem] overflow-y-auto border-none bg-transparent px-0 py-0 pr-8 break-words whitespace-pre-wrap">
              {code}
            </Code>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReactPage() {
  return (
    <main className="mx-auto min-h-screen max-w-[1600px] bg-bg pb-32">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10 lg:px-14">
        <a href="/" className="font-mono text-[15px] tracking-[0.04em] text-ink">
          cmd-facts
        </a>
        <nav className="flex items-center gap-6">
          <a href="/react" aria-current="page" className="text-[15px] text-ink">
            React
          </a>
          <a href="/docs" className="text-[15px] text-ink-2 transition-colors hover:text-ink">
            Docs
          </a>
          <a href={REPO_URL} aria-label="cmd-facts on GitHub" className="text-ink-2 transition-colors hover:text-ink">
            <Github aria-hidden className="size-[19px]" />
          </a>
        </nav>
      </header>

      <section className="mx-4 pt-16 sm:mx-8 sm:pt-24 lg:mx-14">
        <p className="eyebrow">shadcn registry</p>
        <h1 className="mt-5 max-w-[18ch] text-[clamp(2.35rem,5.2vw,4.6rem)] font-light leading-[1.02] tracking-[-0.038em] text-ink">
          Say what a command does, safely.
        </h1>
        <p className="mt-7 max-w-[56ch] text-[17px] leading-relaxed text-ink-2 sm:text-[19px]">
          The plain sentence for a command, with the command’s own text drawn apart from the words around it, so a
          file named like a reassurance cannot pass for one. It installs into your project through shadcn, styled with
          your theme, and the code is yours to change.
        </p>
        <div className="mt-10 flex flex-col items-start gap-3">
          <Install />
          <OpenInV0 items="sentence" />
        </div>
      </section>

      <section className="mx-4 mt-16 sm:mx-8 lg:mx-14">
        <Playground />
        <p className="mt-4 text-[14px] text-ink-3">Type any line, or pick one of the examples.</p>
      </section>

      <section className="mx-4 mt-24 sm:mx-8 lg:mx-14">
        <p className="eyebrow">In the docs</p>
        <h2 className="mt-4 text-[clamp(1.75rem,3vw,2.6rem)] font-light leading-[1.08] tracking-[-0.03em] text-ink">
          The rest of it.
        </h2>
        <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {DOCS.map((doc) => (
            <li key={doc.href} className="bg-panel">
              <a href={doc.href} className="group flex h-full flex-col gap-2 px-5 py-5 transition-colors hover:bg-panel-2">
                <span className="flex items-center justify-between text-[17px] text-ink">
                  {doc.title}
                  <ArrowRight
                    aria-hidden
                    className="size-4 text-ink-3 transition-[color,translate] group-hover:translate-x-0.5 group-hover:text-pink"
                  />
                </span>
                <span className="text-[14.5px] leading-relaxed text-ink-2">{doc.says}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mx-4 mt-28 border-t border-line pt-8 sm:mx-8 lg:mx-14">
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-ink-2">
          <a href="/" className="transition-colors hover:text-ink">
            Home
          </a>
          <a href="/docs" className="transition-colors hover:text-ink">
            Docs
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">
            GitHub
          </a>
        </nav>
        <p className="mt-8 pb-2 font-mono text-[12px] text-ink-3/70">MIT · components installed with shadcn</p>
      </footer>
    </main>
  )
}
