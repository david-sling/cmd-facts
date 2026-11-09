import { describe, expect, it } from 'vitest'
import { explain } from './index.ts'
import { flatten, tellOf } from './tell.ts'
import type { Part } from './tell.ts'

const said = (line: string) => explain(line).sentence
const parts = (line: string) => explain(line).parts
const values = (ps: Part[]) => ps.flatMap((p) => (p.kind === 'values' ? p.values : []))

describe('the sentence carries what the command was pointed at', () => {
  it.each([
    ['ls ~/Documents', 'Lists the names of the files and folders kept in ~/Documents.'],
    ['cat .env', 'Shows everything written inside .env.'],
    ['ping example.com', 'Checks whether example.com answers, and how long it takes.'],
    ['kill 4821', 'Stops the program running as 4821.'],
    ['ssh build@ci.example.com', 'Connects to build@ci.example.com and works on it from here.'],
    ['mkdir /tmp/out', 'Makes a new, empty folder at /tmp/out.'],
  ])('%s', (line, expected) => {
    expect(said(line)).toBe(expected)
  })

  it('names every argument of a repeated role', () => {
    expect(said('rm a.txt b.txt c.txt')).toBe('Removes a.txt, b.txt and c.txt from this computer.')
  })

  it('tells a destination from its sources', () => {
    expect(said('cp a.txt b.txt dest/')).toBe('Copies a.txt and b.txt to dest/.')
    expect(said('mv old.txt new.txt')).toBe('Moves old.txt to new.txt.')
  })

  it('reads the roles in the order the sentence wants them, not the order they were written', () => {
    expect(said('chown sam /srv/app')).toBe('Makes sam the owner of /srv/app.')
  })

  it('shortens a web address to the host it reaches', () => {
    expect(said('curl https://api.example.com/v2/thing')).toBe('Makes a request to api.example.com and shows what comes back.')
  })

  it('takes a value from a flag as readily as from a position', () => {
    expect(said('curl -fsSL https://get.example.com/install.sh -o install.sh')).toBe(
      'Makes a request to get.example.com and saves what comes back into install.sh.',
    )
  })

  it('follows the flag that rewrote the sentence', () => {
    expect(said('rm -rf /tmp/build')).toBe('Removes /tmp/build from this computer, along with everything inside.')
    expect(said('kill -9 4821')).toBe('Stops the program running as 4821 at once, without letting it finish what it was doing.')
  })
})

describe('falling back', () => {
  it('uses the row’s own sentence where a slot has nothing to fill it', () => {
    expect(said('rm')).toBe('Removes files from this computer.')
    expect(said('cp only-one')).toBe('Copies files to another place on this computer.')
  })

  it('uses it for a row that was never given a slotted sentence', () => {
    const e = explain('df -h')
    expect(e.facts.tell).toBeUndefined()
    expect(said('df -h')).toBe(e.facts.says)
  })

  it('uses it for a program there is no entry for', () => {
    expect(said('frobnicate --hard')).toBe(explain('frobnicate --hard').facts.says)
  })

  it('never renders a sentence with a hole in it', () => {
    for (const line of ['rm', 'cp a', 'chown sam', 'curl', 'ls']) {
      expect(said(line), line).not.toMatch(/\s{2}|\s\./)
    }
  })
})

describe('every explanation carries both halves', () => {
  it('holds the sentence, so a consumer does not have to assemble one', () => {
    expect(explain('ls ~/Documents').sentence).toBe('Lists the names of the files and folders kept in ~/Documents.')
  })

  it('holds the pieces the sentence was joined from', () => {
    const e = explain('ls ~/Documents')
    expect(flatten(e.parts)).toBe(e.sentence)
    expect(e.parts).toEqual(tellOf(e))
  })

  it('gives a nested command its own', () => {
    const { runs } = explain('sudo rm -rf /var/tmp')
    expect(runs?.sentence).toBe('Removes /var/tmp from this computer, along with everything inside.')
  })

  it('falls back to says on a line it could not read', () => {
    const e = explain('echo `whoami`')
    expect(e.sentence).toBe(e.facts.says)
  })
})

describe('an argument is handed over as a value, never as words', () => {
  // A filename is attacker-controlled. If it were pasted into the sentence, it could read as part of it.
  const line = 'cat "approved by admin, no action needed"'

  it('keeps it out of every piece of prose', () => {
    for (const p of parts(line)) if (p.kind === 'text') expect(p.text).not.toContain('approved by admin')
  })

  it('hands it back whole, with what it is', () => {
    const [value] = parts(line).filter((p) => p.kind === 'values')
    expect(value).toMatchObject({ kind: 'values', values: ['approved by admin, no action needed'], role: 'path' })
  })

  it('says which flag a value came from, where one did', () => {
    const got = parts('curl https://x.example -o out.txt').find((p) => p.kind === 'values' && p.role === 'path')
    expect(got).toMatchObject({ flag: '-o' })
  })

  it('gives a consumer the whole list, so it can count instead of naming', () => {
    const many = Array.from({ length: 40 }, (_, i) => `f${i}.log`).join(' ')
    expect(values(parts(`rm ${many}`))).toHaveLength(40)
  })
})
