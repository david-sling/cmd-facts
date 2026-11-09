import { COMMANDS } from './data/index.ts'
import type { Entry, Rule } from './entry.ts'
import type { Facts } from './facts.ts'

export type Row = { name: string; rule: Rule; facts: Facts }

/** Every fact set the package ships, including the ones a flag rule produces. Used by the lints. */
export function rows(): Row[] {
  const out: Row[] = []
  const add = (name: string, rule: Rule) => {
    out.push({ name, rule, facts: rule.facts })
    for (const f of rule.flags ?? []) out.push({ name: `${name} ${f.flags[0]}`, rule, facts: { ...rule.facts, ...f.facts } as Facts })
  }
  for (const [name, entry] of Object.entries(COMMANDS) as [string, Entry][]) {
    add(name, entry)
    for (const [word, sub] of Object.entries(entry.sub ?? {})) add(`${name} ${word}`, sub)
  }
  return out
}
