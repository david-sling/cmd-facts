/**
 * Reading one line as the commands it runs. This is the one piece of reading-meaning-out-of-text this library does,
 * so it is kept to grammar: where a word ends, where a command ends, and where a command's output is sent. Splitting
 * on an operator is the same kind of work as splitting on a space — it is what the line says, not what it means.
 *
 * It expands nothing: a `$HOME` or a `*` stays the literal word it was written as, because what those stand for is
 * not on the line. And it refuses a substitution outright, because the value of one is not on the line either.
 *
 * A word the shell would expand is still not the word the program receives, though. `$OPTS`, `$'-o'`, `{-o,x}` and a
 * leading `*` can each arrive as a flag, or as several words, so the position of every such word is reported in
 * `open` and nothing is claimed about what it is. A `~` and a wildcard further into a word are left alone: they
 * become paths that start the way the word was written, so they cannot turn into a flag.
 */

/** How a command was joined to the one before it. */
export type Op = '|' | '&&' | '||' | ';' | '&'

/** Where a command's output was sent, or where its input was taken from. */
export type Redirect = {
  op: '>' | '>>' | '<'
  path: string
  /** The stream, where the line named one: `2> log` carries `'2'`, and `&> log` carries `'&'`, both streams at once. */
  fd?: string
}

export type Step = {
  argv: string[]
  /** The operator that joined this command to the one before it. Absent on the first. */
  after?: Op
  redirects: Redirect[]
  /**
   * Indexes into `argv` of the words the shell would expand before the program sees them: a variable, a `$'…'`
   * string, a brace list, a word that opens with a wildcard. The word here is what was written, not what arrives.
   * Absent where there are none.
   */
  open?: number[]
}

export type Tokens = { ok: true; steps: Step[] } | { ok: false; why: 'unterminated' | 'empty' | 'substitution' }

// Inside double quotes a backslash only escapes these; before anything else it stays a backslash.
const ESCAPABLE = '"\\`$\n'
const DIGITS = /^[0-9]+$/
// What can follow a `$` to make it stand for something else: a name, `{`, a special parameter, or a quote (`$'…'`).
const EXPANDS = /[A-Za-z0-9_{@*#?!$'"-]/
// `{a,b}` and `{1..3}` become several words. `{}` on its own does not, and is what `find -exec` and `xargs -I` use.
const BRACES = /\{[^{}]*(,|\.\.)[^{}]*\}/
// A word that opens with a wildcard can match a file whose name starts with a dash.
const LEADING_GLOB = /^([*?]|\[.*\])/

/**
 * Where each piece of a line sits in the text it was read from, so a renderer can show the line exactly as written
 * and still say what each word is. Offsets are UTF-16 indexes into the line, `end` exclusive. Anything between two
 * marks — spaces, a backslash that joins two lines — belongs to no word.
 */
export type Mark = { start: number; end: number; step: number } & (
  | { kind: 'word'; index: number }
  | { kind: 'op'; op: Op }
  /** `>`, `2>>`, `&>`; `redirect` is absent where the stream was pointed at another one (`2>&1`) and nothing lands. */
  | { kind: 'redirect'; redirect?: number }
  | { kind: 'path'; redirect: number }
)

export function tokenize(line: string): Tokens {
  return scan(line).tokens
}

/** `tokenize`, with where each word, operator and redirection sat in the line. */
export function scan(line: string): { tokens: Tokens; marks: Mark[] } {
  const marks: Mark[] = []
  const done = (tokens: Tokens) => ({ tokens, marks })
  const steps: Step[] = []
  let argv: string[] = []
  let redirects: Redirect[] = []
  let after: Op | undefined
  let word = ''
  let open: number[] = []
  // The word as the shell sees its unquoted characters, with a quoted or escaped one blanked out.
  let bare = ''
  let expands = false
  let started = false
  let quote: '"' | "'" | null = null
  let pending: { op: Redirect['op']; at: number; fd?: string } | null = null
  // Where the character being read sits, and where the word being built began.
  let cursor = 0
  let wordStart = 0
  const begin = () => {
    if (!started) wordStart = cursor
    started = true
  }

  const endWord = () => {
    if (!started) return
    const span = { start: wordStart, end: cursor, step: steps.length }
    const opened = expands || BRACES.test(bare) || LEADING_GLOB.test(bare)
    bare = ''
    expands = false
    if (pending) {
      marks.push({ ...span, kind: 'path', redirect: redirects.length })
      redirects.push({ op: pending.op, path: word, ...(pending.fd ? { fd: pending.fd } : {}) })
      pending = null
    } else {
      if (opened) open.push(argv.length)
      marks.push({ ...span, kind: 'word', index: argv.length })
      argv.push(word)
    }
    word = ''
    started = false
  }

  const push = () => {
    steps.push({ argv, ...(after ? { after } : {}), redirects, ...(open.length ? { open } : {}) })
    open = []
  }

  const endStep = (next: Op) => {
    endWord()
    if (argv.length || redirects.length) push()
    argv = []
    redirects = []
    after = next
  }

  const op = (start: number, end: number, value: Op) => marks.push({ start, end, step: steps.length, kind: 'op', op: value })

  for (let i = 0; i < line.length; i++) {
    cursor = i
    const c = line[i]!
    const next = line[i + 1]

    if (quote === "'") {
      if (c === "'") quote = null
      else {
        word += c
        bare += ' '
      }
      continue
    }

    if (quote === '"') {
      if (c === '"') {
        quote = null
        continue
      }
      if (c === '\\' && next !== undefined && ESCAPABLE.includes(next)) {
        // A backslash before a line break joins the two lines, and neither character is part of the word.
        if (next !== '\n') {
          word += next
          bare += ' '
        }
        i++
        continue
      }
      // A variable inside double quotes arrives as one word, so it only matters where it opens the word: there it
      // can still be a flag. Further in, as in `"$HOME/x"` after a `--out=`, the word starts the way it was written.
      if (c === '$' && word === '' && next !== undefined && EXPANDS.test(next)) expands = true
      word += c
      bare += ' '
      continue
    }

    if (c === "'" || c === '"') {
      quote = c
      begin()
      continue
    }
    if (c === '\\') {
      if (next === undefined) return done({ ok: false, why: 'unterminated' })
      // A backslash before a line break joins the two lines: `curl \⏎-o x` is `curl -o x`.
      if (next === '\n') {
        i++
        continue
      }
      word += next
      bare += ' '
      begin()
      i++
      continue
    }
    if (c === ' ' || c === '\t') {
      endWord()
      continue
    }

    // What a substitution or a subshell stands for is not on this line, so there is nothing here to read.
    if (c === '`' || (c === '$' && next === '(') || c === '(' || c === ')') return done({ ok: false, why: 'substitution' })

    if (c === '\n' || c === ';') {
      endStep(';')
      op(cursor, i + 1, ';')
      continue
    }
    if (c === '|') {
      if (next === '|') i++
      endStep(next === '|' ? '||' : '|')
      op(cursor, i + 1, next === '|' ? '||' : '|')
      continue
    }
    if (c === '&') {
      // `2>&1` and `>&2` point one stream at another that is already open. Nothing new lands on disk, so there is
      // no redirection to record; the duplication is read so the command keeps its own row. `2>&-` closes a stream.
      if (pending && i === pending.at + 1 && next !== undefined && (DIGITS.test(next) || next === '-')) {
        let j = i + 2
        if (next !== '-') while (j < line.length && DIGITS.test(line[j]!)) j++
        const boundary = line[j] === undefined || ' \t\n;|&<>'.includes(line[j]!)
        if (boundary) {
          const dup = marks.at(-1)
          if (dup?.kind === 'redirect') {
            dup.end = j
            delete dup.redirect
          }
          pending = null
          i = j - 1
          continue
        }
      }
      // `&>` sends both streams to a file; it is a redirection, not a command boundary. `&>>` appends them.
      if (next === '>') {
        endWord()
        const double: boolean = line[i + 2] === '>'
        if (double) i++
        pending = { op: double ? '>>' : '>', at: i + 1, fd: '&' }
        i++
        marks.push({ start: cursor, end: i + 1, step: steps.length, kind: 'redirect', redirect: redirects.length })
        continue
      }
      if (next === '&') i++
      endStep(next === '&' ? '&&' : '&')
      op(cursor, i + 1, next === '&' ? '&&' : '&')
      continue
    }
    if (c === '>' || c === '<') {
      // `2> log` names the stream in the word just read, which belongs to the redirection rather than to argv.
      const fd = started && DIGITS.test(word) ? word : undefined
      const from = fd !== undefined ? wordStart : cursor
      if (fd !== undefined) {
        word = ''
        bare = ''
        started = false
      } else {
        endWord()
      }
      const double = c === '>' && next === '>'
      if (double) i++
      // `>|` overwrites even where the shell was set not to; it reads as `>`.
      else if (c === '>' && next === '|') i++
      pending = { op: double ? '>>' : (c as Redirect['op']), at: i, ...(fd !== undefined ? { fd } : {}) }
      marks.push({ start: from, end: i + 1, step: steps.length, kind: 'redirect', redirect: redirects.length })
      continue
    }

    if (c === '$' && next !== undefined && EXPANDS.test(next)) expands = true
    begin()
    word += c
    bare += c
  }

  if (quote) return done({ ok: false, why: 'unterminated' })
  cursor = line.length
  endWord()
  if (pending) return done({ ok: false, why: 'unterminated' })
  const trailing = after !== undefined && !argv.length && !redirects.length
  if (argv.length || redirects.length) push()

  if (!steps.length) return done({ ok: false, why: 'empty' })
  // A command on one side of an operator and nothing on the other, as in `ls |` or `| ls`, is not a line this can
  // account for: something was meant to run there and it is not written down.
  if (trailing || steps[0]!.after !== undefined || steps.some((x) => !x.argv.length)) {
    return done({ ok: false, why: 'unterminated' })
  }
  return done({ ok: true, steps })
}
