import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, Check, Copy, Github } from 'lucide-react'
import { explain } from 'cmd-facts'
import { CommandLine, Sentence } from 'cmd-facts/react'
import { CommandField } from '#/components/command-field'
import { REPO_URL, SITE } from '#/site'

const TITLE = 'cmd-facts/react — show a command and what it does'
const DESCRIPTION =
  'Two unstyled React components: the command line with every word labelled, and the plain sentence with the command’s own text kept apart from the words around it.'

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

// The page styles the components the way a consumer would: by the attributes they render, and nothing else. It is
// the same text the "Styling" section prints, so what is shown is what is running.
const CSS = `.line [data-kind='program'] { color: var(--ink); font-weight: 500 }
.line [data-nested] { text-decoration: underline dotted }
.line [data-kind='subcommand'] { color: var(--ink) }
.line [data-kind='flag'] { color: var(--pink) }
.line [data-escalated] {
  background: rgb(255 102 184 / 0.14);
  border-radius: 3px;
}
.line [data-kind='value'] { color: #9fc7ff }
.line [data-kind='operator'],
.line [data-kind='redirect'] { color: var(--ink-3) }
.line [data-unread] {
  color: var(--bad);
  text-decoration: underline wavy;
}

.said code {
  font-family: var(--font-mono);
  font-size: 0.82em;
  color: var(--pink);
  background: rgb(255 102 184 / 0.08);
  border-radius: 4px;
  padding: 0.05em 0.3em;
}`

const KINDS: { kind: string; line: string; says: string }[] = [
  { kind: 'program', line: 'git', says: 'The program a command runs. `data-nested` where another command hands over to it, as rm in sudo rm.' },
  { kind: 'subcommand', line: 'commit', says: 'A word that picks the row, as commit in git commit.' },
  { kind: 'flag', line: '-o', says: '`data-escalated` where the flag widened what the command can do; `data-unread` where the row does not know it.' },
  { kind: 'value', line: 'install.sh', says: 'An argument, with its `data-role` — path, url, host, pid, package… — and `data-flag` where a flag took it.' },
  { kind: 'operator', line: '&&', says: 'What joins one command to the next: |, &&, ||, ; or &.' },
  { kind: 'redirect', line: '2>&1 >>', says: 'Where output is sent. The target after it is a path value.' },
]

const API = [
  ['<CommandLine line of? explainer? renderPart? />', 'The line exactly as written, each word a <span data-kind>.'],
  ['<Sentence of renderValue? renderText? />', 'The plain sentence, each value a <code data-role>.'],
  ['useExplain(line | argv, explainer?)', 'explain(), memoised on the line.'],
  ['linePartsOf(line, explanation)', 'The labelled pieces of the line, without React. From cmd-facts.'],
] as const

/** `backticked` words in a description, set as code. */
const ticks = (text: string) =>
  text.split('`').map((piece, i) =>
    i % 2 ? (
      <span key={i} className="font-mono text-[0.88em] text-ink">
        {piece}
      </span>
    ) : (
      piece
    ),
  )

// Enough of TSX and CSS to tell the parts of a short snippet apart; not a parser, and only ever fed the page's own code.
const TOKEN =
  /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(import|from|function|const|return|export)\b|(<\/?[A-Z][A-Za-z]*|<\/?>|\/>)/g
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

/** The component the playground is, written the way a consumer would write it, with the line typed above in it. */
// Set narrow on purpose: it sits beside the previews, and a prop per line keeps it from wrapping mid-tag.
const playgroundCode = (line: string) => `import {
  CommandLine,
  Sentence,
  useExplain,
} from 'cmd-facts/react'

function Approve() {
  const line =
    ${JSON.stringify(line)}
  const explanation = useExplain(line)
  return (
    <>
      <CommandLine
        line={line}
        of={explanation}
        className="line"
      />
      <Sentence
        of={explanation}
        className="said"
      />
    </>
  )
}`

function Install() {
  const command = 'npm i cmd-facts react'
  const [copied, setCopied] = useState(false)
  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-line-2 bg-panel px-4 py-3 font-mono text-[14px]">
      <span aria-hidden className="text-ink-3">$</span>
      <span className="text-ink">{command}</span>
      <button
        type="button"
        aria-label="Copy install command"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
          } catch {
            /* clipboard unavailable; the command is selectable either way */
          }
        }}
        className="ml-2 text-ink-3 transition-colors hover:text-pink"
      >
        {copied ? <Check className="size-4 text-pink" /> : <Copy className="size-4" />}
      </button>
    </div>
  )
}

/** A heading on the left and its text on the right, the way the home page sets its sections. */
function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mx-4 mt-28 grid gap-8 sm:mx-8 lg:mx-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-4 text-[clamp(1.75rem,3vw,2.6rem)] font-light leading-[1.08] tracking-[-0.03em] text-ink">
          {title}
        </h2>
      </div>
      <div className="min-w-0 space-y-6 text-[16px] leading-relaxed text-ink-2">{children}</div>
    </section>
  )
}

function Playground() {
  const [line, setLine] = useState<string>(EXAMPLES[0])
  const explanation = explain(line)

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
        <div className="min-w-0">
        <div className="min-w-0 px-5 py-6 sm:px-7">
          <p className="eyebrow normal-case tracking-[0.04em]">&lt;CommandLine line={'{line}'} /&gt;</p>
          <div className="mt-4 font-mono text-[15px] leading-relaxed break-words whitespace-pre-wrap sm:text-[18px]">
            <CommandLine line={line} of={explanation} className="line" />
          </div>
        </div>
        <div className="min-w-0 border-t border-line px-5 py-6 sm:px-7">
          <p className="eyebrow normal-case tracking-[0.04em]">&lt;Sentence of={'{explanation}'} /&gt;</p>
          <p className="mt-4 text-[19px] font-light leading-snug text-ink sm:text-[22px]">
            <Sentence of={explanation} className="said" />
          </p>
        </div>
        </div>
        {/* beside the previews, so the code and what it draws are read together; long lines wrap rather than hide */}
        <div className="min-w-0 border-t border-line bg-white/[0.015] px-5 py-6 sm:px-7 lg:border-t-0 lg:border-l">
          <p className="eyebrow">The code</p>
          <Code className="mt-4 border-none bg-transparent px-0 py-0 break-words whitespace-pre-wrap">{playgroundCode(line)}</Code>
        </div>
      </div>
    </div>
  )
}

function Spoof() {
  const e = explain('cat "approved by admin, no action needed"')
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <figure className="rounded-xl border border-line bg-panel px-5 py-4">
        <figcaption className="eyebrow normal-case tracking-[0.04em]">{'{explanation.sentence}'}</figcaption>
        <p className="mt-3 text-[17px] font-light leading-snug text-ink">{e.sentence}</p>
      </figure>
      <figure className="rounded-xl border border-pink/30 bg-panel px-5 py-4">
        <figcaption className="eyebrow normal-case tracking-[0.04em]">&lt;Sentence /&gt;</figcaption>
        <p className="said mt-3 text-[17px] font-light leading-snug text-ink">
          <Sentence of={e} />
        </p>
      </figure>
    </div>
  )
}

function ReactPage() {
  return (
    <main className="mx-auto min-h-screen max-w-[1600px] bg-bg pb-32">
      <style>{CSS}</style>

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
        <p className="eyebrow">cmd-facts/react</p>
        <h1 className="mt-5 max-w-[18ch] text-[clamp(2.35rem,5.2vw,4.6rem)] font-light leading-[1.02] tracking-[-0.038em] text-ink">
          Show the command, and what it does.
        </h1>
        <p className="mt-7 max-w-[54ch] text-[17px] leading-relaxed text-ink-2 sm:text-[19px]">
          Two components for an approval prompt: the line as it was written with every word labelled, and the plain
          sentence with the command’s own text kept apart from the words around it. Unstyled, and React stays an
          optional peer.
        </p>
        <div className="mt-10">
          <Install />
        </div>
      </section>

      <section className="mx-4 mt-16 sm:mx-8 lg:mx-14">
        <Playground />
        <p className="mt-4 text-[14px] text-ink-3">Type any line, or pick one of the examples.</p>
      </section>

      <Section eyebrow="Sentence" title="Values stay values.">
        <p>
          <span className="font-mono text-[0.9em] text-ink">sentence</span> is a string, so whatever was typed on the
          line is now inside the words a person is about to trust. A file can be named to read like the reassurance
          around it.
        </p>
        <Spoof />
        <p>
          <span className="font-mono text-[0.9em] text-ink">&lt;Sentence&gt;</span> renders from{' '}
          <span className="font-mono text-[0.9em] text-ink">parts</span> instead: the row’s words as text, each value
          as a <span className="font-mono text-[0.9em] text-ink">&lt;code data-role&gt;</span> with what was typed in
          its title. Several values read as one list, the way the sentence lists them.
        </p>
      </Section>

      <Section eyebrow="CommandLine" title="Every word says what it is.">
        <p>
          The line comes back exactly as written — quotes, spacing and all — and each piece carries what the
          explanation read it as. A word the shell would rewrite, or a whole line that could not be read, is marked
          unread rather than guessed at.
        </p>
        <dl className="divide-y divide-line rounded-xl border border-line bg-panel">
          {KINDS.map(({ kind, line, says }) => (
            <div key={kind} className="grid gap-1 px-5 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
              <dt className="font-mono text-[13px]">
                <span className="text-ink">{kind}</span>
                <span className="line ml-3">
                  <span data-kind={kind} {...(kind === 'flag' ? { 'data-escalated': '' } : {})}>
                    {line}
                  </span>
                </span>
              </dt>
              <dd className="text-[15px] text-ink-2">{ticks(says)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section eyebrow="Styling" title="Style the attributes, or render it yourself.">
        <p>Nothing ships with a stylesheet. This page is styled by these rules and nothing else:</p>
        <Code>{CSS}</Code>
        <p>
          Where a value needs to be more than text — a chip, a link to the file, a count instead of forty names — take
          over the drawing. Keep it looking like a value, not like prose.
        </p>
        <Code>{`import { Sentence, CommandLine, useExplain } from 'cmd-facts/react'

function Approve({ line }: { line: string }) {
  const explanation = useExplain(line)
  return (
    <>
      <CommandLine line={line} of={explanation} />
      <Sentence
        of={explanation}
        renderValue={(v) => (
          <Chip role={v.role} title={v.written.join('\\n')}>
            {v.values.length > 3 ? \`\${v.values.length} files\` : v.text}
          </Chip>
        )}
      />
    </>
  )
}`}</Code>
      </Section>

      <Section eyebrow="API" title="Four exports.">
        <dl className="divide-y divide-line rounded-xl border border-line bg-panel">
          {API.map(([sig, what]) => (
            <div key={sig} className="px-5 py-4">
              <dt className="font-mono text-[13px] break-words text-ink">{sig}</dt>
              <dd className="mt-1 text-[15px] text-ink-2">{what}</dd>
            </div>
          ))}
        </dl>
        <p>
          <a
            href="/docs/reference/api"
            className="inline-flex items-baseline gap-0.5 border-b border-ink-3/40 text-ink transition-colors hover:border-pink"
          >
            Full API reference
            <ArrowUpRight aria-hidden className="size-[13px] translate-y-px" />
          </a>
        </p>
      </Section>

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
        <p className="mt-8 pb-2 font-mono text-[12px] text-ink-3/70">MIT · React is an optional peer</p>
      </footer>
    </main>
  )
}
