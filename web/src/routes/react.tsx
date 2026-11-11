import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, Check, Copy, Github } from 'lucide-react'
import { explain, type LinePart } from 'cmd-facts'
import { CommandLine, Sentence, type ValueProps } from 'cmd-facts/react'
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

// The components ship no styles; the playground draws each piece itself with renderPart and renderValue and plain
// Tailwind classes. `playgroundCode` below prints this same code, so keep the two in step.
const tone: Record<Exclude<LinePart['kind'], 'space'>, string> = {
  program: 'font-medium text-white',
  subcommand: 'text-white',
  flag: 'text-pink-400',
  value: 'text-sky-300',
  operator: 'text-zinc-500',
  redirect: 'text-zinc-500',
  word: 'text-zinc-300',
  unread: 'text-red-400',
}

const renderPart = (part: LinePart) =>
  part.kind === 'space' ? (
    part.text
  ) : (
    <span className={part.kind === 'flag' && part.escalated ? 'rounded bg-pink-400/15 text-pink-400' : tone[part.kind]}>
      {part.text}
    </span>
  )

const renderValue = (v: ValueProps) => (
  <code title={v.written.join('\n')} className="rounded bg-pink-400/10 px-1 font-mono text-[0.85em] text-pink-400">
    {v.text}
  </code>
)

const KINDS: { kind: string; line: string; says: string }[] = [
  { kind: 'program', line: 'git', says: 'The program a command runs. `nested` where another command hands over to it, as rm in sudo rm.' },
  { kind: 'subcommand', line: 'commit', says: 'A word that picks the row, as commit in git commit.' },
  { kind: 'flag', line: '-o', says: '`escalated` where the flag widened what the command can do; `unread` where the row does not know it.' },
  { kind: 'value', line: 'install.sh', says: 'An argument, with its `role` — path, url, host, pid, package… — and `flag` where a flag took it.' },
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
  /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(import|from|function|const|return|export)\b|(<\/?[A-Z][A-Za-z]*|<\/?>|\/>)/g
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
const playgroundCode = (line: string) => `import { CommandLine, Sentence, useExplain } from 'cmd-facts/react'

const tone = {
  program: 'font-medium text-white',
  subcommand: 'text-white',
  flag: 'text-pink-400',
  value: 'text-sky-300',
  operator: 'text-zinc-500',
  redirect: 'text-zinc-500',
  word: 'text-zinc-300',
  unread: 'text-red-400',
}

function Approve() {
  const line =
    ${JSON.stringify(line)}
  const explanation = useExplain(line)
  return (
    <>
      <CommandLine
        line={line}
        of={explanation}
        renderPart={(part) =>
          part.kind === 'space' ? part.text : (
            <span
              className={
                part.kind === 'flag' && part.escalated
                  ? 'rounded bg-pink-400/15 text-pink-400'
                  : tone[part.kind]
              }
            >
              {part.text}
            </span>
          )
        }
      />
      <Sentence
        of={explanation}
        renderValue={(v) => (
          <code
            title={v.written.join('\\n')}
            className="rounded bg-pink-400/10 px-1 font-mono text-[0.85em] text-pink-400"
          >
            {v.text}
          </code>
        )}
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
          <p className="eyebrow normal-case tracking-[0.04em]">&lt;CommandLine renderPart /&gt;</p>
          <div className="mt-4 font-mono text-[15px] leading-relaxed break-words whitespace-pre-wrap sm:text-[18px]">
            <CommandLine line={line} of={explanation} renderPart={renderPart} />
          </div>
        </div>
        <div className="min-w-0 border-t border-line px-5 py-6 sm:px-7">
          <p className="eyebrow normal-case tracking-[0.04em]">&lt;Sentence renderValue /&gt;</p>
          <p className="mt-4 text-[19px] font-light leading-snug text-ink sm:text-[22px]">
            <Sentence of={explanation} renderValue={renderValue} />
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
        <p className="mt-3 text-[17px] font-light leading-snug text-ink">
          <Sentence of={e} renderValue={renderValue} />
        </p>
      </figure>
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
                <span className={`ml-3 ${kind === 'flag' ? 'rounded bg-pink-400/15 text-pink-400' : tone[kind as keyof typeof tone]}`}>
                  {line}
                </span>
              </dt>
              <dd className="text-[15px] text-ink-2">{ticks(says)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section eyebrow="Styling" title="Draw each piece yourself, or style the defaults.">
        <p>
          Nothing ships with a stylesheet. The playground draws every piece itself:{' '}
          <span className="font-mono text-[0.9em] text-ink">renderPart</span> gets each word of the line with what it
          was read as, and <span className="font-mono text-[0.9em] text-ink">renderValue</span> gets each value of the
          sentence — its text, every value, what was typed, its role and flag. Return any element, with whatever
          classes you like; keep a value looking like a value, not like prose.
        </p>
        <p>
          Leave them out and the defaults render plain elements that carry what each piece is as attributes, for a
          stylesheet to pick up:
        </p>
        <Code>{`[data-kind='flag'] { color: hotpink }
[data-escalated] { background: rgb(255 105 180 / 0.15) }
[data-kind='value'][data-role='url'] { color: skyblue }`}</Code>
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
