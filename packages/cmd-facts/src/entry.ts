import { sortEffects } from './facts.ts'
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
  /**
   * Roles for the positional arguments wherever this flag is on the line, in place of the row's own: `grep -e foo
   * notes.txt` takes its pattern from the flag, so every operand is a file. Never a `command`, and never on a row
   * whose operands hold one, because the handover is found while the line is still being read.
   */
  operands?: Role[]
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

/** A `values` map giving every one of these flags the same role. Only flags whose value is required belong here. */
export const valuesOf = (role: Role, flags: string[]): Record<string, Role> => Object.fromEntries(flags.map((f) => [f, role]))

const COMMON = {
  reversible: 'yes',
  network: 'none',
  privilege: 'none',
  touchesCredentials: false,
  repeatSafe: true,
  confidence: 'verified',
  source: 'curated',
} as const

type Over = Partial<Omit<Facts, 'opaque' | 'effect' | 'effectAtLeast' | 'handsOverTo' | 'says'>> & { effect?: Effect[] }

/** A row for a command this library can account for in full. */
export const fact = (says: string, over: Over = {}): Facts => ({
  ...COMMON,
  ...over,
  effect: sortEffects(over.effect ?? ['read']),
  opaque: false,
  says,
})

/**
 * A row for a command that hands over to something this library cannot see. `handsOverTo` names what that is, in the
 * same plain register as `says`. Such a row can never claim to be reversible or safe to repeat.
 */
export const opaqueFact = (says: string, handsOverTo: string, over: Over = {}): Facts => ({
  ...COMMON,
  ...over,
  reversible: over.reversible === 'no' ? 'no' : 'unknown',
  repeatSafe: false,
  effectAtLeast: sortEffects(over.effect ?? ['execute']),
  opaque: true,
  handsOverTo,
  says,
})
