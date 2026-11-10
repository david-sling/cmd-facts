import type { Entry, Rule } from './entry.ts'
import { merge } from './facts.ts'
import type { Facts } from './facts.ts'
import type { Pack } from './pack.ts'

export type Row = { name: string; rule: Rule; facts: Facts }

/**
 * Every fact set a pack can produce, including the ones a flag rule produces. Used by the lints — the built-in
 * table's own, and whatever a pack author wants to hold their rows to.
 */
export function rows(pack: Pack): Row[] {
  const out: Row[] = []
  const add = (name: string, rule: Rule) => {
    out.push({ name, rule, facts: rule.facts })
    for (const f of rule.flags ?? []) out.push({ name: `${name} ${f.flags[0]}`, rule, facts: merge(rule.facts, f.facts) })
  }
  for (const [name, entry] of Object.entries(pack.commands) as [string, Entry][]) {
    add(name, entry)
    for (const g of entry.globals ?? []) {
      if (Object.keys(g.facts).length) out.push({ name: `${name} ${g.flags[0]}`, rule: entry, facts: merge(entry.facts, g.facts) })
    }
    for (const [word, sub] of Object.entries(entry.sub ?? {})) add(`${name} ${word}`, sub)
  }
  return out
}
