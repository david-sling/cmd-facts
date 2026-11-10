// The schema. Everything a consumer can read; `says` is one view over it, not the product.
// Deliberately absent: any single risk or danger score, and any string a consumer could run to undo something.

import type { Role } from './entry.ts'

export type Effect =
  | 'read'
  | 'write'
  | 'create'
  | 'delete'
  /** Stops something that was already running. Added to the draft inventory for `kill`, `docker stop`, `diskutil unmount`. */
  | 'terminate'
  | 'install'
  | 'configure'
  | 'transmit'
  | 'execute'
  | 'elevate'

export type Reversible = 'yes' | 'no' | 'with-backup' | 'unknown'
export type Network = 'none' | 'known-host' | 'arbitrary' | 'listens'
export type Privilege = 'none' | 'admin' | 'root'
export type Confidence = 'verified' | 'derived' | 'unknown'
/**
 * One piece of a sentence that names what the command was pointed at. A slot is filled from `args`, and the values
 * are handed over separately rather than pasted in: argument text is attacker-controlled, and the sentence a person
 * is about to trust is the last place to put it. Keeping them apart also lets a consumer render a value as a value —
 * shortened, in its own type, visibly not prose — so a file named `approved by admin, no action needed` cannot read
 * as part of the sentence, and lets it say "40 files" where naming all forty would not fit.
 */
export type Slot = {
  role: Role
  /**
   * Which arguments of that role this slot stands for. `first` is the default. `last` and `all-but-last` are what a
   * row needs where the final argument is the destination and the rest are sources, as in `cp a b c dest`.
   */
  which?: 'first' | 'last' | 'all' | 'all-but-last' | number
  /**
   * `host` shows the host of a web address rather than the whole address. Reductions are a closed list on purpose:
   * each one is a way to read an argument wrong, and a slot shows what was written unless a row asks otherwise.
   */
  show?: 'host'
}

export type Segment = string | Slot

export type Source =
  | 'curated'
  | 'curated+flags'
  | 'name-fallback'
  | 'subcommand-miss'
  /** The line carries a flag or a word the row does not account for, named in `unread`. */
  | 'unread'
  | 'nested'
  /** A row from a pack the consumer did not vouch for. It arrives `derived` whatever it was written as. */
  | 'plugin'
  | 'unknown'

type Common = {
  reversible: Reversible
  network: Network
  privilege: Privilege
  /** Reaches secrets by nature of the program, whatever paths it was given. */
  touchesCredentials: boolean
  /** Whether running it twice leaves the same result as running it once. A policy input: a consumer offering a
   *  standing grant ("allow this for the session") should not offer one for a command that is false here. */
  repeatSafe: boolean
  confidence: Confidence
  source: Source
  says: string
  /**
   * `says` with the command's own arguments in it: `['Connects to ', { role: 'host' }, ' and works on it from here.']`.
   * A consumer renders it with `tellOf()`, which falls back to `says` where a row has none or the line carries no
   * argument for a slot. Every row still has `says`, so nothing depends on a row having been given one of these.
   */
  tell?: Segment[]
  /** A consequence the fields cannot carry, about what the command does. Never about mistakes a person might make. */
  note?: string
  docs?: string
}

/** The command does this and nothing else. */
export type Transparent = Common & { opaque: false; effect: Effect[] }

/**
 * The command hands over to something this library cannot see, so every field is a floor rather than a measurement.
 * `effect` is deliberately absent here: reading the complete effect list off an opaque command has to be a type error,
 * not a quiet mistake.
 */
export type Blind = Common & { opaque: true; effectAtLeast: Effect[]; handsOverTo: string }

export type Facts = Transparent | Blind

export const effectsOf = (f: Facts): Effect[] => (f.opaque ? f.effectAtLeast : f.effect)
export const isComplete = (f: Facts) => !f.opaque && f.confidence === 'verified'

export const EFFECTS: Effect[] = [
  'read',
  'write',
  'create',
  'delete',
  'terminate',
  'install',
  'configure',
  'transmit',
  'execute',
  'elevate',
]
export const REVERSIBLE: Reversible[] = ['yes', 'no', 'with-backup', 'unknown']
export const NETWORK: Network[] = ['none', 'known-host', 'arbitrary', 'listens']
export const PRIVILEGE: Privilege[] = ['none', 'admin', 'root']
export const CONFIDENCE: Confidence[] = ['verified', 'derived', 'unknown']

export const sortEffects = (es: Effect[]): Effect[] => EFFECTS.filter((e) => es.includes(e))

/** What a flag rule may add. Every field widens the claim; none of them can narrow it. */
export type Overlay = Partial<Omit<Common, 'confidence'>> & {
  effect?: Effect[]
  opaque?: true
  handsOverTo?: string
  confidence?: Confidence
}

const REVERSIBLE_RANK: Record<Reversible, number> = { yes: 0, 'with-backup': 1, unknown: 2, no: 3 }
const NETWORK_RANK: Record<Network, number> = { none: 0, 'known-host': 1, listens: 2, arbitrary: 3 }
const PRIVILEGE_RANK: Record<Privilege, number> = { none: 0, admin: 1, root: 2 }
const CONFIDENCE_RANK: Record<Confidence, number> = { verified: 0, derived: 1, unknown: 2 }

/**
 * How wide each value is. Exported because anything that compares two fact sets — a pack's own lints, a consumer
 * deciding whether an update made a claim weaker — has to order them the way `merge` does, and the declaration
 * order of the arrays above is not that order.
 */
export const RANK = {
  reversible: REVERSIBLE_RANK,
  network: NETWORK_RANK,
  privilege: PRIVILEGE_RANK,
  confidence: CONFIDENCE_RANK,
} as const

const worse = <T extends string>(rank: Record<T, number>, a: T, b: T | undefined) =>
  b !== undefined && rank[b] > rank[a] ? b : a

/**
 * Lay an overlay over a fact set. A merge may only widen the claim, so a consumer that gated on the narrower facts is
 * never surprised by the wider ones. Handing over is one-way: once a command is opaque it cannot be made clear again,
 * and it cannot claim to be reversible or safe to repeat.
 */
export function merge(base: Facts, over: Overlay): Facts {
  const common: Common = {
    reversible: worse(REVERSIBLE_RANK, base.reversible, over.reversible),
    network: worse(NETWORK_RANK, base.network, over.network),
    privilege: worse(PRIVILEGE_RANK, base.privilege, over.privilege),
    touchesCredentials: base.touchesCredentials || over.touchesCredentials === true,
    repeatSafe: base.repeatSafe && over.repeatSafe !== false,
    confidence: worse(CONFIDENCE_RANK, base.confidence, over.confidence),
    source: over.source ?? base.source,
    says: over.says ?? base.says,
    tell: over.says !== undefined ? over.tell : (over.tell ?? base.tell),
    note: over.note ?? base.note,
    docs: over.docs ?? base.docs,
  }
  const effect = sortEffects([...new Set([...effectsOf(base), ...(over.effect ?? [])])])
  if (!base.opaque && over.opaque !== true) return { ...common, opaque: false, effect }
  const handsOverTo = over.handsOverTo ?? (base.opaque ? base.handsOverTo : 'something this library cannot see')
  // An opaque row cannot promise that anything can be put back, but it may still say that something cannot be.
  const reversible = worse(REVERSIBLE_RANK, 'unknown', common.reversible)
  return { ...common, reversible, repeatSafe: false, opaque: true, effectAtLeast: effect, handsOverTo }
}
