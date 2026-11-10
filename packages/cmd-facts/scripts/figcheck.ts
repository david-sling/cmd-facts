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
 * And one count that is not a finding about grammar: the flags Fig lists that a row has not reviewed, in none of
 * `flags`, `values` or `plain`. A line carrying one is answered from the program's widest row at `derived`, which is
 * honest, so each is a place where the table could say more rather than a place where it says something wrong.
 * `--unreviewed` lists them.
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

/**
 * Whether a Fig option must be followed by a value. An optional one may stand alone, so nothing is claimed. Some specs
 * write the value into the name instead of declaring it (`--tries=NUMBER`); `--color[=WHEN]` is optional.
 */
const requiresValue = (o: FigOption): boolean => {
  if (namesOf(o.name).some((n) => /^[^[]*=/.test(n))) return true
  if (!o.args) return false
  const args = Array.isArray(o.args) ? o.args : [o.args]
  return args.some((a) => !a.isOptional)
}

type Declared = { takesValue: Set<string>; bare: Set<string>; attached: Set<string>; bundles: boolean }

/** Every flag spelling a rule declares, split by whether the table says it consumes the next word. */
function declaredOf(rule: Rule, globals: FlagRule[] = []): Declared {
  const takesValue = new Set<string>(Object.keys(rule.values ?? {}))
  const bare = new Set<string>()
  const attached = new Set<string>()
  for (const r of [...(rule.flags ?? []), ...globals]) {
    for (const f of r.flags) (r.takesValue ? takesValue : r.attached ? attached : bare).add(f)
  }
  for (const f of rule.plain ?? []) bare.add(f)
  return { takesValue, bare, attached, bundles: rule.flagStyle !== 'words' }
}

/**
 * Places where a Fig spec is wrong about its own command, each checked against the command's manual, so a known
 * upstream error does not hold the exit gate red or pad the missing list. Keyed `command [subcommand] flag`; drop a
 * line once upstream fixes it. Most are a value Fig marks required that is optional, or a switch Fig gives a value.
 * A key without a subcommand covers the flag on every subcommand of that command.
 */
const FIG_WRONG = new Set([
  'curl -x', // Fig declares no args, but its own description reads "[protocol://]host[:port] Use this proxy".
  'curl --tlspassword', // Takes the password; Fig declares no args.
  'node -p', // `node -p "1+1"` evaluates and prints the next word; Fig declares no args.
  'docker build -t', // `docker build -t name .` names the image; Fig declares no args.
  'pnpm -w', // `--workspace-root` is a switch; Fig gives it a value.
  // git: these take a value only after `=`, or are switches whose following word is an operand.
  'git log --follow',
  ...['-d', '-D', '-m', '-M', '--edit-description', '--merged', '--no-merged', '--abbrev', '-t', '--no-track'].map((f) => `git branch ${f}`),
  ...['--local', '--get-regexp', '--get-urlmatch', '--get-colorbool', '--get-color'].map((f) => `git config ${f}`),
  'grep --color', // `--color[=when]`: optional.
  'ls --color', // `--color[=when]`: optional.
  'make -j', // The job count is optional.
  'make -B', // Switches.
  'make -e',
  'make -N',
  'mkdir -Z', // A switch; only `--context=` takes a value.
  ...['-f', '-F', '-g', '-i', '-r', '-T', '-x', '-s'].map((f) => `lsof ${f}`), // Optional values; `lsof -i -P` is the usual form.
  'npm --verbose', // Switches.
  'npm --audit',
  // pip: each takes a value in pip's own `--help`; Fig's spec leaves the args off these subcommands.
  ...['-c', '-r', '--no-binary', '--python-version', '--extra-index-url'].map((f) => `pip download ${f}`),
  'pip list --format',
  'pip list --extra-index-url',
  'pip freeze -r',
  'pip freeze --path',
  ...['-f', '-s', '-F', '-i'].map((f) => `ln ${f}`), // Switches.
  'readlink -f', // A switch.
  // BSD sed requires a backup ending after these, GNU sed takes one only attached; the row reads neither as a value.
  'sed -i',
  'sed -I',
  'zip -d', // A switch: the entries to remove are the operands after the packed file.
  'crontab -u', // Takes the account whose schedule it works on; Fig declares no args.
  ...['-a', '-b', '-c', '-u'].map((f) => `pmset ${f}`), // Switches choosing which power source a setting applies to.
  'sysctl -e', // A switch.
  'pkill -q', // A switch on macOS; only GNU's `--queue` takes a value.
  'nc -l', // A switch: the port to wait on is the operand.
  'codesign --extract-certificates', // The prefix is optional, so it only counts after `=`.
  'traceroute -w', // Takes the time to wait; Fig declares no args.
  ...['-d', '-O', '-F'].map((f) => `rsync ${f}`), // Switches.
  'ps -a', // A switch on macOS.
  'top -b', // Not a macOS option; a switch where it exists.
  'unzip -l', // Switches.
  'unzip -c',
  'unzip -0',
])

/** A bundle Fig spells out as its own option (`git commit -am`) is covered when its last letter takes a value. */
const bundled = (declared: Declared, s: string): boolean =>
  declared.bundles && /^-[A-Za-z0-9]{2,}$/.test(s) && declared.takesValue.has(`-${s.at(-1)}`)

type Findings = { conflicts: string[]; missing: string[]; unlisted: string[]; unreviewed: string[]; options: number }

function compare(declared: Declared, options: FigOption[], where: string): Findings {
  const conflicts: string[] = []
  const missing: string[] = []
  const unreviewed: string[] = []
  const listed = new Set<string>()
  let seen = 0

  for (const o of options) {
    // `parse()` reads only a word starting with `-` as an option; `dd`'s `if=` and `lsof`'s `+d` are operands to it.
    const spellings = namesOf(o.name).map(spellingOf).filter((s) => s.startsWith('-'))
    for (const s of spellings) listed.add(s)
    // `--` ends the flags; `parse()` reads it as grammar, never as an option, whatever a spec lists it as.
    if (!spellings.length || spellings.includes('--')) continue
    seen++
    const known = spellings.some((s) => declared.takesValue.has(s) || declared.bare.has(s) || declared.attached.has(s) || bundled(declared, s))
    if (!known) unreviewed.push(spellings.join('/'))
    const command = where.split(' ')[0]
    if (spellings.some((s) => FIG_WRONG.has(`${where} ${s}`) || FIG_WRONG.has(`${command} ${s}`))) continue
    const label = spellings.join('/')
    const needs = requiresValue(o)
    const asValue = spellings.some((s) => declared.takesValue.has(s) || bundled(declared, s))
    const asBare = spellings.some((s) => declared.bare.has(s))
    // A value written into the spec's own name (`--opt=VALUE`) is the attached form; one declared as args is not.
    if (spellings.some((s) => declared.attached.has(s))) {
      if (o.args) conflicts.push(`${label} takes its value as the next word; the table takes one only attached`)
      continue
    }
    if (needs && asBare && !asValue) conflicts.push(`${label} requires a value; the table reads it as bare`)
    else if (!needs && !o.args && asValue) conflicts.push(`${label} takes no value; the table consumes the next word`)
    else if (needs && !asValue && !asBare) missing.push(label)
  }

  const unlisted = [...declared.takesValue, ...declared.bare].filter((s) => !listed.has(s)).sort()
  return { conflicts, missing, unlisted, unreviewed, options: seen }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

async function main() {
  let conflictCount = 0
  let missingCount = 0
  let unreviewedCount = 0
  let optionCount = 0
  const listing = process.argv.includes('--unreviewed')
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
      if (f.unreviewed.length) {
        const which = listing ? `: ${f.unreviewed.join(', ')}` : ''
        lines.push(`  ${where} unreviewed: ${f.unreviewed.length} of ${f.options} fig lists${which}`)
      }
      conflictCount += f.conflicts.length
      missingCount += f.missing.length
      unreviewedCount += f.unreviewed.length
      optionCount += f.options
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
        report(`[${word}]`, compare(declaredOf(rule), figSub.options ?? [], `${name} ${word}`))
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
  console.log(`${unreviewedCount} of the ${optionCount} flags fig lists for these rows are unreviewed, and answer derived`)

  if (conflictCount) process.exit(1)
}

await main()
