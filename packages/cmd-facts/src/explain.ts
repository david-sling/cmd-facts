import { effectsOf, merge } from './facts.ts'
import type { Effect, Facts } from './facts.ts'
import { buildRegistry } from './registry.ts'
import type { Registry, RegistryOptions } from './registry.ts'
import { reach } from './entry.ts'
import type { FlagRule, Role, Rule } from './entry.ts'
import { tokenize } from './line.ts'
import type { Op, Step } from './line.ts'
import { flatten, partsOf } from './tell.ts'
import type { Part } from './tell.ts'

export type ArgSlot = {
  index: number
  value: string
  role: Role
  flag?: string
  /** On a redirection's path: the stream that was sent there — `'2'` for errors, `'&'` for both at once. */
  fd?: string
}

/** A pack that stands behind some part of this explanation, and the rows of it that answered. */
export type Attribution = { pack: string; version: string; trusted: boolean; commands: string[] }

export type Explanation = {
  /** The resolved program path, as handed in. On a nested explanation it is the name as written on the line. */
  program: string
  name: string
  /** The table row this was answered from, or null when the program is not known. */
  key: string | null
  /** The pack that supplied this row, or null when the program is not known. `runs` carries its own. */
  origin: string | null
  subcommand?: string
  facts: Facts
  /**
   * The sentence to show a person: `facts.says` where the row stands alone, and the row's slotted sentence with
   * this command's own arguments in it where it has one — `Removes a.txt and b.txt from this computer.`
   */
  sentence: string
  /**
   * The same sentence before it was joined, so a consumer can render the row's words and the command's own text
   * apart. Prefer it over `sentence` wherever there is somewhere to put the values: argument text is
   * attacker-controlled, and in `sentence` it is inside the words a person is about to trust.
   */
  parts: Part[]
  args: ArgSlot[]
  /** Flags on this command line that widened the fact set, in the form the table declares them. */
  escalated: string[]
  /**
   * Words on this command line the row does not account for: a flag nobody has looked at for this command, or an
   * argument where the row expects none. What they do is not known, so `facts` is the program's widest row at
   * `derived` rather than the row for this command, and the arguments after an unread flag carry no role.
   */
  unread?: string[]
  /**
   * The command this one hands over to, where that command is on this same line and runs on this computer:
   * `sudo rm -rf x`, `xargs rm`, `env FOO=1 node app.js`, `find . -exec rm {} +`. Its `args` indexes point into the
   * original argv. Its facts are a floor: the inner program was never resolved to a path, so it is marked
   * `confidence: derived`, and the outer command stays opaque whatever the inner one turns out to be.
   */
  runs?: Explanation
  /**
   * Every pack behind `facts`, outermost first, including the ones that only answered further down `runs`. A line
   * can stack several: in `sudo flowctl run kubectl delete` each of the three names can come from a different pack,
   * and the top-level fact set absorbs all of them. Read it for the audit log; gate on `confidence`, which is
   * lowered to match the weakest link in the chain.
   */
  attribution: Attribution[]
  /** The chain was still handing over when it hit the depth limit, so `facts` is a floor for that reason too. */
  truncated?: true
  /**
   * The commands this line runs, where it runs more than one: `curl … | sh`, `a && b`, `a; b`. Each is explained in
   * full, and `facts` here is every one of them widened together, so a consumer that reads nothing but the top of
   * the answer is told the worst of what the line does rather than being told nothing at all.
   *
   * Each step's `args` index into that step's own words, not into the whole line.
   */
  steps?: Explanation[]
  /** The operator that joined this step to the one before it, on a step. Absent on the first and on a whole line. */
  after?: Op
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

/**
 * A line that was handed over as one string and could not be read as a single command: it carries an operator that
 * makes it more than one, or a quote that never closes. Nothing is split and nothing is guessed — explaining the
 * part that happened to parse would be worse than admitting the line was not read.
 */
/** What each operator does, as its own sentence, so the step sentences around it keep their own capitals. */
const CONNECTIVE: Record<Op, string> = {
  '|': ' What it prints is given to the next command. ',
  '&&': ' Only if that works, the next command runs. ',
  '||': ' Only if that fails, the next command runs. ',
  ';': ' Then the next command runs. ',
  '&': ' It keeps running while the next command starts. ',
}

export const UNREAD_LINE: Facts = {
  effectAtLeast: ['execute'],
  reversible: 'unknown',
  network: 'arbitrary',
  privilege: 'none',
  opaque: true,
  handsOverTo: 'whatever this line turns out to run, which is not read here',
  touchesCredentials: false,
  repeatSafe: false,
  confidence: 'unknown',
  source: 'unknown',
  says: 'This line could not be read as a command.',
  note: 'Nothing here describes what will run. The facts shown are the widest ones, not a measurement.',
}

/** The outer row for a line that runs several commands. What each one does is on `steps`. */
const MANY: Facts = {
  effectAtLeast: ['execute'],
  reversible: 'unknown',
  network: 'arbitrary',
  privilege: 'none',
  opaque: true,
  handsOverTo: 'the commands on this line, each of which is answered for on its own',
  touchesCredentials: false,
  repeatSafe: false,
  confidence: 'derived',
  source: 'nested',
  says: 'This line runs more than one command.',
}

/**
 * What a consumer can hand in. A whole line is how a command usually arrives — out of a log, a job file, an agent's
 * request — and a split argv is how a program that already holds one passes it on. Neither is the better form: a
 * line is split into words and then answered by exactly the same path, and a row is keyed on the program's basename
 * either way, so handing in a path never bought a stronger answer than handing in a name.
 */
export type Input = string | { program: string; argv: string[] }

export const basename = (p: string) => p.split('/').filter(Boolean).pop() ?? p
const isFlag = (t: string) => t.length > 1 && t.startsWith('-')

/** Fold the packs behind a nested chain into one list, outermost first, each pack named once. */
function unionByPack(outer: Attribution[], inner: Attribution[]): Attribution[] {
  const out = outer.map((a) => ({ ...a, commands: [...a.commands] }))
  for (const a of inner) {
    const held = out.find((o) => o.pack === a.pack)
    if (!held) out.push({ ...a, commands: [...a.commands] })
    else for (const c of a.commands) if (!held.commands.includes(c)) held.commands.push(c)
  }
  return out
}

const BUNDLE = /^-[A-Za-z0-9]./
const LETTER = /[A-Za-z0-9]/

/**
 * `role` set means a value is owed; `attachedOnly` means it may only come from the word itself. `read` is false where
 * the table has not looked at the flag, or at one letter of the bundle, for this row.
 */
type FlagRead = { matched: FlagRule[]; role?: Role; owner: string; inline?: string; attachedOnly?: true; read: boolean }

const isPlain = (rule: Rule, flag: string) => (rule.plain ?? []).includes(flag)

/**
 * One flag word, read the way getopt reads it. A word the table declares whole is that one flag. Otherwise a bundle
 * of short flags is read a letter at a time, and the first letter that takes a value ends it: what is left of the
 * word is that value, or the next word is when nothing is left. `-sX POST` and `-sXPOST` both hand POST to `-X`,
 * and none of the letters after `-X` is read as a flag of its own. A letter whose value may only be attached takes
 * what is left of the word, and nothing when nothing is left. A word that reaches anything but a letter before a
 * value starts is not a bundle at all, so `-1.5` stays one word. A bundle is read only if every letter in it is.
 */
function readFlag(rule: Rule, spelled: string): FlagRead {
  const eq = spelled.indexOf('=')
  const head = eq > 1 ? spelled.slice(0, eq) : spelled
  const inline = eq > 1 ? spelled.slice(eq + 1) : undefined
  const rules = rule.flags ?? []
  const exact = rules.filter((r) => r.flags.includes(head))
  const whole = exact.length > 0 || rule.values?.[head] !== undefined || isPlain(rule, head)
  if (whole || rule.flagStyle === 'words' || !BUNDLE.test(spelled)) {
    const taker = exact.findLast((m) => m.takesValue || (m.attached && inline !== undefined))
    // The flag a value belongs to is reported as the table declares it.
    const role = taker?.role ?? rule.values?.[head]
    const only = taker?.attached ? { attachedOnly: true as const } : {}
    return { matched: exact, role, owner: taker?.flags[0] ?? head, inline, ...only, read: whole }
  }
  const matched: FlagRule[] = []
  for (let k = 1; k < spelled.length; k++) {
    if (!LETTER.test(spelled[k]!)) return { matched: [], owner: head, read: false }
    const letter = `-${spelled[k]}`
    const here = rules.filter((r) => r.flags.includes(letter))
    if (!here.length && rule.values?.[letter] === undefined && !isPlain(rule, letter)) return { matched, owner: head, read: false }
    matched.push(...here)
    const rest = spelled.slice(k + 1) || undefined
    const attached = here.findLast((m) => m.attached)
    if (attached) return { matched, role: attached.role, owner: attached.flags[0]!, inline: rest, attachedOnly: true, read: true }
    const taker = here.findLast((m) => m.takesValue)
    const role = taker?.role ?? rule.values?.[letter]
    if (role) return { matched, role, owner: taker?.flags[0] ?? letter, inline: rest, read: true }
  }
  return { matched, owner: head, read: true }
}

type Spoken = { word: string; at: number }

/** The longest run of the words read so far that the table holds as a subcommand, and how many words it took. */
function longestRow(sub: Record<string, Rule>, steps: Spoken[]): { key: string; words: number } | undefined {
  for (let k = steps.length; k > 0; k--) {
    const key = steps
      .slice(0, k)
      .map((s) => s.word)
      .join(' ')
    if (Object.hasOwn(sub, key)) return { key, words: k }
  }
  return undefined
}

function roleAt(operands: Role[] | undefined, n: number): Role {
  if (!operands?.length) return 'unknown'
  return operands[Math.min(n, operands.length - 1)] ?? 'unknown'
}

function parse(argv: string[], start: number, rule: Rule, facts: Facts, open: ReadonlySet<number>) {
  const args: ArgSlot[] = []
  const escalated: string[] = []
  const unread: string[] = []
  let out = facts
  let operand = 0
  let lastOperand = -1
  let literal = false
  let nested = false
  // Where each operand landed in `args`, so a flag that changes their roles can still do so once the line is read.
  const positional: number[] = []
  let moved: Role[] | undefined

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
    // A word the shell expands is not the word that arrives: it can be a flag, or several words. After `--` nothing
    // it becomes is read as a flag, so there it is only an operand whose text is not known.
    if (open.has(i) && !literal) {
      unread.push(token)
      args.push({ index: i, value: token, role: 'unknown' })
      continue
    }
    // `tar xf a.tar` carries its flags as a bare first word (the old option style), read as if it were `-xf`.
    const placed =
      (rule.bareFlagsFirst === true && i === start) ||
      (rule.bareFlagAfter !== undefined && operand === rule.bareFlagAfter && lastOperand === i - 1 && !unread.length)
    const bare = placed && !literal && !isFlag(token) && /^[A-Za-z]+$/.test(token)
    if (!literal && (isFlag(token) || bare)) {
      const { matched, role, owner, inline, attachedOnly, read } = readFlag(rule, bare ? `-${token}` : token)
      if (!read) {
        unread.push(token)
        continue
      }
      for (const m of matched) {
        if (m.operands) moved = m.operands
        if (!Object.keys(m.facts).length) continue
        out = merge(out, { ...m.facts, source: 'curated+flags' })
        escalated.push(m.flags[0]!)
      }
      if (role && inline !== undefined) args.push({ index: i, value: inline, role, flag: owner })
      else if (role && !attachedOnly && i + 1 < argv.length) {
        args.push({ index: ++i, value: argv[i]!, role, flag: owner })
        // Unquoted, the value can split, and what is left over is read as more of the line.
        if (open.has(i)) unread.push(argv[i]!)
        if (role === 'command') nested = true
      }
      continue
    }
    // A row that declares no operands, and has no flag that gives it some, was not written to be pointed at anything,
    // so a word here is one it has not read.
    if (!rule.operands?.length && !(rule.flags ?? []).some((f) => f.operands?.length)) unread.push(token)
    // After a flag nobody has read, the word that follows may be that flag's value, so no position is certain.
    if (unread.length) {
      args.push({ index: i, value: token, role: 'unknown' })
      continue
    }
    const role = roleAt(rule.operands, operand++)
    lastOperand = i
    positional.push(args.length)
    args.push({ index: i, value: token, role })
    if (role === 'command') nested = true
  }
  // The flag can come after the operands it changes (`grep foo -e bar notes.txt`), so they are settled last.
  if (moved) for (const [n, at] of positional.entries()) args[at] = { ...args[at]!, role: roleAt(moved, n) }
  return { facts: out, args, escalated: [...new Set(escalated)], unread }
}

const MAX_DEPTH = 4
const SOCKET = /^\/dev\/(tcp|udp)\/[^/]+\/[^/]+$/
const NONE: ReadonlySet<number> = new Set()

/** How many words the longest subcommand a table holds runs to. Asked on every line, so it is kept per table. */
const depths = new WeakMap<object, number>()
function deepest(sub: Record<string, Rule>): number {
  let held = depths.get(sub)
  if (held === undefined) {
    held = Object.keys(sub).reduce((most, key) => Math.max(most, key.split(' ').length), 0)
    depths.set(sub, held)
  }
  return held
}
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/

function nestedAt(argv: string[], args: ArgSlot[], rule: Rule): number | undefined {
  if (!rule.nestedHere) return undefined
  const slot = args.find((a) => a.role === 'command')
  if (!slot) return undefined
  let at = slot.index
  if (rule.assignmentsFirst) while (at < argv.length && ASSIGNMENT.test(argv[at]!)) at++
  return at < argv.length ? at : undefined
}

const told = (facts: Facts, args: ArgSlot[]): { sentence: string; parts: Part[] } => {
  const parts = partsOf(facts, args)
  return { sentence: flatten(parts), parts }
}

function at(registry: Registry, program: string, argv: string[], depth: number, open: ReadonlySet<number> = NONE): Explanation {
  const name = basename(program)
  // A program name the shell expands is not the name of what runs, whatever its last few letters spell.
  const found = open.has(0) ? undefined : registry.lookup(name)
  if (!found) {
    const args: ArgSlot[] = argv.slice(1).map((value, n) => ({ index: n + 1, value, role: 'unknown' as Role }))
    return { program, name, key: null, origin: null, facts: UNKNOWN, ...told(UNKNOWN, args), args, escalated: [], attribution: [] }
  }

  const { key, entry, origin, trimmed } = found

  // Global options sit before the subcommand (`git -c pager.log=x log`), so the declared ones are stepped over to
  // find it, applying whatever each changes on the way. One the table does not declare may be hiding the subcommand.
  let cursor = 1
  const preArgs: ArgSlot[] = []
  const preRules: FlagRule[] = []
  if (entry.sub && entry.globals?.length) {
    while (cursor < argv.length && isFlag(argv[cursor]!)) {
      const token = argv[cursor]!
      const eq = token.indexOf('=')
      const head = eq > 1 ? token.slice(0, eq) : token
      const inline = eq > 1 ? token.slice(eq + 1) : undefined
      const matched = entry.globals.filter((g) => g.flags.includes(head))
      if (!matched.length) break
      preRules.push(...matched.filter((m) => Object.keys(m.facts).length))
      const taker = matched.findLast((m) => m.takesValue)
      if (taker && inline !== undefined) {
        preArgs.push({ index: cursor, value: inline, role: taker.role ?? 'unknown', flag: taker.flags[0]! })
      } else if (taker && cursor + 1 < argv.length) {
        preArgs.push({ index: ++cursor, value: argv[cursor]!, role: taker.role ?? 'unknown', flag: taker.flags[0]! })
      }
      cursor++
    }
  }

  const word = argv[cursor]
  const wantsSub = entry.sub !== undefined && word !== undefined && !isFlag(word)
  // A subcommand can run to several words (`gh pr create`), and the longest one the table holds answers. An option
  // the subcommand read so far declares can sit between its words (`docker compose -f prod.yml down`), and is read on
  // the way, as a global is. The words are looked up as the table's own keys only, so `git constructor` is a
  // subcommand the table does not hold.
  const steps: Spoken[] = []
  const between: { at: number; args: ArgSlot[]; rules: FlagRule[] }[] = []
  let stuck = false
  if (wantsSub) {
    let i = cursor
    // One word past the longest subcommand the table holds is all that is ever looked at, so the rest of the line is
    // left for `parse`. Reading on would join every word so far once per flag, which no line needs.
    const most = deepest(entry.sub!) + 1
    while (i < argv.length && steps.length < most) {
      const token = argv[i]!
      if (!isFlag(token)) {
        steps.push({ word: token, at: i++ })
        continue
      }
      const sofar = longestRow(entry.sub!, steps)
      if (!sofar) break
      const read = readFlag(entry.sub![sofar.key]!, token)
      if (!read.read) {
        stuck = true
        break
      }
      const rules = read.matched.filter((m) => Object.keys(m.facts).length)
      const owes = read.role !== undefined && read.inline === undefined && !read.attachedOnly && i + 1 < argv.length
      const value = read.inline !== undefined ? { index: i, value: read.inline } : owes ? { index: i + 1, value: argv[i + 1]! } : undefined
      const args: ArgSlot[] = read.role && value ? [{ ...value, role: read.role, flag: read.owner }] : []
      between.push({ at: i, args, rules })
      i += owes ? 2 : 1
    }
  }
  const held = wantsSub ? longestRow(entry.sub!, steps) : undefined
  const subKey = held?.key
  const spoken = held?.words ?? 0
  const sub = subKey !== undefined ? entry.sub![subKey] : undefined
  const rule: Rule = sub ?? entry
  // Where the table holds longer subcommands under the one that answered (`s3 cp` under `s3`), the word after it is
  // one more step of the subcommand, and one the table does not hold.
  const next = steps[spoken]
  const longer = subKey !== undefined && Object.keys(entry.sub!).some((k) => k.startsWith(`${subKey} `))
  const deeper = longer && next !== undefined
  // An option the subcommand does not declare may be hiding the rest of it, as one before the subcommand can.
  const hidden = longer && !deeper && stuck
  const after = next?.word
  // The last word of the subcommand: what the line says after it is read as usual, options stepped over included.
  const end = deeper ? next!.at : subKey !== undefined ? steps[spoken - 1]!.at : wantsSub ? cursor : cursor - 1
  const start = end + 1
  for (const b of between.filter((b) => b.at < end)) {
    preArgs.push(...b.args)
    preRules.push(...b.rules)
  }
  // A word the table holds no row for, and a leading option it does not declare, both leave the exact subcommand
  // unresolved, so the base row (or the shorter subcommand) answers at `derived` either way.
  const missed = entry.sub !== undefined && word !== undefined && !sub
  const seed = (base: Facts) =>
    preRules.reduce(
      (acc, g) => merge(acc, { ...g.facts, source: 'curated+flags' as const }),
      trimmed ? merge(base, { source: 'name-fallback' }) : base,
    )
  // What stands in for this subcommand where the line is not read in full: the subcommand itself where a word or an
  // option may be hiding a longer one under it, else the longest shorter subcommand the table holds (`s3` for `s3 cp`),
  // else the program's own row. `validate()` holds each to everything the ones under it reach.
  const partial = deeper || hidden
  const shorter = subKey?.split(' ').map((_, k, all) => all.slice(0, all.length - 1 - k).join(' ')).find((w) => w && Object.hasOwn(entry.sub!, w))
  const standIn = partial ? { key: subKey!, rule: sub! } : shorter ? { key: shorter, rule: entry.sub![shorter]! } : { key: undefined, rule: entry as Rule }
  const widest = (source: 'subcommand-miss' | 'unread') => merge(reach(standIn.rule), { confidence: 'derived', source })

  // The row answers for the line only where the table has read every word of it. A flag it has not looked at, or a
  // word where it expects none, could be doing anything the program can do, so the line is answered from the row
  // that stands in for this one instead, the same as an unrecognised subcommand.
  const fell = missed || partial ? 'subcommand-miss' : 'unread'
  const first = parse(argv, start, rule, seed(sub && !partial ? sub.facts : sub || missed ? widest('subcommand-miss') : entry.facts), open)
  const stepped = first.unread.length ? parse(argv, start, rule, seed(widest(fell)), open) : first
  const unread = stepped.unread.length ? { unread: stepped.unread } : {}
  const parsed = {
    // A flag that widened the answer on the way does not make it a row written for this line.
    facts: stepped.unread.length ? merge(stepped.facts, { source: fell }) : stepped.facts,
    args: [...preArgs, ...stepped.args],
    escalated: [...new Set([...preRules.map((g) => g.flags[0]!), ...stepped.escalated])],
    ...unread,
  }
  const head = { program, name, key, origin: origin.pack, ...(wantsSub ? { subcommand: deeper ? `${subKey} ${after}` : (subKey ?? word) } : {}) }
  // The row that answered, not the words on the line: an unrecognised subcommand was answered by the base row, and a
  // line read only in part by the row standing in for its subcommand.
  const answered = stepped.unread.length && !partial ? standIn.key : subKey
  const own: Attribution[] = [
    { pack: origin.pack, version: origin.version, trusted: origin.trusted, commands: [answered !== undefined ? `${key} ${answered}` : key] },
  ]

  const wanted = nestedAt(argv, parsed.args, rule)
  const offset = depth < MAX_DEPTH ? wanted : undefined
  if (offset === undefined) {
    const stopped = wanted !== undefined ? { truncated: true as const } : {}
    return { ...head, ...parsed, ...told(parsed.facts, parsed.args), attribution: own, ...stopped }
  }

  const within = new Set([...open].filter((n) => n >= offset).map((n) => n - offset))
  const inner = at(registry, argv[offset]!, argv.slice(offset), depth + 1, within)
  const shifted = inner.args.map((a) => ({ ...a, index: a.index + offset }))
  const innerFacts = merge(inner.facts, { confidence: 'derived', source: 'nested' })
  const runs: Explanation = { ...inner, facts: innerFacts, ...told(innerFacts, shifted), args: shifted }
  // The inner command widens the outer one but can never clear it: the name on the line was not resolved to a
  // program, and in `xargs rm` the arguments it will be handed are not on this line at all. Confidence comes up
  // with the rest, so a fact set that absorbed an untrusted or unknown row cannot still read `verified`.
  const facts = merge(parsed.facts, {
    effect: effectsOf(runs.facts),
    reversible: runs.facts.reversible,
    network: runs.facts.network,
    privilege: runs.facts.privilege,
    touchesCredentials: runs.facts.touchesCredentials,
    confidence: runs.facts.confidence,
    repeatSafe: false,
  })
  return { ...head, ...parsed, facts, ...told(facts, parsed.args), runs, attribution: unionByPack(own, runs.attribution) }
}

/** Widen one fact set by another, treating the second as an overlay of everything it claims. */
const widenBy = (base: Facts, other: Facts): Facts =>
  merge(base, {
    effect: effectsOf(other),
    reversible: other.reversible,
    network: other.network,
    privilege: other.privilege,
    touchesCredentials: other.touchesCredentials,
    repeatSafe: other.repeatSafe,
    confidence: other.confidence,
    ...(other.opaque ? { opaque: true as const, handsOverTo: other.handsOverTo } : {}),
  })

/** The words around a redirected path, telling a reader which stream went there. */
const sentOf = (r: { op: string; fd?: string }): string => {
  if (r.op === '<') return ' It is given what is in '
  if (r.fd === '2') return ' The errors it prints are written to '
  if (r.fd === '&') return ' Everything it prints, errors included, is written to '
  return ' What it prints is written to '
}

/**
 * One command of a line, with what the line does to its output folded in. A redirection is the shell's doing rather
 * than the program's, so it widens the step: `echo x > notes.txt` creates and writes a file that `echo` knows nothing
 * about. The written path joins `args` only after the sentence has been built, so it can never quietly fill a slot
 * meant for a file the command was pointed at.
 */
function stepOf(registry: Registry, step: Step): Explanation {
  const read = at(registry, step.argv[0]!, step.argv, 0, new Set(step.open))
  // A bare name on a line is the program the shell finds for it. A path is a file somebody chose, and nothing here
  // has looked at that file: `./ls` and `/tmp/build/ls` share a last word with `ls` and nothing else. The row still
  // answers, as the best account of what a program of that name does, but not as one that was checked. A consumer
  // that has resolved the program itself hands in `{ program, argv }` and keeps the row's own confidence.
  const named = step.argv[0]!.includes('/') && read.key !== null
  const e = named ? { ...read, facts: merge(read.facts, { confidence: 'derived', source: 'name-fallback' }) } : read
  const joined = step.after ? { after: step.after } : {}
  if (!step.redirects.length) return { ...e, ...joined }

  const writes = step.redirects.filter((r) => r.op !== '<')
  let facts = e.facts
  // The shell itself opens a connection for these two names, whatever the program is: `echo x > /dev/tcp/host/80`
  // sends `x` to that host. That is the line's grammar, like the redirection, not a reading of an argument.
  const sockets = step.redirects.filter((r) => SOCKET.test(r.path))
  if (sockets.length) {
    facts = merge(facts, { network: 'arbitrary', ...(sockets.some((r) => r.op !== '<') ? { effect: ['transmit'] as Effect[] } : {}) })
  }
  if (writes.length) {
    facts = merge(facts, {
      effect: ['create', 'write'],
      reversible: writes.some((w) => w.op === '>') ? 'no' : 'unknown',
      ...(writes.some((w) => w.op === '>>') ? { repeatSafe: false } : {}),
    })
  }
  if (writes.length !== step.redirects.length) facts = merge(facts, { effect: ['read'] })

  const parts: Part[] = [...partsOf(facts, e.args)]
  for (const r of step.redirects) {
    parts.push({ kind: 'text', text: sentOf(r) })
    parts.push({ kind: 'values', values: [r.path], role: 'path', flag: `${r.fd ?? ''}${r.op}` })
    parts.push({ kind: 'text', text: '.' })
  }
  const args: ArgSlot[] = [
    ...e.args,
    ...step.redirects.map((r, n) => ({
      index: step.argv.length + n,
      value: r.path,
      role: 'path' as Role,
      flag: `${r.fd ?? ''}${r.op}`,
      ...(r.fd ? { fd: r.fd } : {}),
    })),
  ]
  return { ...e, facts, args, parts, sentence: flatten(parts), ...joined }
}

/** A line that runs several commands: every step answered on its own, and all of them widened into one fact set. */
function lineOf(registry: Registry, input: string, read: Step[]): Explanation {
  const steps = read.map((step) => stepOf(registry, step))
  const folded = steps.reduce<Facts>((acc, e) => widenBy(acc, e.facts), MANY)
  const facts = merge(folded, { says: MANY.says })

  const parts: Part[] = []
  for (const [n, step] of steps.entries()) {
    if (n > 0) parts.push({ kind: 'text', text: CONNECTIVE[step.after ?? ';'] })
    parts.push(...step.parts)
  }
  const attribution = steps.reduce<Attribution[]>((acc, e) => unionByPack(acc, e.attribution), [])
  return {
    program: input,
    name: input,
    key: null,
    origin: null,
    facts,
    sentence: flatten(parts),
    parts,
    args: [],
    escalated: [],
    attribution,
    steps,
  }
}

export type Explainer = ((input: Input) => Explanation) & { registry: Registry }

/**
 * Facts about one command, from its resolved program path and its argv, answered out of the packs given here.
 * Nothing is read from the agent that asked for it, and nothing is inferred from the text of an argument.
 *
 * Every pack is validated and every conflict settled while this is called, so the explainer it returns does no
 * trust checking and no resolution of its own: it reads a flat table.
 */
export function createExplainer(opts: RegistryOptions): Explainer {
  const registry = buildRegistry(opts)

  const explain = (input: Input): Explanation => {
    if (typeof input !== 'string') {
      return at(registry, input.program, input.argv.length ? input.argv : [basename(input.program)], 0)
    }
    const read = tokenize(input)
    if (!read.ok) {
      return {
        program: input,
        name: input,
        key: null,
        origin: null,
        facts: UNREAD_LINE,
        ...told(UNREAD_LINE, []),
        args: [],
        escalated: [],
        attribution: [],
      }
    }
    const only = read.steps.length === 1 ? read.steps[0]! : undefined
    return only ? stepOf(registry, only) : lineOf(registry, input, read.steps)
  }

  return Object.assign(explain, { registry })
}
