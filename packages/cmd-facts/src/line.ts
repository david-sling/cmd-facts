/**
 * Reading one line as the commands it runs. This is the one piece of reading-meaning-out-of-text this library does,
 * so it is kept to grammar: where a word ends, where a command ends, and where a command's output is sent. Splitting
 * on an operator is the same kind of work as splitting on a space — it is what the line says, not what it means.
 *
 * It expands nothing: a `$HOME` or a `*` stays the literal word it was written as, because what those stand for is
 * not on the line. And it refuses a substitution outright, because the value of one is not on the line either.
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
}

export type Tokens = { ok: true; steps: Step[] } | { ok: false; why: 'unterminated' | 'empty' | 'substitution' }

// Inside double quotes a backslash only escapes these; before anything else it stays a backslash.
const ESCAPABLE = '"\\`$\n'
const DIGITS = /^[0-9]+$/

export function tokenize(line: string): Tokens {
  const steps: Step[] = []
  let argv: string[] = []
  let redirects: Redirect[] = []
  let after: Op | undefined
  let word = ''
  let started = false
  let quote: '"' | "'" | null = null
  let pending: { op: Redirect['op']; at: number; fd?: string } | null = null

  const endWord = () => {
    if (!started) return
    if (pending) {
      redirects.push({ op: pending.op, path: word, ...(pending.fd ? { fd: pending.fd } : {}) })
      pending = null
    } else {
      argv.push(word)
    }
    word = ''
    started = false
  }

  const endStep = (next: Op) => {
    endWord()
    if (argv.length || redirects.length) steps.push({ argv, ...(after ? { after } : {}), redirects })
    argv = []
    redirects = []
    after = next
  }

  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    const next = line[i + 1]

    if (quote === "'") {
      if (c === "'") quote = null
      else word += c
      continue
    }

    if (quote === '"') {
      if (c === '"') {
        quote = null
        continue
      }
      if (c === '\\' && next !== undefined && ESCAPABLE.includes(next)) {
        word += next
        i++
        continue
      }
      word += c
      continue
    }

    if (c === "'" || c === '"') {
      quote = c
      started = true
      continue
    }
    if (c === '\\') {
      if (next === undefined) return { ok: false, why: 'unterminated' }
      word += next
      started = true
      i++
      continue
    }
    if (c === ' ' || c === '\t') {
      endWord()
      continue
    }

    // What a substitution or a subshell stands for is not on this line, so there is nothing here to read.
    if (c === '`' || (c === '$' && next === '(') || c === '(' || c === ')') return { ok: false, why: 'substitution' }

    if (c === '\n' || c === ';') {
      endStep(';')
      continue
    }
    if (c === '|') {
      if (next === '|') i++
      endStep(next === '|' ? '||' : '|')
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
        continue
      }
      if (next === '&') i++
      endStep(next === '&' ? '&&' : '&')
      continue
    }
    if (c === '>' || c === '<') {
      // `2> log` names the stream in the word just read, which belongs to the redirection rather than to argv.
      const fd = started && DIGITS.test(word) ? word : undefined
      if (fd !== undefined) {
        word = ''
        started = false
      } else {
        endWord()
      }
      const double = c === '>' && next === '>'
      if (double) i++
      // `>|` overwrites even where the shell was set not to; it reads as `>`.
      else if (c === '>' && next === '|') i++
      pending = { op: double ? '>>' : (c as Redirect['op']), at: i, ...(fd !== undefined ? { fd } : {}) }
      continue
    }

    word += c
    started = true
  }

  if (quote) return { ok: false, why: 'unterminated' }
  endWord()
  if (pending) return { ok: false, why: 'unterminated' }
  const trailing = after !== undefined && !argv.length && !redirects.length
  if (argv.length || redirects.length) steps.push({ argv, ...(after ? { after } : {}), redirects })

  if (!steps.length) return { ok: false, why: 'empty' }
  // A command on one side of an operator and nothing on the other, as in `ls |` or `| ls`, is not a line this can
  // account for: something was meant to run there and it is not written down.
  if (trailing || steps[0]!.after !== undefined || steps.some((x) => !x.argv.length)) {
    return { ok: false, why: 'unterminated' }
  }
  return { ok: true, steps }
}
