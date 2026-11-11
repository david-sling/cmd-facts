import { merge } from './facts.ts'
import type { Entry, Rule } from './entry.ts'
import { validate } from './pack.ts'
import type { Pack } from './pack.ts'

/** Which pack a row came from, and whether the consumer vouched for it. */
export type Origin = { pack: string; version: string; trusted: boolean }

export type Found = { key: string; entry: Entry; origin: Origin; trimmed: boolean }

export type Registry = {
  /** Every pack that was loaded, in the order given. Not the same as the packs that answered a given line. */
  packs: Origin[]
  lookup(name: string): Found | undefined
}

export type RegistryOptions = {
  /**
   * The packs to answer from, in order. There is no default and no discovery: nothing is read from disk, from an
   * environment variable or from a directory, because a file that can appear without a push is a vote on what a
   * command means. Pass `BUILTIN` to get the curated table.
   */
  packs: Pack[]
  /**
   * Pack names whose rows keep the confidence they were written with. Everything else arrives `derived`, so a
   * consumer gating on `verified` never auto-approves a claim nobody vouched for. Trusting a pack accepts its
   * silences as well as its claims: a row that fails to say it hands over reads as a row that does not.
   */
  trust?: string[]
  /** Command names nobody answers for. They resolve to `UNKNOWN`, the widest floor, not to a substitute. */
  exclude?: string[]
  /** Command name to the pack that wins it. Required before any pack can shadow a row another pack already holds. */
  override?: Record<string, string>
}

const VERSION_SUFFIX = /^([A-Za-z_][A-Za-z_-]*?)[0-9][0-9.]*$/

const stampRule = <T extends Rule>(rule: T): T => ({ ...rule, facts: merge(rule.facts, { confidence: 'derived', source: 'plugin' }) })

/**
 * Lower an untrusted pack's rows to `derived`. It goes through `merge`, which can only widen, so a pack cannot raise
 * its own confidence, clear its own opacity or soften a row on the way in. Flag overlays need no stamp of their own:
 * `merge` takes the worse confidence of the two, and the row underneath is already lowered.
 */
const stamp = (entry: Entry, trusted: boolean): Entry => {
  if (trusted) return entry
  const stamped = stampRule(entry)
  if (!entry.sub) return stamped
  return { ...stamped, sub: Object.fromEntries(Object.entries(entry.sub).map(([word, rule]) => [word, stampRule(rule)])) }
}

/**
 * Resolve a set of packs into the single table `explain()` reads. Everything a pack can influence is settled here,
 * once, before the first command is explained: a misconfigured registry fails at startup rather than at the moment
 * someone is looking at an approval prompt.
 */
export function buildRegistry(opts: RegistryOptions): Registry {
  const packs = opts.packs ?? []
  const trust = new Set(opts.trust ?? [])
  const exclude = new Set(opts.exclude ?? [])
  const override = opts.override ?? {}

  if (!packs.length) throw new Error('A registry needs at least one pack. Pass `BUILTIN` for the curated table.')

  const seen = new Set<string>()
  for (const pack of packs) {
    if (seen.has(pack.name)) throw new Error(`\`${pack.name}\` was given twice. A pack name has to be unique within one registry.`)
    seen.add(pack.name)
  }
  for (const name of trust) if (!seen.has(name)) throw new Error(`\`trust\` names \`${name}\`, which is not one of the packs given.`)
  for (const name of Object.values(override)) if (!seen.has(name)) throw new Error(`\`override\` names \`${name}\`, which is not one of the packs given.`)

  const claims = new Map<string, Array<{ entry: Entry; origin: Origin }>>()
  for (const pack of packs) {
    const problems = validate(pack)
    if (problems.length) {
      const lines = problems.map((p) => `  ${p.where}: ${p.says}`).join('\n')
      throw new Error(`\`${pack.name}\` is not a pack this library will load:\n${lines}`)
    }
    const origin: Origin = { pack: pack.name, version: pack.version, trusted: trust.has(pack.name) }
    for (const [name, entry] of Object.entries(pack.commands)) {
      if (exclude.has(name)) continue
      const held = claims.get(name) ?? []
      held.push({ entry, origin })
      claims.set(name, held)
    }
  }

  for (const name of Object.keys(override)) {
    if (!claims.has(name)) throw new Error(`\`override\` settles \`${name}\`, which no loaded pack claims. An excluded command is claimed by nobody.`)
  }

  const table = new Map<string, { entry: Entry; origin: Origin }>()
  for (const [name, held] of claims) {
    const winner = Object.hasOwn(override, name) ? override[name] : undefined
    let chosen = held[0]!
    if (winner !== undefined) {
      const picked = held.find((c) => c.origin.pack === winner)
      if (!picked) throw new Error(`\`override\` gives \`${name}\` to \`${winner}\`, which does not claim it.`)
      chosen = picked
    } else if (held.length > 1) {
      const names = held.map((c) => `\`${c.origin.pack}\``).join(' and ')
      throw new Error(`\`${name}\` is claimed by ${names}. Name the one that wins in \`override\`, or silence it with \`exclude\`.`)
    }
    table.set(name, { entry: stamp(chosen.entry, chosen.origin.trusted), origin: chosen.origin })
  }

  const lookup = (name: string): Found | undefined => {
    const exact = table.get(name)
    if (exact) return { key: name, entry: exact.entry, origin: exact.origin, trimmed: false }
    const stem = VERSION_SUFFIX.exec(name)?.[1]
    const held = stem ? table.get(stem) : undefined
    return held?.entry.versioned ? { key: stem!, entry: held.entry, origin: held.origin, trimmed: true } : undefined
  }

  return { packs: packs.map((p) => ({ pack: p.name, version: p.version, trusted: trust.has(p.name) })), lookup }
}
