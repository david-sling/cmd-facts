/**
 * Splitting one string into words is the one piece of reading-meaning-out-of-text this library does, so it is kept
 * small, explicit, and quick to refuse.
 *
 * It handles the part of the grammar that decides where a word ends — single quotes, double quotes, backslashes —
 * and nothing else. It expands nothing: a `$HOME` or a `*` stays the literal word it was written as, because what
 * those stand for is not on the line. And it refuses outright where a line means more than one command, rather than
 * splitting it somewhere and explaining the part it happened to keep.
 */
export type Tokens = { ok: true; argv: string[] } | { ok: false; why: 'many' | 'unterminated' | 'empty' }

// Everything that makes a line more than one command, or hands part of it somewhere this cannot follow.
const OPERATOR = '|&;<>()`\n'
// Inside double quotes a backslash only escapes these; before anything else it stays a backslash.
const ESCAPABLE = '"\\`$\n'

export function tokenize(line: string): Tokens {
  const argv: string[] = []
  let word = ''
  let started = false
  let quote: '"' | "'" | null = null

  const end = () => {
    if (started) argv.push(word)
    word = ''
    started = false
  }

  for (let i = 0; i < line.length; i++) {
    const c = line[i]!

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
      const next = line[i + 1]
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
      const next = line[i + 1]
      if (next === undefined) return { ok: false, why: 'unterminated' }
      word += next
      started = true
      i++
      continue
    }
    if (c === ' ' || c === '\t') {
      end()
      continue
    }
    if (OPERATOR.includes(c)) return { ok: false, why: 'many' }

    word += c
    started = true
  }

  if (quote) return { ok: false, why: 'unterminated' }
  end()
  return argv.length ? { ok: true, argv } : { ok: false, why: 'empty' }
}
