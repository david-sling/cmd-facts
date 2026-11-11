import { describe, expect, it } from 'vitest'
import { createExplainer } from './explain.ts'
import { BUILTIN } from './data/index.ts'
import { fact, opaqueFact, LOCAL, LOOKS } from './entry.ts'
import { effectsOf } from './facts.ts'
import type { Pack } from './pack.ts'

const TOOLS: Pack = {
  name: '@acme/tools',
  version: '1.2.0',
  commands: {
    flowctl: {
      facts: opaqueFact('Runs one step of a saved flow.', 'the command that step names', { ...LOCAL, effect: ['execute'] }),
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
      facts: fact('Asks a cluster what is running on it, or removes things from it.', { effect: ['read', 'delete'], privilege: 'none', touchesCredentials: false, repeatSafe: true, reversible: 'no', network: 'known-host' }),
      sub: {
        delete: {
          facts: fact('Removes something from a cluster.', { privilege: 'none', touchesCredentials: false, repeatSafe: true, effect: ['delete'], reversible: 'no', network: 'known-host' }),
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
    const broken: Pack = { name: '@acme/broken', version: '1.0.0', commands: { k: { facts: fact('', { ...LOOKS }) } } }
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
  // The built-in table answers for kubectl too, so the pack has to be named as the one that wins it.
  const explain = createExplainer({ packs: [BUILTIN, TOOLS, KUBE], trust: [BUILTIN.name], override: { kubectl: KUBE.name } })
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
    const explain = createExplainer({ packs: [BUILTIN, KUBE], trust: [BUILTIN.name], override: { kubectl: KUBE.name } })
    expect(explain.registry.packs).toEqual([
      { pack: BUILTIN.name, version: BUILTIN.version, trusted: true },
      { pack: '@acme/kube', version: '2.4.0', trusted: false },
    ])
  })
})

describe('a versioned row holds its numbered names too', () => {
  const looks = fact('Shows which version is installed.', { ...LOOKS })
  const numbered: Pack = { name: '@acme/py', version: '1.0.0', commands: { python3: { facts: looks, plain: ['-c'] } } }
  const line = { program: '/usr/bin/python3', argv: ['python3', '-c', 'x'] }

  it('refuses a row that would take one from another pack without being named', () => {
    expect(() => createExplainer({ packs: [BUILTIN, numbered], trust: [BUILTIN.name] })).toThrow(
      /`python3` is claimed by `@acme\/py`, and `@cmd-facts\/builtin` already answers for it through `python`/,
    )
  })

  it('is settled either way by `override`, or by `exclude`', () => {
    const base = { packs: [BUILTIN, numbered], trust: [BUILTIN.name] }
    expect(createExplainer({ ...base, override: { python3: '@acme/py' } })(line).origin).toBe('@acme/py')
    const kept = createExplainer({ ...base, override: { python3: BUILTIN.name } })(line)
    expect(kept.origin).toBe(BUILTIN.name)
    expect(kept.facts.opaque).toBe(true)
    expect(createExplainer({ ...base, exclude: ['python3'] })(line).key).toBe('python')
  })

  it('leaves alone a numbered name no versioned row reaches, and one pack holding both', () => {
    const free: Pack = { ...numbered, commands: { git2: { facts: looks } } }
    expect(createExplainer({ packs: [BUILTIN, free] })({ program: 'git2', argv: ['git2'] }).origin).toBe('@acme/py')
    const both: Pack = { ...numbered, commands: { snake: { facts: looks, versioned: true }, snake3: { facts: looks } } }
    expect(createExplainer({ packs: [both] })({ program: 'snake3', argv: ['snake3'] }).key).toBe('snake3')
  })
})

describe('a pack is copied when it is loaded', () => {
  const pack = (): Pack => ({ name: '@acme/own', version: '1.0.0', commands: { deploy: { facts: fact('Lists what is deployed.', { ...LOOKS }) } } })
  const line = { program: 'deploy', argv: ['deploy', '--wipe'] }

  it('so changing it afterwards changes nothing already built', () => {
    const mine = pack()
    const explain = createExplainer({ packs: [mine], trust: [mine.name] })
    mine.commands['deploy']!.plain = ['--wipe']
    mine.commands['deploy']!.facts.says = 'Anything at all.'
    const e = explain(line)
    expect(e.unread).toEqual(['--wipe'])
    expect(e.facts.says).toBe('Lists what is deployed.')
  })

  it('and hands out rows nobody can write to', () => {
    const explain = createExplainer(BUILT_IN_ONLY)
    const row = explain.registry.lookup('rm')!.entry
    expect(Object.isFrozen(row)).toBe(true)
    expect(Object.isFrozen(row.facts)).toBe(true)
    expect(() => ((row.facts as { says: string }).says = 'x')).toThrow(TypeError)
  })

  it('refuses a pack that carries anything but data', () => {
    const sly = pack()
    ;(sly.commands['deploy'] as unknown as Record<string, unknown>)['match'] = () => true
    expect(() => createExplainer({ packs: [sly] })).toThrow(/data and only data/)
  })

  it('checks the same table it loads, whatever the pack returns the second time it is asked', () => {
    let asked = 0
    const good = pack().commands
    const sly = { name: '@acme/sly', version: '1.0.0', get commands() { return asked++ ? { rm: good['deploy']! } : good } } as Pack
    const explain = createExplainer({ packs: [sly] })
    expect(asked).toBe(1)
    expect(explain.registry.lookup('rm')).toBeUndefined()
  })

  it('and the built-in table is frozen where everyone imports it from', () => {
    expect(Object.isFrozen(BUILTIN)).toBe(true)
    expect(Object.isFrozen(BUILTIN.commands)).toBe(true)
    expect(Object.isFrozen(BUILTIN.commands['rm']!.facts)).toBe(true)
  })
})
