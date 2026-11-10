import { merge, sortEffects } from './facts.ts'
import type { Effect, Facts, Overlay } from './facts.ts'

// What an argv position is, so a consumer can resolve and show the thing rather than parse it out of a string.
export type Role =
  | 'path'
  | 'host'
  | 'url'
  | 'pid'
  | 'package'
  | 'domain'
  | 'user'
  | 'mode'
  | 'service'
  | 'signal'
  | 'device'
  | 'pattern'
  | 'command'
  | 'text'
  | 'unknown'

export const ROLES: Role[] = [
  'path',
  'host',
  'url',
  'pid',
  'package',
  'domain',
  'user',
  'mode',
  'service',
  'signal',
  'device',
  'pattern',
  'command',
  'text',
  'unknown',
]

/** A flag that changes the fact set rather than the detail. Anything merged here may only widen the claim. */
export type FlagRule = {
  flags: string[]
  facts: Overlay
  takesValue?: boolean
  role?: Role
}

export type Rule = {
  facts: Facts
  /** `words` turns off single-dash bundling for programs whose flags are whole words (`find -exec`, `log show`). */
  flagStyle?: 'posix' | 'words'
  flags?: FlagRule[]
  /** Roles for the positional arguments; the last entry repeats for the rest. */
  operands?: Role[]
  /** Flags that take a value, where the value's role matters but the flag changes nothing else. */
  values?: Record<string, Role>
  /**
   * Flags that were looked at and found to change nothing the fields carry, and to take no value: `ls -l`, `rm -v`.
   * The table is closed: a flag that is in none of `flags`, `values` or here has not been read, and the line it is on
   * is answered from the program's widest row at `derived`, with the flag named in `unread`.
   */
  plain?: string[]
  /**
   * The command this one hands over to runs on this computer, and is carried as separate words on this same line,
   * so it can be looked up with the same tables. Off by default, and deliberately so: a nested command held in one
   * string would have to be split to be read, and splitting a string is reading meaning out of argument text. A
   * nested command that runs on another computer is not a fact about this one.
   */
  nestedHere?: boolean
  /** `env` carries its own settings as leading `NAME=value` words before the command. Part of its grammar, not a guess. */
  assignmentsFirst?: boolean
  /**
   * `tar xf` carries its flags as a bare first word, the old option style, so that word is read as if it were
   * `-xf` rather than as the first thing the command was pointed at.
   */
  bareFlagsFirst?: boolean
}

export type Entry = Rule & {
  /** The program answers to a version-suffixed name too: `python3` reaches the `python` row, `base64` never reaches `base`. */
  versioned?: boolean
  /**
   * Options the program takes before its subcommand (`git -c pager.log=x log`), stepped over so the word after them
   * still resolves to its row. One that is not declared here hides the subcommand, and the base row then answers at
   * `derived`. A global that can change what runs carries facts, read the same way as a flag rule's.
   */
  globals?: FlagRule[]
  sub?: Record<string, Rule>
}

const WRITTEN = { confidence: 'verified', source: 'curated' } as const

type Optional = Partial<Omit<Facts, 'opaque' | 'effect' | 'effectAtLeast' | 'handsOverTo' | 'says'>>

// Every field that says how far a command reaches is written on the row. None of them has a default: a field left
// out would quietly read as the narrowest answer, and a row that forgot a field is not a row that measured it.
type Over = Optional & Pick<Facts, 'reversible' | 'network' | 'privilege' | 'touchesCredentials' | 'repeatSafe'> & {
  effect: Effect[]
}

/**
 * Runs on this computer alone, as the account that started it, and reaches no secrets. A row spreads this only where
 * all three were checked: it is a claim about the command, not a default for it.
 */
export const LOCAL = { network: 'none', privilege: 'none', touchesCredentials: false } as const

/** Only looks: reads something on this computer and changes nothing, so there is nothing to undo or repeat. */
export const LOOKS = { ...LOCAL, effect: ['read'] as Effect[], reversible: 'yes', repeatSafe: true } as const

/** A row for a command this library can account for in full. */
export const fact = (says: string, over: Over): Facts => ({
  ...WRITTEN,
  ...over,
  effect: sortEffects(over.effect),
  opaque: false,
  says,
})

// An opaque row is never reversible or safe to repeat, so those two are not asked for. Its effects are a floor, and
// running the program it hands over to is the least of them.
type OpaqueOver = Optional & Pick<Facts, 'network' | 'privilege' | 'touchesCredentials'> & { effect?: Effect[] }

/**
 * A row for a command that hands over to something this library cannot see. `handsOverTo` names what that is, in the
 * same plain register as `says`. Such a row can never claim to be reversible or safe to repeat.
 */
export const opaqueFact = (says: string, handsOverTo: string, over: OpaqueOver): Facts => ({
  ...WRITTEN,
  ...over,
  reversible: over.reversible === 'no' ? 'no' : 'unknown',
  repeatSafe: false,
  effectAtLeast: sortEffects(over.effect ?? ['execute']),
  opaque: true,
  handsOverTo,
  says,
})

/**
 * Everything a row can reach with the flags the table knows for it: its own facts widened by every flag rule's. The
 * sentence stays the row's own. This is what a line is answered from where it carries something the table has not
 * read, so it has to be at least as wide as anything the row was written to say.
 */
export function reach(rule: Rule): Facts {
  let out = rule.facts
  for (const f of rule.flags ?? []) {
    const { says: _says, tell: _tell, note: _note, docs: _docs, ...widen } = f.facts
    out = merge(out, widen)
  }
  return out
}
