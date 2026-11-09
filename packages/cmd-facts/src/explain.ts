import { effectsOf, merge } from './facts.ts'
import type { Facts } from './facts.ts'
import { COMMANDS } from './data/index.ts'
import type { Entry, FlagRule, Role, Rule } from './entry.ts'

export type ArgSlot = { index: number; value: string; role: Role; flag?: string }

export type Explanation = {
  /** The resolved program path, as handed in. On a nested explanation it is the name as written on the line. */
  program: string
  name: string
  /** The table row this was answered from, or null when the program is not known. */
  key: string | null
  subcommand?: string
  facts: Facts
  args: ArgSlot[]
  /** Flags on this command line that widened the fact set, in the form the table declares them. */
  escalated: string[]
  /**
   * The command this one hands over to, where that command is on this same line and runs on this computer:
   * `sudo rm -rf x`, `xargs rm`, `env FOO=1 node app.js`, `find . -exec rm {} +`. Its `args` indexes point into the
   * original argv. Its facts are a floor: the inner program was never resolved to a path, so it is marked
   * `confidence: derived`, and the outer command stays opaque whatever the inner one turns out to be.
   */
  runs?: Explanation
}

export const UNKNOWN: Facts = {
  effectAtLeast: ['execute'],
  reversible: 'unknown',
  network: 'arbitrary',
  privilege: 'none',
  opaque: true,
  handsOverTo: 'a program this library has no entry for',
  touchesCredentials: false,
  repeatSafe: false,
  confidence: 'unknown',
  source: 'unknown',
  says: 'This runs a program that is not in the list of known commands.',
  note: 'Nothing here describes what the program does. The facts shown are the widest ones, not a measurement.',
}

export const basename = (p: string) => p.split('/').filter(Boolean).pop() ?? p
const isFlag = (t: string) => t.length > 1 && t.startsWith('-')
const VERSION_SUFFIX = /^([A-Za-z_][A-Za-z_-]*?)[0-9][0-9.]*$/

function lookup(name: string): { key: string; entry: Entry; trimmed: boolean } | undefined {
  const exact = COMMANDS[name]
  if (exact) return { key: name, entry: exact, trimmed: false }
  const stem = VERSION_SUFFIX.exec(name)?.[1]
  const entry = stem ? COMMANDS[stem] : undefined
  return entry?.versioned ? { key: stem!, entry, trimmed: true } : undefined
}

function flagsOf(rule: Rule, token: string): FlagRule[] {
  const rules = rule.flags ?? []
  const exact = rules.filter((r) => r.flags.includes(token))
  if (exact.length || rule.flagStyle === 'words') return exact
  if (!/^-[A-Za-z0-9]{2,}$/.test(token)) return []
  return [...token.slice(1)].flatMap((c) => rules.filter((r) => r.flags.includes(`-${c}`)))
}

function roleAt(operands: Role[] | undefined, n: number): Role {
  if (!operands?.length) return 'unknown'
  return operands[Math.min(n, operands.length - 1)] ?? 'unknown'
}

function parse(argv: string[], start: number, rule: Rule, facts: Facts) {
  const args: ArgSlot[] = []
  const escalated: string[] = []
  let out = facts
  let operand = 0
  let literal = false
  let nested = false

  for (let i = start; i < argv.length; i++) {
    const token = argv[i]!
    if (nested) {
      args.push({ index: i, value: token, role: 'command' })
      continue
    }
    if (token === '--' && !literal) {
      literal = true
      continue
    }
    if (!literal && isFlag(token)) {
      const eq = token.indexOf('=')
      const head = eq > 1 ? token.slice(0, eq) : token
      const inline = eq > 1 ? token.slice(eq + 1) : undefined
      const matched = flagsOf(rule, head)
      for (const m of matched) {
        if (!Object.keys(m.facts).length) continue
        out = merge(out, { ...m.facts, source: 'curated+flags' })
        escalated.push(m.flags[0]!)
      }
      const taker = matched.findLast((m) => m.takesValue)
      const role = taker?.role ?? rule.values?.[head]
      // The flag a value belongs to is reported as the table declares it, so a bundled `-xzf` still points at `-f`.
      const owner = taker?.flags[0] ?? head
      if (role && inline !== undefined) args.push({ index: i, value: inline, role, flag: owner })
      else if (role && i + 1 < argv.length) {
        args.push({ index: ++i, value: argv[i]!, role, flag: owner })
        if (role === 'command') nested = true
      }
      continue
    }
    const role = roleAt(rule.operands, operand++)
    args.push({ index: i, value: token, role })
    if (role === 'command') nested = true
  }
  return { facts: out, args, escalated: [...new Set(escalated)] }
}

const MAX_DEPTH = 4
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/

function nestedAt(argv: string[], args: ArgSlot[], rule: Rule): number | undefined {
  if (!rule.nestedHere) return undefined
  const slot = args.find((a) => a.role === 'command')
  if (!slot) return undefined
  let at = slot.index
  if (rule.assignmentsFirst) while (at < argv.length && ASSIGNMENT.test(argv[at]!)) at++
  return at < argv.length ? at : undefined
}

function at(program: string, argv: string[], depth: number): Explanation {
  const name = basename(program)
  const found = lookup(name)
  if (!found) {
    const args: ArgSlot[] = argv.slice(1).map((value, n) => ({ index: n + 1, value, role: 'unknown' as Role }))
    return { program, name, key: null, facts: UNKNOWN, args, escalated: [] }
  }

  const { key, entry, trimmed } = found
  const word = argv[1]
  const wantsSub = entry.sub !== undefined && word !== undefined && !isFlag(word)
  const sub = wantsSub ? entry.sub![word] : undefined
  const rule: Rule = sub ?? entry
  const start = wantsSub ? 2 : 1
  const base: Facts = sub
    ? sub.facts
    : wantsSub
      ? merge(entry.facts, { confidence: 'derived', source: 'subcommand-miss' })
      : entry.facts

  const parsed = parse(argv, start, rule, trimmed ? merge(base, { source: 'name-fallback' }) : base)
  const head = { program, name, key, ...(wantsSub ? { subcommand: word } : {}) }

  const offset = depth < MAX_DEPTH ? nestedAt(argv, parsed.args, rule) : undefined
  if (offset === undefined) return { ...head, ...parsed }

  const inner = at(argv[offset]!, argv.slice(offset), depth + 1)
  const runs: Explanation = {
    ...inner,
    facts: merge(inner.facts, { confidence: 'derived', source: 'nested' }),
    args: inner.args.map((a) => ({ ...a, index: a.index + offset })),
  }
  // The inner command widens the outer one but can never clear it: the name on the line was not resolved to a
  // program, and in `xargs rm` the arguments it will be handed are not on this line at all.
  const facts = merge(parsed.facts, {
    effect: effectsOf(runs.facts),
    reversible: runs.facts.reversible,
    network: runs.facts.network,
    privilege: runs.facts.privilege,
    touchesCredentials: runs.facts.touchesCredentials,
    repeatSafe: false,
  })
  return { ...head, ...parsed, facts, runs }
}

/**
 * Facts about one command, from its resolved program path and its argv. Nothing is read from the agent that asked
 * for it, and nothing is inferred from the text of an argument.
 */
export const explain = (input: { program: string; argv: string[] }): Explanation =>
  at(input.program, input.argv.length ? input.argv : [basename(input.program)], 0)
