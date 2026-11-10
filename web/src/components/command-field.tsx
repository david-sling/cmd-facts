import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { COMMANDS } from 'cmd-facts'
import type { Entry, Role, Rule } from 'cmd-facts'

/**
 * The page has no disk, and a command is only worth reading when it is pointed at something. So
 * the line is completed against a desk that could be anyone's: one folder, a few things in it,
 * two levels down. Nothing here is ever read off the computer the page is open on.
 */
const CWD = '~/Desktop'

const TREE: Record<string, readonly string[]> = {
  '': ['app.zip', 'build/', 'notes.md', 'photos/', 'report.pdf', 'site/'],
  'build/': ['assets/', 'index.html'],
  'build/assets/': ['app.css', 'app.js'],
  'photos/': ['beach.jpg', 'hike.jpg'],
  'site/': ['index.md', 'public/'],
  'site/public/': ['favicon.ico', 'robots.txt'],
}

/** What stands in for the kinds of argument a desk cannot hold. */
const SAMPLES: Partial<Record<Role, readonly { value: string; hint: string }[]>> = {
  url: [
    { value: 'https://example.com/app.zip', hint: 'a file to fetch' },
    { value: 'https://example.com/install.sh', hint: 'a script to fetch' },
  ],
  host: [
    { value: 'example.com', hint: 'another computer' },
    { value: 'localhost', hint: 'this computer' },
  ],
  domain: [{ value: 'example.com', hint: 'a name to look up' }],
  package: [
    { value: 'ripgrep', hint: 'something to install' },
    { value: 'node', hint: 'something to install' },
  ],
  user: [{ value: 'root', hint: 'the owner of everything' }],
  pid: [{ value: '4821', hint: 'a running program' }],
  signal: [{ value: 'TERM', hint: 'ask it to stop' }],
  pattern: [{ value: 'TODO', hint: 'words to look for' }],
}

/** One thing the line could become, and what that thing says about itself. */
type Suggestion = { value: string; hint: string }

/** A suggestion replaces the word being written, or, as `line`, starts the line again. */
type Plan = { token: string; items: Suggestion[]; replace: 'token' | 'line'; where: string }

/** Enough of the row to choose from; a shell prints everything, a line of chips holds this. */
const SHOWN = 8

const commandItems = (token: string): Suggestion[] =>
  Object.entries(COMMANDS)
    .filter(([name]) => name.startsWith(token) && name !== token)
    .map(([name, entry]) => ({ value: name, hint: entry.facts.says }))

/** A path completes a piece at a time, and a folder leaves the line inside it. */
function pathItems(token: string): Suggestion[] {
  const cut = token.lastIndexOf('/')
  const dir = cut < 0 ? '' : token.slice(0, cut + 1)
  const partial = cut < 0 ? token : token.slice(cut + 1)
  const entries = TREE[dir.replace(/^\.\//, '')]
  if (!entries) return []

  return entries
    .filter((name) => name.startsWith(partial) && name !== partial)
    .map((name) => ({ value: dir + name, hint: name.endsWith('/') ? 'folder' : 'file' }))
}

const sampleItems = (role: Role, token: string): Suggestion[] =>
  (SAMPLES[role] ?? []).filter((item) => item.value.startsWith(token) && item.value !== token)

/**
 * What this word is for, read off the same table the facts come from: the flag before it where
 * that flag takes a value, and otherwise the operand the row declares for this position.
 */
function roleFor(here: Rule, before: string[], from: number): Role {
  const previous = before[before.length - 1]
  const takesValue = (word: string) =>
    !!here.values?.[word] || !!here.flags?.find((f) => f.flags?.includes(word) && f.takesValue)

  if (previous?.startsWith('-')) {
    const declared = here.values?.[previous]
    if (declared) return declared
    const rule = here.flags?.find((f) => f.flags?.includes(previous) && f.takesValue)
    if (rule?.role) return rule.role
  }

  // the words already given to this command, less its flags and the values they took
  let given = 0
  for (let index = from; index < before.length; index += 1) {
    const word = before[index]!
    const earlier = before[index - 1]
    if (word.startsWith('-')) continue
    if (earlier?.startsWith('-') && takesValue(earlier)) continue
    given += 1
  }

  const operands = here.operands ?? []
  return operands[Math.min(given, operands.length - 1)] ?? 'path'
}

/**
 * What a shell would offer at the end of this line: the program while the first word is being
 * written, then that program's own subcommands and flags, then whatever the row says this
 * position is — a path off the desk above, an address, or another command for the ones that hand
 * over. Nothing fitting leaves the commands themselves, which is somewhere to start rather than
 * a dead end.
 */
function plan(line: string): Plan {
  const tokens = line.split(' ')
  const token = tokens[tokens.length - 1] ?? ''
  const before = tokens.slice(0, -1).filter(Boolean)
  // a word already on the line is not a suggestion: it is what was written
  const fresh = (items: Suggestion[]) => items.filter((item) => !before.includes(item.value))
  const nothing: Plan = { token, items: [], replace: 'token', where: '' }

  if (!before.length)
    return { token, items: commandItems(token), replace: 'token', where: 'commands' }

  // `sudo rm -` is rm's flags, not sudo's: the program is the last word the table knows, because
  // the words before it are the ones that hand over to it
  let at = -1
  for (let index = before.length - 1; index >= 0; index -= 1)
    if (COMMANDS[before[index]!]) {
      at = index
      break
    }

  const entry: Entry | undefined = at < 0 ? undefined : COMMANDS[before[at]!]
  if (!entry) return nothing

  const name = before[at]!
  const subName = before[at + 1]
  const sub = subName ? entry.sub?.[subName] : undefined
  const here: Rule = sub ?? entry

  if (token.startsWith('-')) {
    const seen = new Set<string>()
    const items: Suggestion[] = []
    for (const rule of here.flags ?? [])
      for (const flag of rule.flags ?? []) {
        if (!flag.startsWith(token) || flag === token || seen.has(flag)) continue
        seen.add(flag)
        items.push({ value: flag, hint: rule.facts?.says ?? `a flag of ${name}` })
      }
    return { token, items: fresh(items), replace: 'token', where: `flags of ${name}` }
  }

  // a subcommand is only a subcommand in the word straight after the program
  if (before.length === at + 1 && entry.sub) {
    const items = Object.entries(entry.sub)
      .filter(([word]) => word.startsWith(token) && word !== token)
      .map(([word, rule]) => ({ value: word, hint: rule.facts.says }))
    if (items.length) return { token, items, replace: 'token', where: `${name} subcommands` }
  }

  const role = roleFor(here, before, at + (sub ? 2 : 1))
  if (role === 'command')
    return {
      token,
      items: fresh(commandItems(token)),
      replace: 'token',
      where: `what ${name} would run`,
    }

  const items = role === 'path' ? pathItems(token) : sampleItems(role, token)
  return { token, items: fresh(items), replace: 'token', where: role }
}

/** Taking a word leaves the line where a shell leaves it: inside a folder, or at the next word. */
function complete(line: string, value: string) {
  const tokens = line.split(' ')
  tokens[tokens.length - 1] = value
  const joined = tokens.join(' ')
  return value.endsWith('/') ? joined : `${joined} `
}

/**
 * The line being explained. It is a text field first — anything can be typed into it — and the
 * examples under it are only a way in. The grey tail is the one thing Tab takes; the list under
 * the field is everything else this position could be, and those are taken with Enter. While
 * nobody has typed, the rule fills and the next example is taken up at the end of its travel.
 */
export function CommandField({
  value,
  onChange,
  presets,
  onPreset,
  playing,
  dwell,
  onElapsed,
}: {
  value: string
  onChange: (value: string) => void
  presets: readonly string[]
  onPreset: (value: string) => void
  playing: boolean
  dwell: number
  onElapsed: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [active, setActive] = useState(0)
  const [listed, setListed] = useState(false)
  const [focused, setFocused] = useState(false)
  // Tab with no tail to take is a shell's way of asking what could go here, and only then is the
  // whole of a position listed; a finished word followed by a space is not a question
  const [asked, setAsked] = useState(false)
  // the line has not been touched since it was clicked into, so the commands are worth offering
  const [probing, setProbing] = useState(false)
  const marked = useRef<HTMLButtonElement>(null)
  // a completion can only be printed where the line ends; mid-word it would sit over the rest
  const [atEnd, setAtEnd] = useState(true)

  const planned = useMemo(() => plan(value), [value])
  // an empty word at the end of a written line offers nothing until it is asked for
  const quiet = planned.token === '' && value.trim() !== '' && !asked
  const natural = quiet ? [] : planned.items
  // clicking into a line that has nothing to complete is still worth answering with the commands
  const starting = probing && natural.length === 0
  const items = starting ? commandItems('') : natural
  const replace = starting ? 'line' : planned.replace
  const where = starting ? 'a command to start from' : planned.where
  const token = planned.token

  const index = Math.min(active, items.length - 1)
  const chosen = items[index]
  const open = listed && items.length > 0

  // the grey tail: the rest of the word, printed where it would land if it were taken. It belongs
  // to the caret, so it is only there while the line is being written
  const ghost =
    focused && atEnd && token && replace === 'token' && chosen?.value.startsWith(token)
      ? chosen.value.slice(token.length)
      : ''

  useEffect(() => {
    marked.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active, token])

  const caret = (element: HTMLInputElement) =>
    setAtEnd(element.selectionStart === element.value.length)

  const take = (suggestion: Suggestion, whole: boolean) => {
    onChange(whole ? `${suggestion.value} ` : complete(value, suggestion.value))
    setActive(0)
    setAsked(false)
    setProbing(false)
    setAtEnd(true)
    input.current?.focus()
  }

  return (
    <span className="relative block min-w-0 flex-1">
      <span className="relative flex items-center">
        {/* the field carries the caret and the text; this prints the unwritten half behind it */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre font-mono"
        >
          <span className="invisible">{value}</span>
          <span className="text-ink-3/60">{ghost}</span>
        </span>

        <input
          ref={input}
          value={value}
          onChange={(event) => {
            setActive(0)
            setListed(true)
            setAsked(false)
            setProbing(false)
            // a line can only change while it is being written, whatever the focus event did
            setFocused(true)
            caret(event.target)
            onChange(event.target.value)
          }}
          onFocus={(event) => {
            // clicking the line is asking what could go on it
            setListed(true)
            setFocused(true)
            setProbing(true)
            caret(event.target)
          }}
          onBlur={() => {
            setListed(false)
            setFocused(false)
            setProbing(false)
            setAsked(false)
          }}
          onSelect={(event) => caret(event.currentTarget)}
          onKeyDown={(event) => {
            // Tab takes the grey tail and nothing else, the way a shell has it — and with no
            // tail to take it still stays on the line, because a terminal never answers Tab by
            // leaving. Shift+Tab is the way out, so the page is still crossable by keyboard.
            if (event.key === 'Tab' && !event.shiftKey) {
              event.preventDefault()
              if (ghost && chosen) take(chosen, false)
              else setAsked(true)
              return
            }
            if (event.key === 'Enter' && open && chosen) {
              event.preventDefault()
              take(chosen, replace === 'line')
              return
            }
            if (event.key === 'ArrowDown' && open) {
              event.preventDefault()
              setActive((current) => (current + 1) % items.length)
              return
            }
            if (event.key === 'ArrowUp' && open) {
              event.preventDefault()
              setActive((current) => (current - 1 + items.length) % items.length)
              return
            }
            if (event.key === 'Escape') {
              setListed(false)
              setAsked(false)
            }
          }}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Command to explain"
          aria-expanded={open}
          aria-autocomplete="both"
          role="combobox"
          placeholder="type a command"
          className="w-full min-w-0 bg-transparent font-mono text-ink caret-pink outline-none placeholder:text-ink-3/60 focus-visible:outline-none!"
        />
      </span>

      {/* the rule is also the clock: while nobody has typed it fills, and the next example is
          taken up where it runs out */}
      <span className={`relative mt-1 block h-px transition-colors ${focused ? 'bg-line-2' : 'bg-line'}`}>
        {playing ? (
          <motion.span
            key={value}
            aria-hidden
            className="absolute inset-y-0 left-0 block w-full origin-left bg-pink/35"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: dwell, ease: 'linear' }}
            onAnimationComplete={onElapsed}
          />
        ) : null}
      </span>

      {/* the examples and the completions are the same row: what this line could be next, in the
          one place that is already under the field. A list laid over the card would cover the
          sentence, which is the thing being typed for */}
      <span className="mt-3 block">
        <span className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {open
            ? items.slice(0, SHOWN).map((item, position) => (
                <button
                  key={item.value}
                  type="button"
                  ref={position === index ? marked : undefined}
                  // the field keeps the caret: taking a word on mousedown beats losing it to a blur
                  onMouseDown={(event) => {
                    event.preventDefault()
                    take(item, replace === 'line')
                  }}
                  onMouseEnter={() => setActive(position)}
                  className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[11.5px] transition-colors ${
                    position === index
                      ? 'border-pink/50 bg-pink/10 text-ink'
                      : 'border-line text-ink-3 hover:border-line-2 hover:text-ink-2'
                  }`}
                >
                  {item.value}
                </button>
              ))
            : presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onPreset(preset)}
                  className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[11.5px] transition-colors ${
                    preset === value
                      ? 'border-pink/50 bg-pink/10 text-ink'
                      : 'border-line text-ink-3 hover:border-line-2 hover:text-ink-2'
                  }`}
                >
                  {preset}
                </button>
              ))}

          {open && items.length > SHOWN ? (
            <span className="shrink-0 self-center font-mono text-[11px] text-ink-3/60">
              +{items.length - SHOWN}
            </span>
          ) : null}
        </span>

        {/* one line, always here, so nothing under it moves when the row changes */}
        <span className="mt-2 flex items-baseline justify-between gap-4 font-mono text-[10.5px] text-ink-3/70">
          <span className="truncate">
            {open ? chosen?.hint : 'an example to start from, or type your own'}
          </span>
          <span className="shrink-0">
            {open ? `${where}${ghost ? ' · tab' : ''} · enter` : CWD}
          </span>
        </span>
      </span>

    </span>
  )
}
