/**
 * Cross-checks the curated table's flag grammar against Fig's autocomplete specs (`@withfig/autocomplete`, MIT),
 * and measures coverage against everything Fig completes. Dev-time only: nothing from Fig reaches the published
 * table, because a spec knows which flags take values, not what a command does to a computer.
 *
 * Three kinds of grammar finding, in order of harm:
 *   conflict — the table says a flag takes no value where Fig says it must, or the reverse. One of the two is
 *              wrong, and if it is the table, a value is being read as an operand or an operand swallowed.
 *   missing  — Fig says a flag requires a value and the table does not declare it at all, so `parse()` would
 *              read that value as an operand. Expected while coverage grows; each one is still a misparse.
 *   unlisted — the table declares a flag spelling Fig does not list. Usually Fig being incomplete; occasionally
 *              a typo in the table.
 *
 * Exits non-zero on conflicts, so it can gate CI. Missing flags and coverage gaps are reported, not failed on:
 * they are the milestone, not a regression.
 */

import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import allSpecNames from '@withfig/autocomplete'
import { DEV, FILES, NET, SECRETS, SYSTEM } from '../src/data/index.ts'
import type { Entry, FlagRule, Rule } from '../src/entry.ts'

// The rows written by hand, without the same-program aliases: an alias's grammar belongs to the row it points at.
const CURATED: Record<string, Entry> = { ...FILES, ...SYSTEM, ...NET, ...SECRETS, ...DEV }

// The slice of a Fig spec this check reads. Everything else a spec carries is completion UI.
type FigOption = { name: string | string[]; args?: FigArg | FigArg[] }
type FigArg = { isOptional?: boolean }
type FigSpec = { name?: string | string[]; options?: FigOption[]; subcommands?: FigSpec[] }

const require = createRequire(import.meta.url)
// The package's exports map hides everything but its index, so the spec files are reached from where that resolves.
const BUILD = pathToFileURL(require.resolve('@withfig/autocomplete')).href.replace(/index\.js$/, '')

async function specOf(name: string): Promise<FigSpec | undefined> {
  try {
    return (await import(`${BUILD}${name}.js`)).default as FigSpec
  } catch {
    return undefined
  }
}

const namesOf = (name: string | string[] | undefined): string[] => (name === undefined ? [] : Array.isArray(name) ? name : [name])

// A spec sometimes spells an option with its value attached (`--color[=WHEN]`); the flag is the part before it.
const spellingOf = (raw: string): string => raw.replace(/[=[].*$/, '')

/** Whether a Fig option must be followed by a value. An optional one may stand alone, so nothing is claimed. */
const requiresValue = (o: FigOption): boolean => {
  if (!o.args) return false
  const args = Array.isArray(o.args) ? o.args : [o.args]
  return args.some((a) => !a.isOptional)
}

type Declared = { takesValue: Set<string>; bare: Set<string> }

/** Every flag spelling a rule declares, split by whether the table says it consumes the next word. */
function declaredOf(rule: Rule, globals: FlagRule[] = []): Declared {
  const takesValue = new Set<string>(Object.keys(rule.values ?? {}))
  const bare = new Set<string>()
  for (const r of [...(rule.flags ?? []), ...globals]) {
    for (const f of r.flags) (r.takesValue ? takesValue : bare).add(f)
  }
  return { takesValue, bare }
}

/**
 * Places where a Fig spec is wrong about its own command, each checked against the command's manual, so a known
 * upstream error does not hold the exit gate red. Keyed `command flag`; drop a line once upstream fixes it.
 */
const FIG_WRONG = new Set([
  'curl -x', // Fig declares no args, but its own description reads "[protocol://]host[:port] Use this proxy".
  'node -p', // `node -p "1+1"` evaluates and prints the next word; Fig declares no args.
])

type Findings = { conflicts: string[]; missing: string[]; unlisted: string[] }

function compare(declared: Declared, options: FigOption[], command: string): Findings {
  const conflicts: string[] = []
  const missing: string[] = []
  const listed = new Set<string>()

  for (const o of options) {
    const spellings = namesOf(o.name).map(spellingOf)
    // `--` ends the flags; `parse()` reads it as grammar, never as an option, whatever a spec lists it as.
    if (spellings.includes('--')) continue
    if (spellings.some((s) => FIG_WRONG.has(`${command} ${s}`))) continue
    for (const s of spellings) listed.add(s)
    const label = spellings.join('/')
    const needs = requiresValue(o)
    const asValue = spellings.some((s) => declared.takesValue.has(s))
    const asBare = spellings.some((s) => declared.bare.has(s))
    if (needs && asBare && !asValue) conflicts.push(`${label} requires a value; the table reads it as bare`)
    else if (!o.args && asValue) conflicts.push(`${label} takes no value; the table consumes the next word`)
    else if (needs && !asValue && !asBare) missing.push(label)
  }

  const unlisted = [...declared.takesValue, ...declared.bare].filter((s) => !listed.has(s)).sort()
  return { conflicts, missing, unlisted }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

async function main() {
  let conflictCount = 0
  let missingCount = 0
  const unmatched: string[] = []

  for (const [name, entry] of Object.entries(CURATED).sort(([a], [b]) => a.localeCompare(b))) {
    const spec = await specOf(name)
    if (!spec) {
      unmatched.push(name)
      continue
    }

    const lines: string[] = []
    const report = (where: string, f: Findings) => {
      if (f.conflicts.length) lines.push(`  ${where} CONFLICT: ${f.conflicts.join('; ')}`)
      if (f.missing.length) lines.push(`  ${where} missing value flags (${f.missing.length}): ${f.missing.join(', ')}`)
      if (f.unlisted.length) lines.push(`  ${where} declared but not in fig: ${f.unlisted.join(', ')}`)
      conflictCount += f.conflicts.length
      missingCount += f.missing.length
    }

    report('[top]', compare(declaredOf(entry, entry.globals), spec.options ?? [], name))

    if (entry.sub) {
      const figSubs = spec.subcommands ?? []
      for (const [word, rule] of Object.entries(entry.sub)) {
        const figSub = figSubs.find((s) => namesOf(s.name).includes(word))
        if (!figSub) {
          lines.push(`  [${word}] not a subcommand fig lists`)
          continue
        }
        report(`[${word}]`, compare(declaredOf(rule), figSub.options ?? [], name))
      }
      const covered = Object.keys(entry.sub).length
      if (figSubs.length) lines.push(`  subcommands: ${covered} covered of ${figSubs.length} in fig`)
    }

    if (lines.length) console.log(`== ${name} ==\n${lines.join('\n')}\n`)
  }

  const names = (allSpecNames as string[]).filter((n) => !n.includes('/'))
  const curated = new Set(Object.keys(CURATED))
  const coveredInFig = names.filter((n) => curated.has(n))
  console.log('— coverage —')
  console.log(`fig completes ${names.length} commands; the table answers for ${coveredInFig.length} of them (${Math.round((coveredInFig.length / names.length) * 100)}%)`)
  if (unmatched.length) console.log(`curated here, no fig spec: ${unmatched.join(', ')}`)
  console.log(`\n${plural(conflictCount, 'conflict')}, ${plural(missingCount, 'missing value flag')}`)

  if (conflictCount) process.exit(1)
}

await main()
