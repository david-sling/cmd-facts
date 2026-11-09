import { describe, expect, it } from 'vitest'
import { rows } from './rows.ts'
import { COMMANDS } from './data/index.ts'
import { UNKNOWN } from './explain.ts'

// Terms that belong to people who already know what a command is. The replacement is in brackets.
const JARGON = [
  'stdout',
  'stderr',
  'stdin',
  'output',
  'daemon',
  'repository',
  'repo',
  'binary',
  'binaries',
  'directory',
  'directories',
  'recursive',
  'recursively',
  'filesystem',
  'kernel',
  'shell',
  'socket',
  'symlink',
  'regex',
  'metadata',
  'executable',
  'invoke',
  'invokes',
  'spawn',
  'spawns',
  'subprocess',
  'process',
  'processes',
  'config',
  'configs',
  'cli',
  'terminal',
  'argument',
  'arguments',
  'parameter',
  'parameters',
  'flag',
  'flags',
  'string',
  'boolean',
  'variable',
  'variables',
  'token',
  'tokens',
  'mount',
  'unmount',
  'utility',
  'verbose',
]

// A prompt that calls one command safe teaches the reader that the ones without a word like this are not.
const VERDICTS = [
  'safe',
  'safely',
  'unsafe',
  'harmless',
  'harmful',
  'dangerous',
  'danger',
  'risky',
  'risk',
  'secure',
  'insecure',
  'trusted',
  'untrusted',
  'malicious',
  'suspicious',
  'careful',
  'warning',
  'beware',
  'simply',
  'just',
]

const hits = (text: string, words: string[]) =>
  words.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(text))

const ALL = [...rows().map((r) => ({ name: r.name, facts: r.facts })), { name: '(unknown program)', facts: UNKNOWN }]

describe('says', () => {
  it.each(ALL)('$name', ({ facts }) => {
    const says = facts.says
    expect(says).not.toBe('')
    expect(says.endsWith('.')).toBe(true)
    expect(says.indexOf('.')).toBe(says.length - 1)
    expect(says[0]).toBe(says[0]!.toUpperCase())
    expect(says.length).toBeLessThanOrEqual(150)
    expect(hits(says, JARGON)).toEqual([])
    expect(hits(says, VERDICTS)).toEqual([])
    expect(says).not.toMatch(/[{}$%<>]|\.\.\./)
  })
})

describe('note', () => {
  const noted = ALL.filter((r) => r.facts.note)
  it('is carried by the commands whose consequence the fields cannot hold', () => {
    expect(noted.length).toBeGreaterThan(10)
  })
  it.each(noted)('$name', ({ facts }) => {
    const note = facts.note!
    expect(note.endsWith('.')).toBe(true)
    expect(note.length).toBeLessThanOrEqual(200)
    expect(note[0]).toBe(note[0]!.toUpperCase())
    expect(hits(note, JARGON)).toEqual([])
    expect(hits(note, VERDICTS)).toEqual([])
  })
})

describe('handsOverTo', () => {
  const blind = ALL.filter((r) => r.facts.opaque)
  it('is on every opaque row', () => {
    expect(blind.length).toBeGreaterThan(20)
  })
  it.each(blind)('$name', ({ facts }) => {
    const to = facts.opaque ? facts.handsOverTo : ''
    expect(to.length).toBeGreaterThan(8)
    expect(to.endsWith('.')).toBe(false)
    expect(to[0]).toBe(to[0]!.toLowerCase())
    expect(hits(to, JARGON)).toEqual([])
    expect(hits(to, VERDICTS)).toEqual([])
  })
})

describe('the register itself', () => {
  // Explaining `ls` as "lists" tells a reader who did not know what `ls` meant nothing at all. Naming the language a
  // program runs is the exception: there it is the useful half of the sentence.
  const NAMES_ITSELF = ['python', 'pip']

  it('does not explain a program by repeating its name', () => {
    for (const { name, facts } of ALL) {
      const program = name.split(' ')[0]!
      if (program === '(unknown' || NAMES_ITSELF.includes(program)) continue
      expect(hits(facts.says, [program]), name).toEqual([])
    }
  })

  it('never tells the reader what to do about it', () => {
    for (const { facts } of ALL) {
      expect(facts.says).not.toMatch(/\b(you should|make sure|be sure|only allow|do not allow|check that)\b/i)
    }
  })

  it('holds no string a consumer could run', () => {
    for (const { facts } of ALL) {
      for (const text of [facts.says, facts.note ?? '']) {
        expect(text).not.toMatch(/\b(sudo|rm -|git |npm |brew )/)
        expect(text).not.toContain('`')
      }
    }
  })

  it('points a doubtful reader at something they can check', () => {
    for (const [name, entry] of Object.entries(COMMANDS)) {
      expect(entry.facts.docs, name).toBeTruthy()
      for (const [word, sub] of Object.entries(entry.sub ?? {})) expect(sub.facts.docs, `${name} ${word}`).toBeTruthy()
    }
  })
})
