import { describe, expect, it } from 'vitest'
import { explain, linePartsOf } from './index.ts'
import type { LinePart } from './cmdline.ts'

const read = (line: string) => linePartsOf(line, explain(line))
// The pieces that are words, without the text-and-step every one carries, for comparing what each was read as.
const words = (line: string) =>
  read(line)
    .filter((p) => p.kind !== 'space')
    .map((p) => {
      const { text, ...rest } = p as LinePart & { step?: number }
      delete rest.step
      return [text, rest]
    })

describe('linePartsOf', () => {
  it.each([
    'curl -fsSL https://get.example.com/install.sh -o install.sh',
    'rm -rf "/Users/sam/My Documents"',
    "echo 'it''s' \\\n  done",
    'curl https://x.example/i.sh | sh && echo ok; ls &',
    'echo hi 2>&1 >> out.txt &> both.log',
    '  ls   ~/x  ',
    'echo $(id)',
    'find . -name "*.log" -exec rm {} \\;',
    '',
  ])('gives back %j exactly when joined', (line) => {
    expect(read(line).map((p) => p.text).join('')).toBe(line)
  })

  it('tells the program, flags and arguments apart', () => {
    expect(words('curl -fsSL https://get.example.com/install.sh -o "my file"')).toEqual([
      ['curl', { kind: 'program' }],
      ['-fsSL', { kind: 'flag' }],
      ['https://get.example.com/install.sh', { kind: 'value', role: 'url' }],
      ['-o', { kind: 'flag', escalated: true }],
      ['"my file"', { kind: 'value', role: 'path', flag: '-o' }],
    ])
  })

  it('reads the command another one hands over to by its own answer', () => {
    expect(words('sudo rm -rf /var/tmp')).toEqual([
      ['sudo', { kind: 'program' }],
      ['rm', { kind: 'program', nested: true }],
      ['-rf', { kind: 'flag', escalated: true }],
      ['/var/tmp', { kind: 'value', role: 'path' }],
    ])
  })

  it('marks subcommands, operators and the step each piece is in', () => {
    const parts = read('git -C /srv commit -m hi && ls')
    expect(parts.filter((p) => p.kind !== 'space').map((p) => [p.text, p.kind, 'step' in p ? p.step : -1])).toEqual([
      ['git', 'program', 0],
      ['-C', 'flag', 0],
      ['/srv', 'value', 0],
      ['commit', 'subcommand', 0],
      ['-m', 'flag', 0],
      ['hi', 'value', 0],
      ['&&', 'operator', 1],
      ['ls', 'program', 1],
    ])
  })

  it('reads a redirection as an operator and its target as a path', () => {
    expect(words('echo hi 2>&1 >> out.txt')).toEqual([
      ['echo', { kind: 'program' }],
      ['hi', { kind: 'value', role: 'text' }],
      ['2>&1', { kind: 'redirect' }],
      ['>>', { kind: 'redirect' }],
      ['out.txt', { kind: 'value', role: 'path', flag: '>>' }],
    ])
  })

  it('flags what the row does not account for', () => {
    expect(words('ls -Z foo')).toEqual([
      ['ls', { kind: 'program' }],
      ['-Z', { kind: 'flag', unread: true }],
      ['foo', { kind: 'value', role: 'unknown' }],
    ])
  })

  it('leaves a line it cannot read whole', () => {
    expect(read('echo $(id)')).toEqual([{ kind: 'unread', text: 'echo $(id)' }])
  })
})
