import { describe, expect, it } from 'vitest'
import { validate } from './pack.ts'
import type { Pack } from './pack.ts'
import { BUILTIN } from './data/index.ts'
import { fact, opaqueFact, LOCAL, LOOKS } from './entry.ts'
import type { Entry } from './entry.ts'

const packOf = (commands: Record<string, Entry>): Pack => ({ name: '@acme/tools', version: '1.0.0', commands })
const says = (p: Pack) => validate(p).map((x) => x.says)

describe('the validator and the shipped table agree', () => {
  // If this fails, either a row has drifted or the validator is stricter than the table it was extracted from.
  it('finds nothing wrong with the built-in pack', () => {
    expect(validate(BUILTIN)).toEqual([])
  })
})

describe('the envelope', () => {
  it('wants a name it can be referred to by', () => {
    expect(says({ ...packOf({}), name: 'Acme Tools' })).toContainEqual(expect.stringContaining('A pack name is lowercase'))
    expect(says({ ...packOf({}), name: '@acme/kubectl' })).toEqual([])
  })

  it('wants a version, so an audit log can record which one answered', () => {
    expect(says({ ...packOf({}), version: '' })).toContainEqual(expect.stringContaining('has to carry a version'))
  })

  it('wants command names a lookup could actually reach', () => {
    expect(says(packOf({ 'usr/bin/ls': { facts: fact('Lists things.', { ...LOOKS }) } }))).toContainEqual(
      expect.stringContaining('program basename'),
    )
  })
})

describe('a fact set has to hold together', () => {
  it('wants a sentence', () => {
    expect(says(packOf({ k: { facts: fact('', { ...LOOKS }) } }))).toContainEqual(expect.stringContaining('needs a `says` sentence'))
  })

  it('refuses a value outside the schema', () => {
    const facts = { ...fact('Does a thing.', { ...LOOKS }), network: 'sometimes' } as never
    expect(says(packOf({ k: { facts } }))).toContainEqual(expect.stringContaining('`network` is one of'))
  })

  it('refuses a row that deletes and says it can be put back', () => {
    const facts = fact('Removes a thing.', { ...LOCAL, repeatSafe: true, effect: ['delete'], reversible: 'yes' })
    expect(says(packOf({ k: { facts } }))).toContainEqual(expect.stringContaining('cannot also say it can be put back'))
  })

  it('refuses a row that transmits over no network', () => {
    const facts = fact('Sends a thing.', { ...LOCAL, reversible: 'yes', repeatSafe: true, effect: ['transmit'] })
    expect(says(packOf({ k: { facts } }))).toContainEqual(expect.stringContaining('touches no network'))
  })

  it('refuses a root row that does not name the elevate effect', () => {
    const facts = fact('Does a thing as root.', { effect: ['read'], reversible: 'yes', network: 'none', touchesCredentials: false, repeatSafe: true, privilege: 'root' })
    expect(says(packOf({ k: { facts } }))).toContainEqual(expect.stringContaining('has to name the `elevate` effect'))
  })

  it('wants an opaque row to name what it handed over to', () => {
    const facts = { ...opaqueFact('Runs a thing.', 'x', { ...LOCAL }), handsOverTo: '' } as never
    expect(says(packOf({ k: { facts } }))).toContainEqual(expect.stringContaining('has to name what it hands over to'))
  })

  it('refuses an opaque row that claims it is safe to repeat', () => {
    const facts = { ...opaqueFact('Runs a thing.', 'what it was given', { ...LOCAL }), repeatSafe: true } as never
    expect(says(packOf({ k: { facts } }))).toContainEqual(expect.stringContaining('cannot claim it is safe to repeat'))
  })
})

describe('the grammar layer', () => {
  it('wants every flag declared with its dash', () => {
    const entry: Entry = { facts: fact('Does a thing.', { ...LOOKS }), flags: [{ flags: ['r'], facts: { effect: ['delete'] } }] }
    expect(says(packOf({ k: entry }))).toContainEqual(expect.stringContaining('declared with its dash'))
  })

  it('never lets a flag narrow the row it sits on', () => {
    const entry: Entry = {
      facts: opaqueFact('Runs a thing.', 'what it was given', { ...LOCAL }),
      flags: [{ flags: ['-q'], facts: { repeatSafe: true, touchesCredentials: false } }],
    }
    const problems = says(packOf({ k: entry }))
    expect(problems).toContainEqual(expect.stringContaining('cannot claim a row is safe to repeat'))
    expect(problems).toContainEqual(expect.stringContaining('cannot withdraw `touchesCredentials`'))
  })

  // A position that holds another command is the handover itself.
  it('refuses a clear row that holds a command in a position', () => {
    const entry: Entry = { facts: fact('Runs a thing.', { ...LOOKS }), operands: ['command'] }
    expect(says(packOf({ k: entry }))).toContainEqual(expect.stringContaining('has to be opaque'))
  })

  it('refuses a row that follows a nested command with nowhere to recurse', () => {
    const entry: Entry = { facts: opaqueFact('Runs a thing.', 'what it was given', { ...LOCAL }), nestedHere: true, operands: ['path'] }
    expect(says(packOf({ k: entry }))).toContainEqual(expect.stringContaining('needs a position that holds one'))
  })

  it('refuses `assignmentsFirst` where nothing is nested', () => {
    const entry: Entry = { facts: opaqueFact('Runs a thing.', 'what it was given', { ...LOCAL }), assignmentsFirst: true }
    expect(says(packOf({ k: entry }))).toContainEqual(expect.stringContaining('`assignmentsFirst` only means something'))
  })

  // The handover is found while the line is read, so a flag further on cannot be allowed to move it.
  it('never lets a flag move a command into or out of a position', () => {
    const into: Entry = {
      facts: opaqueFact('Runs a thing.', 'what it was given', { ...LOCAL }),
      operands: ['path'],
      flags: [{ flags: ['-x'], facts: {}, operands: ['command'] }],
    }
    expect(says(packOf({ k: into }))).toContainEqual(expect.stringContaining('cannot move another command'))
    const outOf: Entry = {
      facts: opaqueFact('Runs a thing.', 'what it was given', { ...LOCAL }),
      operands: ['command'],
      flags: [{ flags: ['-x'], facts: {}, operands: ['path'] }],
    }
    expect(says(packOf({ k: outOf }))).toContainEqual(expect.stringContaining('whose operands hold a command'))
  })

  it('wants a slot that names a flag to name one that gives that role', () => {
    const entry = (from: string): Entry => ({
      facts: fact('Saves a file.', { ...LOOKS, tell: ['Saves ', { role: 'path', from }, '.'] }),
      operands: ['path'],
      values: { '--log': 'path' },
      flags: [{ flags: ['-o', '--output'], takesValue: true, role: 'path', facts: {} }],
    })
    expect(says(packOf({ k: entry('-o') }))).toEqual([])
    expect(says(packOf({ k: entry('operands') }))).toEqual([])
    // An argument reports its flag as the rule's first spelling, so `--output` would never match.
    expect(says(packOf({ k: entry('--output') }))).toContainEqual(expect.stringContaining('first spelling of a flag rule'))
    expect(says(packOf({ k: entry('--log') }))).toContainEqual(expect.stringContaining('first spelling of a flag rule'))
  })

  it('accepts a flag that turns operands into files, and lets `tell` name them', () => {
    const entry: Entry = {
      facts: fact('Searches files.', { ...LOOKS, tell: ['Searches ', { role: 'path', which: 'all' }, '.'] }),
      operands: ['pattern'],
      flags: [{ flags: ['-e'], takesValue: true, role: 'pattern', facts: {}, operands: ['path'] }],
    }
    expect(says(packOf({ k: entry }))).toEqual([])
    expect(says(packOf({ k: { ...entry, flags: [{ flags: ['-e'], facts: {}, operands: ['nonsense' as never] }] } }))).toContainEqual(
      expect.stringContaining('is not a known role'),
    )
  })
})

describe('a base row stands in for its subcommands', () => {
  it('refuses a base row that promises what a subcommand breaks', () => {
    const entry: Entry = {
      facts: fact('Talks to a cluster.', { ...LOOKS }),
      sub: { delete: { facts: fact('Removes something.', { ...LOCAL, repeatSafe: true, effect: ['delete'], reversible: 'no' }) } },
    }
    expect(says(packOf({ k: entry }))).toEqual([
      'The base row says it is yes to put back, and this subcommand is no.',
      'The base row does not name delete, which this subcommand does.',
    ])
  })

  it('reads a subcommand together with its flags, since a line it cannot read falls back to the base row', () => {
    const entry: Entry = {
      facts: fact('Talks to a cluster.', { ...LOCAL, effect: ['read', 'write'], reversible: 'no', repeatSafe: false }),
      sub: {
        apply: {
          facts: fact('Changes something.', { ...LOCAL, effect: ['write'], reversible: 'no', repeatSafe: false }),
          flags: [{ flags: ['--prune'], facts: { effect: ['delete'] } }],
        },
      },
    }
    expect(says(packOf({ k: entry }))).toEqual(['The base row does not name delete, which this subcommand does.'])
  })

  it('lets an opaque base row keep its effects as a floor', () => {
    const entry: Entry = {
      facts: opaqueFact('Talks to a cluster.', 'the plugins it loads', { ...LOCAL }),
      sub: { delete: { facts: fact('Removes something.', { ...LOCAL, repeatSafe: true, effect: ['delete'], reversible: 'no' }) } },
    }
    expect(says(packOf({ k: entry }))).toEqual([])
  })

  it('accepts a base row cautious enough to cover them', () => {
    const entry: Entry = {
      facts: fact('Talks to a cluster.', { effect: ['read', 'delete'], privilege: 'none', touchesCredentials: false, repeatSafe: true, reversible: 'no', network: 'known-host' }),
      sub: { delete: { facts: fact('Removes something.', { privilege: 'none', touchesCredentials: false, repeatSafe: true, effect: ['delete'], reversible: 'no', network: 'known-host' }) } },
    }
    expect(says(packOf({ k: entry }))).toEqual([])
  })

  it('holds a shorter subcommand to the same for the longer ones under it', () => {
    const cautious = fact('Talks to a cluster.', { effect: ['read'], privilege: 'none', touchesCredentials: false, repeatSafe: true, reversible: 'unknown', network: 'known-host' })
    const entry: Entry = {
      facts: cautious,
      sub: {
        pods: { facts: fact('Works with pods.', { effect: ['read'], reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true, network: 'known-host' }) },
        'pods delete': { facts: fact('Removes a pod.', { privilege: 'none', touchesCredentials: false, repeatSafe: true, effect: ['delete'], reversible: 'no', network: 'known-host' }) },
      },
    }
    expect(says(packOf({ k: entry }))).toContainEqual(expect.stringContaining('`pods` says it is yes to put back'))
  })

  it('refuses a subcommand key that is not words split by single spaces', () => {
    const entry: Entry = { facts: fact('Talks to a cluster.', { ...LOOKS }), sub: { 'pods  get': { facts: fact('Lists pods.', { ...LOOKS }) }, '-x': { facts: fact('Lists pods.', { ...LOOKS }) } } }
    expect(says(packOf({ k: entry })).filter((m) => m.includes('one or more words'))).toHaveLength(2)
  })
})

describe('the flags a row has read', () => {
  it('takes a plain flag only with its dash', () => {
    const entry: Entry = { facts: fact('Shows a file.', { ...LOOKS }), operands: ['path'], plain: ['v'] }
    expect(says(packOf({ k: entry }))).toEqual(['`v` in `plain` has to be declared with its dash.'])
  })

  it('refuses a flag that is plain and also does something', () => {
    const entry: Entry = {
      facts: fact('Shows a file.', { ...LOOKS }),
      operands: ['path'],
      plain: ['-o'],
      values: { '-o': 'path' },
    }
    expect(says(packOf({ k: entry }))).toEqual(['`-o` is declared as plain and as something it does, which cannot both be true.'])
  })
})

describe('a global option', () => {
  it('cannot move the operands of a subcommand it comes before', () => {
    const entry: Entry = {
      facts: opaqueFact('Talks to a cluster.', 'the plugins it loads', { ...LOCAL }),
      globals: [{ flags: ['-e'], takesValue: true, role: 'pattern', facts: {}, operands: ['path'] }],
      sub: { get: { facts: fact('Lists things.', { ...LOOKS }), operands: ['text'] } },
    }
    expect(says(packOf({ k: entry }))).toEqual(['A global cannot change the operands of a subcommand it comes before.'])
  })
})
