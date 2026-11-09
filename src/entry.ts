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
}

export type Entry = Rule & {
  /** The program answers to a version-suffixed name too: `python3` reaches the `python` row, `base64` never reaches `base`. */
  versioned?: boolean
  sub?: Record<string, Rule>
}

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
  reversible: 'unknown',
  repeatSafe: false,
  effectAtLeast: sortEffects(over.effect ?? ['execute']),
  opaque: true,
  handsOverTo,
  says,
})
