import { describe, expect, it } from 'vitest'
import { COMMANDS } from './data/index.ts'
import { rows } from './rows.ts'
import { effectsOf } from './facts.ts'
import { explain } from './explain.ts'
import type { Facts, Network, Privilege } from './facts.ts'
import type { Role, Rule } from './entry.ts'

const ALL = rows()
const NET_RANK: Record<Network, number> = { none: 0, 'known-host': 1, listens: 2, arbitrary: 3 }
const PRIV_RANK: Record<Privilege, number> = { none: 0, admin: 1, root: 2 }

describe('a fact set holds together', () => {
  it.each(ALL)('$name', ({ facts }) => {
    const effect = effectsOf(facts)
    expect(effect.length).toBeGreaterThan(0)
    if (effect.includes('delete')) expect(facts.reversible).not.toBe('yes')
    if (effect.includes('transmit')) expect(facts.network).not.toBe('none')
    if (effect.includes('elevate')) expect(facts.privilege).not.toBe('none')
    if (facts.privilege === 'root') expect(effect).toContain('elevate')
    if (facts.opaque) {
      expect(facts.reversible).toBe('unknown')
      expect(facts.repeatSafe).toBe(false)
    }
    expect(facts.confidence).toBe('verified')
    expect(facts.source).toBe('curated')
  })
})

describe('a base row can stand in for its subcommands', () => {
  const entries = Object.entries(COMMANDS).filter(([, e]) => e.sub)

  it('every subcommand table has a base program row', () => {
    expect(entries.length).toBeGreaterThan(5)
    for (const [name, entry] of entries) expect(entry.facts.says, name).toBeTruthy()
  })

  // The base row is what an unrecognised subcommand falls back to, so it may not promise anything a known
  // subcommand would break.
  it.each(entries.map(([name, entry]) => ({ name, entry })))('$name', ({ name, entry }) => {
    for (const [word, sub] of Object.entries(entry.sub!)) {
      const where = `${name} ${word}`
      const base = entry.facts
      if (sub.facts.reversible !== 'yes') expect(base.reversible, where).not.toBe('yes')
      if (!sub.facts.repeatSafe) expect(base.repeatSafe, where).toBe(false)
      if (sub.facts.touchesCredentials) expect(base.touchesCredentials, where).toBe(true)
      if (sub.facts.opaque) expect(base.opaque, where).toBe(true)
      expect(NET_RANK[base.network], where).toBeGreaterThanOrEqual(NET_RANK[sub.facts.network])
      expect(PRIV_RANK[base.privilege], where).toBeGreaterThanOrEqual(PRIV_RANK[sub.facts.privilege])
    }
  })
})

describe('the grammar layer is declared honestly', () => {
  const rulesOf = (): Array<{ name: string; rule: Rule }> =>
    Object.entries(COMMANDS).flatMap(([name, entry]) => [
      { name, rule: entry as Rule },
      ...Object.entries(entry.sub ?? {}).map(([word, sub]) => ({ name: `${name} ${word}`, rule: sub })),
    ])

  it('declares every flag with its dash', () => {
    for (const { name, rule } of rulesOf()) {
      for (const f of rule.flags ?? []) for (const flag of f.flags) expect(flag.startsWith('-'), `${name} ${flag}`).toBe(true)
      for (const flag of Object.keys(rule.values ?? {})) expect(flag.startsWith('-'), `${name} ${flag}`).toBe(true)
    }
  })

  // A position that holds another command is the handover itself: a row that can produce one has to be opaque.
  it('only hands a position the `command` role where it admits it cannot see past it', () => {
    for (const { name, rule } of rulesOf()) {
      const fixed: Role[] = [...(rule.operands ?? []), ...Object.values(rule.values ?? {})]
      if (fixed.includes('command')) expect(rule.facts.opaque, name).toBe(true)
      for (const f of rule.flags ?? []) {
        if (f.role === 'command') expect(rule.facts.opaque || f.facts.opaque === true, `${name} ${f.flags[0]}`).toBe(true)
      }
      for (const f of rule.flags ?? []) {
        if (f.role) expect(f.takesValue, `${name} ${f.flags[0]}`).toBe(true)
        if (!Object.keys(f.facts).length) expect(f.takesValue, `${name} ${f.flags[0]}`).toBe(true)
      }
    }
  })

  it('never lets a flag narrow the row it sits on', () => {
    for (const { name, rule } of rulesOf()) {
      for (const f of rule.flags ?? []) {
        const where = `${name} ${f.flags[0]}`
        expect(f.facts.opaque, where).not.toBe(false)
        expect(f.facts.repeatSafe, where).not.toBe(true)
        expect(f.facts.touchesCredentials, where).not.toBe(false)
        if (f.facts.reversible) expect(rule.facts.reversible, where).not.toBe('no')
      }
    }
  })
})

// The seed list is what a real remote support session touches. A gap here is a command that falls through to
// "not in the list of known commands", which is honest but useless.
const SEEDED =
  'ls cat head tail grep find df du ps top sw_vers system_profiler log defaults launchctl networksetup ping curl rm cp mv mkdir chmod chown kill lsof open which env tar unzip sqlite3 git npm pnpm brew pip node python sh sudo security spctl tccutil softwareupdate diskutil docker ssh make xargs bash zsh'.split(
    ' ',
  )

describe('coverage', () => {
  it.each(SEEDED)('%s', (name) => {
    const got = explain({ program: `/usr/bin/${name}`, argv: [name] })
    expect(got.key).not.toBeNull()
    expect(got.facts.confidence).not.toBe('unknown')
  })

  it('answers for at least forty programs', () => {
    expect(Object.keys(COMMANDS).length).toBeGreaterThanOrEqual(40)
  })

  it('carries enough subcommands to be worth keying on', () => {
    const subs = Object.values(COMMANDS).reduce((n, e) => n + Object.keys(e.sub ?? {}).length, 0)
    expect(subs).toBeGreaterThanOrEqual(80)
  })

  it('ships nothing a consumer would have to gate out', () => {
    const facts: Facts[] = ALL.map((r) => r.facts)
    expect(facts.every((f) => f.says.length > 0)).toBe(true)
  })
})
