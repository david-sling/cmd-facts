import { createExplainer } from './explain.ts'
import { BUILTIN } from './data/index.ts'

export { createExplainer, basename, UNKNOWN } from './explain.ts'
export type { ArgSlot, Attribution, Explainer, Explanation } from './explain.ts'
export { effectsOf, isComplete, merge, sortEffects, EFFECTS, REVERSIBLE, NETWORK, PRIVILEGE, CONFIDENCE, RANK } from './facts.ts'
export type { Blind, Confidence, Effect, Facts, Network, Overlay, Privilege, Reversible, Source, Transparent } from './facts.ts'
export { fact, opaqueFact, ROLES } from './entry.ts'
export type { Entry, FlagRule, Role, Rule } from './entry.ts'
export { validate } from './pack.ts'
export type { Pack, Problem } from './pack.ts'
export { buildRegistry } from './registry.ts'
export type { Found, Origin, Registry, RegistryOptions } from './registry.ts'
export { rows } from './rows.ts'
export type { Row } from './rows.ts'
export { BUILTIN, COMMANDS } from './data/index.ts'

/**
 * The curated table, wired the way most consumers want it. Anything else — a pack of your own, a command silenced,
 * a row handed to a pack instead of the built-in one — goes through `createExplainer`, where every one of those is
 * a line in your own source rather than a file that can appear on disk.
 */
export const explain = createExplainer({ packs: [BUILTIN], trust: [BUILTIN.name] })
