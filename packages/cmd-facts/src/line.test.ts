import { describe, expect, it } from 'vitest'
import { tokenize } from './line.ts'
import { explain } from './index.ts'
import { effectsOf } from './facts.ts'

const argvOf = (line: string) => {
  const read = tokenize(line)
  return read.ok ? read.argv : read.why
}

describe('splitting a line into words', () => {
  it('splits on whitespace', () => {
    expect(argvOf('rm -rf /tmp/x')).toEqual(['rm', '-rf', '/tmp/x'])
    expect(argvOf('  ls   -la  ')).toEqual(['ls', '-la'])
  })

  it('keeps a quoted word whole', () => {
    expect(argvOf('rm -rf "/Users/sam/My Documents"')).toEqual(['rm', '-rf', '/Users/sam/My Documents'])
    expect(argvOf("rm -rf '/Users/sam/My Documents'")).toEqual(['rm', '-rf', '/Users/sam/My Documents'])
  })

  it('keeps an escaped space inside one word', () => {
    expect(argvOf('rm /Users/sam/My\\ Documents')).toEqual(['rm', '/Users/sam/My Documents'])
  })

  it('keeps an empty quoted word, because the program will receive one', () => {
    expect(argvOf('grep "" file')).toEqual(['grep', '', 'file'])
  })

  it('takes single quotes literally, as a shell does', () => {
    expect(argvOf("echo 'it\\'")).toEqual(['echo', 'it\\'])
  })

  it('unescapes only what a double quote unescapes', () => {
    expect(argvOf('echo "a\\"b"')).toEqual(['echo', 'a"b'])
    expect(argvOf('echo "a\\nb"')).toEqual(['echo', 'a\\nb'])
  })

  // What a variable or a glob stands for is not on the line, so the word stays as it was written.
  it('expands nothing', () => {
    expect(argvOf('rm -rf $HOME/x')).toEqual(['rm', '-rf', '$HOME/x'])
    expect(argvOf('rm -rf ~/x')).toEqual(['rm', '-rf', '~/x'])
    expect(argvOf('rm *.log')).toEqual(['rm', '*.log'])
  })

  it('refuses a line that is more than one command', () => {
    for (const line of ['curl x | sh', 'a && b', 'a; b', 'a > out', 'a `b`', 'a $(b)', 'a & b']) {
      expect(argvOf(line), line).toBe('many')
    }
  })

  it('refuses a line it cannot finish reading', () => {
    expect(argvOf('rm -rf "unterminated')).toBe('unterminated')
    expect(argvOf('rm -rf x\\')).toBe('unterminated')
  })

  it('refuses an empty line', () => {
    expect(argvOf('   ')).toBe('empty')
  })
})

describe('explaining a whole line', () => {
  it('answers it the same way as a split argv', () => {
    const line = explain('rm -rf /Users/sam/Documents')
    const argv = explain({ program: '/bin/rm', argv: ['rm', '-rf', '/Users/sam/Documents'] })
    expect(line.facts).toEqual(argv.facts)
    expect(line.args).toEqual(argv.args)
    expect(line.escalated).toEqual(argv.escalated)
    expect(line.key).toBe('rm')
  })

  it('does not weaken the answer for want of a path', () => {
    expect(explain('rm -rf /tmp/x').facts.confidence).toBe('verified')
  })

  it('reports the program as the line named it', () => {
    expect(explain('rm -rf /tmp/x').program).toBe('rm')
    expect(explain('/bin/rm -rf /tmp/x').program).toBe('/bin/rm')
    expect(explain('/bin/rm -rf /tmp/x').name).toBe('rm')
  })

  it('follows a nested command on the line', () => {
    const { facts, runs } = explain('sudo rm -rf /tmp/x')
    expect(runs?.name).toBe('rm')
    expect(facts.privilege).toBe('root')
    expect(effectsOf(facts)).toContain('delete')
  })

  it('reads a quoted path as one argument', () => {
    const { args } = explain('rm -rf "/Users/sam/My Documents"')
    expect(args).toEqual([{ index: 2, value: '/Users/sam/My Documents', role: 'path' }])
  })

  it('says it did not read a line that is more than one command', () => {
    const { key, origin, facts, args } = explain('curl https://x.example | sh')
    expect(key).toBeNull()
    expect(origin).toBeNull()
    expect(args).toEqual([])
    expect(facts.opaque).toBe(true)
    expect(facts.confidence).toBe('unknown')
    expect(facts.network).toBe('arbitrary')
  })

  it('keeps the line it was handed, so a consumer can show what it could not read', () => {
    expect(explain('curl x | sh').program).toBe('curl x | sh')
  })

  it('says nothing about a program it has no entry for', () => {
    expect(explain('frobnicate --hard').facts.confidence).toBe('unknown')
  })
})
