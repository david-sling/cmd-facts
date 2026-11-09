import { describe, expect, it } from 'vitest'
import { createExplainer } from './explain.ts'
import { BUILTIN } from './data/index.ts'
import { fact, opaqueFact } from './entry.ts'
import { effectsOf } from './facts.ts'
import type { Pack } from './pack.ts'

const TOOLS: Pack = {
  name: '@acme/tools',
  version: '1.2.0',
  commands: {
    flowctl: {
      facts: opaqueFact('Runs one step of a saved flow.', 'the command that step names', { effect: ['execute'] }),
      operands: ['command'],
      nestedHere: true,
    },
  },
}

const KUBE: Pack = {
  name: '@acme/kube',
  version: '2.4.0',
  commands: {
    kubectl: {
      facts: fact('Asks a cluster what is running on it.', { reversible: 'unknown', network: 'known-host' }),
      sub: {
        delete: {
          facts: fact('Removes something from a cluster.', { effect: ['delete'], reversible: 'no', network: 'known-host' }),
          operands: ['text'],
        },
      },
    },
  },
}

const BUILT_IN_ONLY = { packs: [BUILTIN], trust: [BUILTIN.name] }

describe('a registry is settled before anything is explained', () => {
  it('needs at least one pack', () => {
    expect(() => createExplainer({ packs: [] })).toThrow(/needs at least one pack/)
  })

  it('refuses the same pack name twice', () => {
    expect(() => createExplainer({ packs: [TOOLS, { ...TOOLS, version: '9.9.9' }] })).toThrow(/given twice/)
  })

  it('refuses to trust a pack that was not given', () => {
    expect(() => createExplainer({ packs: [TOOLS], trust: ['@acme/nope'] })).toThrow(/not one of the packs given/)
  })

  it('refuses a pack that does not validate', () => {
    const broken: Pack = { name: '@acme/broken', version: '1.0.0', commands: { k: { facts: fact('') } } }
    expect(() => createExplainer({ packs: [broken] })).toThrow(/is not a pack this library will load/)
  })
})

describe('two packs cannot quietly claim the same command', () => {
  const other: Pack = { ...KUBE, name: '@other/kube' }

  it('throws, naming both', () => {
    expect(() => createExplainer({ packs: [KUBE, other] })).toThrow(/`@acme\/kube` and `@other\/kube`/)
  })

  it('is settled by naming the winner', () => {
    const explain = createExplainer({ packs: [KUBE, other], override: { kubectl: '@other/kube' } })
    expect(explain({ program: '/usr/bin/kubectl', argv: ['kubectl'] }).origin).toBe('@other/kube')
  })

  it('refuses a winner that does not claim the command', () => {
    expect(() => createExplainer({ packs: [KUBE, other], override: { kubectl: '@acme/tools' } })).toThrow(
      /not one of the packs given/,
    )
  })

  it('refuses to settle a command nobody claims', () => {
    expect(() => createExplainer({ packs: [KUBE], override: { helm: '@acme/kube' } })).toThrow(/no loaded pack claims/)
  })
})

describe('opting a command out', () => {
  it('leaves it at the widest floor rather than at a substitute', () => {
    const explain = createExplainer({ ...BUILT_IN_ONLY, exclude: ['curl'] })
    const { key, origin, facts } = explain({ program: '/usr/bin/curl', argv: ['curl', 'https://x.example'] })
    expect(key).toBeNull()
    expect(origin).toBeNull()
    expect(facts.confidence).toBe('unknown')
    expect(facts.network).toBe('arbitrary')
  })

  it('works the same on a built-in row as on a pack row', () => {
    const explain = createExplainer({ packs: [BUILTIN, TOOLS], trust: [BUILTIN.name], exclude: ['flowctl'] })
    expect(explain({ program: '/usr/local/bin/flowctl', argv: ['flowctl'] }).key).toBeNull()
  })
})

describe('trust is the consumer’s decision, not the pack’s', () => {
  it('lowers an untrusted pack’s rows to derived', () => {
    const explain = createExplainer({ packs: [KUBE] })
    const { facts } = explain({ program: '/usr/bin/kubectl', argv: ['kubectl'] })
    expect(facts.confidence).toBe('derived')
    expect(facts.source).toBe('plugin')
  })

  it('lowers them inside a subcommand table too', () => {
    const explain = createExplainer({ packs: [KUBE] })
    expect(explain({ program: '/usr/bin/kubectl', argv: ['kubectl', 'delete', 'pod'] }).facts.confidence).toBe('derived')
  })

  it('keeps what a trusted pack wrote', () => {
    const explain = createExplainer({ packs: [KUBE], trust: [KUBE.name] })
    const { facts } = explain({ program: '/usr/bin/kubectl', argv: ['kubectl', 'delete', 'pod'] })
    expect(facts.confidence).toBe('verified')
    expect(facts.source).toBe('curated')
  })

  // A pack cannot raise itself: the stamp goes through `merge`, which only ever widens.
  it('cannot be granted by the pack itself', () => {
    const liar: Pack = { ...KUBE, name: '@acme/liar' }
    const explain = createExplainer({ packs: [liar] })
    expect(explain({ program: '/usr/bin/kubectl', argv: ['kubectl'] }).facts.confidence).toBe('derived')
  })
})

describe('attribution follows the whole chain', () => {
  const explain = createExplainer({ packs: [BUILTIN, TOOLS, KUBE], trust: [BUILTIN.name] })
  const line = explain({ program: '/usr/bin/sudo', argv: ['sudo', 'flowctl', 'kubectl', 'delete', 'pod', 'web-1'] })

  it('names every pack behind the top-level fact set, outermost first', () => {
    expect(line.attribution).toEqual([
      { pack: BUILTIN.name, version: BUILTIN.version, trusted: true, commands: ['sudo'] },
      { pack: '@acme/tools', version: '1.2.0', trusted: false, commands: ['flowctl'] },
      { pack: '@acme/kube', version: '2.4.0', trusted: false, commands: ['kubectl delete'] },
    ])
  })

  it('names only its own pack at each node', () => {
    expect(line.origin).toBe(BUILTIN.name)
    expect(line.runs?.origin).toBe('@acme/tools')
    expect(line.runs?.runs?.origin).toBe('@acme/kube')
  })

  it('does not let a fact set that absorbed an untrusted row still read verified', () => {
    expect(line.facts.confidence).toBe('derived')
  })

  // `delete` is reachable only through the innermost row, and `sudo` is the only reason this needs root.
  it('still carries the inner command’s reach outward', () => {
    expect(effectsOf(line.facts)).toContain('delete')
    expect(line.facts.privilege).toBe('root')
    expect(line.facts.repeatSafe).toBe(false)
  })

  it('reports a pack once even when it answers at two depths', () => {
    const both: Pack = { name: '@acme/both', version: '1.0.0', commands: { ...TOOLS.commands, ...KUBE.commands } }
    const one = createExplainer({ packs: [both] })
    const { attribution } = one({ program: '/usr/local/bin/flowctl', argv: ['flowctl', 'kubectl', 'delete', 'pod'] })
    expect(attribution).toHaveLength(1)
    expect(attribution[0]?.commands).toEqual(['flowctl', 'kubectl delete'])
  })

  it('is empty for a program nothing answers for', () => {
    const { attribution, origin } = explain({ program: '/usr/bin/nope', argv: ['nope'] })
    expect(attribution).toEqual([])
    expect(origin).toBeNull()
  })
})

describe('the depth limit is visible', () => {
  const explain = createExplainer(BUILT_IN_ONLY)

  it('says so when the chain was still handing over', () => {
    const deep = explain({ program: '/usr/bin/sudo', argv: ['sudo', 'sudo', 'sudo', 'sudo', 'sudo', 'ls'] })
    const last = (e = deep): typeof deep => (e.runs ? last(e.runs) : e)
    expect(last().truncated).toBe(true)
  })

  it('says nothing when the chain simply ended', () => {
    expect(explain({ program: '/bin/ls', argv: ['ls'] }).truncated).toBeUndefined()
  })
})

describe('the registry says what it loaded', () => {
  it('lists every pack, which is not the same as what answered a line', () => {
    const explain = createExplainer({ packs: [BUILTIN, KUBE], trust: [BUILTIN.name] })
    expect(explain.registry.packs).toEqual([
      { pack: BUILTIN.name, version: BUILTIN.version, trusted: true },
      { pack: '@acme/kube', version: '2.4.0', trusted: false },
    ])
  })
})
