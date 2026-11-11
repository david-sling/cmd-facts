import type { Role } from './entry.ts'
import type { Explanation } from './explain.ts'
import { scan, type Op } from './line.ts'

/**
 * One piece of a command line as it was written, labelled with what the explanation read it as. The pieces cover
 * the line end to end: joined, their `text` is the line, character for character, quotes and spacing included.
 *
 * `step` is which command of the line a piece belongs to, as in `steps`. Where the line could not be read at all —
 * a substitution, a quote that never closes — it comes back as one `unread` piece, the way `explain` refuses it.
 */
export type LinePart =
  | { kind: 'space'; text: string }
  | { kind: 'unread'; text: string }
  | { kind: 'operator'; text: string; op: Op; step: number }
  | ({ text: string; step: number } & LineWord)

/** What a word on the line was read as. */
export type LineWord =
  /** The program a command runs. `nested` where it is the command another one hands over to, as `rm` in `sudo rm`. */
  | { kind: 'program'; nested?: true }
  | { kind: 'subcommand' }
  /** `escalated` where this flag widened the fact set; `unread` where the row does not know it. */
  | { kind: 'flag'; escalated?: true; unread?: true }
  /** An argument the row gave a role, as in `args`. A redirection's target is a `path` with `flag` set to `>`. */
  | { kind: 'value'; role: Role; flag?: string; unread?: true }
  /** `>`, `2>>`, `&>`, `2>&1`. */
  | { kind: 'redirect' }
  | { kind: 'word'; unread?: true }

const isFlag = (word: string) => word.length > 1 && word.startsWith('-')

// `-o` was escalated and the line wrote `-fsSLo` or `-o=x`: the flag is in this word.
const spells = (word: string, flag: string) =>
  word === flag ||
  word.startsWith(`${flag}=`) ||
  (/^-[A-Za-z0-9]$/.test(flag) && /^-[A-Za-z0-9]+$/.test(word) && word.includes(flag[1]!))

/** What the word at `index` of `argv` is, according to `e`; `program` is where `e`'s own program sits. */
function wordAt(e: Explanation, index: number, word: string, program: number, nested: boolean): LineWord {
  if (index === program) return nested ? { kind: 'program', nested: true } : { kind: 'program' }
  const arg = e.args.find((a) => a.index === index)
  const unread = e.unread?.includes(word) ? { unread: true as const } : {}

  // The command this one hands over to was looked up in its own right; its words are read by that answer.
  if (arg?.role === 'command' && e.runs) {
    const start = Math.min(...e.args.filter((a) => a.role === 'command').map((a) => a.index))
    if (index >= start) return wordAt(e.runs, index, word, start, true)
  }
  if (arg && arg.role !== 'unknown') return { kind: 'value', role: arg.role, ...(arg.flag ? { flag: arg.flag } : {}) }
  if (isFlag(word)) return { kind: 'flag', ...(e.escalated.some((f) => spells(word, f)) ? { escalated: true } : {}), ...unread }
  if (arg) return { kind: 'value', role: 'unknown', ...unread }
  if (e.subcommand?.split(' ').includes(word)) return { kind: 'subcommand' }
  return { kind: 'word', ...unread }
}

/**
 * The line, in pieces, each labelled with what `explanation` read it as — for showing a person the command they are
 * approving with its program, flags and arguments told apart. `explanation` has to be the answer for this same line.
 */
export function linePartsOf(line: string, explanation: Explanation): LinePart[] {
  const { tokens, marks } = scan(line)
  if (!tokens.ok) return line ? [{ kind: 'unread', text: line }] : []

  const stepOf = (n: number) => explanation.steps?.[n] ?? explanation
  const parts: LinePart[] = []
  let at = 0
  for (const mark of marks) {
    if (mark.start > at) parts.push({ kind: 'space', text: line.slice(at, mark.start) })
    at = mark.end
    const text = line.slice(mark.start, mark.end)
    const { step } = mark
    const e = stepOf(step)
    switch (mark.kind) {
      case 'op':
        parts.push({ kind: 'operator', text, op: mark.op, step })
        break
      case 'redirect':
        parts.push({ kind: 'redirect', text, step })
        break
      case 'path': {
        const argv = tokens.steps[step]!.argv
        const arg = e.args.find((a) => a.index === argv.length + mark.redirect)
        parts.push({ kind: 'value', text, step, role: arg?.role ?? 'path', ...(arg?.flag ? { flag: arg.flag } : {}) })
        break
      }
      case 'word':
        parts.push({ text, step, ...wordAt(e, mark.index, tokens.steps[step]!.argv[mark.index]!, 0, false) })
        break
    }
  }
  if (at < line.length) parts.push({ kind: 'space', text: line.slice(at) })
  return parts
}
