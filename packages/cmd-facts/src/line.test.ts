import { describe, expect, it } from 'vitest'
import { tokenize } from './line.ts'
import { explain } from './index.ts'
import { effectsOf } from './facts.ts'

const read = (line: string) => tokenize(line)
const argvOf = (line: string) => {
  const t = read(line)
  return t.ok ? (t.steps[0]?.argv ?? []) : t.why
}
const stepsOf = (line: string) => {
  const t = read(line)
  return t.ok ? t.steps : []
}

describe('splitting a command into words', () => {
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

  it('keeps an operator that sits inside quotes', () => {
    expect(argvOf('grep "a|b" file')).toEqual(['grep', 'a|b', 'file'])
  })
})

describe('splitting a line into the commands it runs', () => {
  it.each([
    ['curl x | sh', '|'],
    ['make && ./run', '&&'],
    ['make || echo failed', '||'],
    ['cd /tmp; ls', ';'],
    ['sleep 60 & ls', '&'],
  ])('%s', (line, op) => {
    const steps = stepsOf(line)
    expect(steps).toHaveLength(2)
    expect(steps[0]?.after).toBeUndefined()
    expect(steps[1]?.after).toBe(op)
  })

  it('reads a longer line', () => {
    const steps = stepsOf('cat notes.txt | grep TODO | wc -l')
    expect(steps.map((s) => s.argv[0])).toEqual(['cat', 'grep', 'wc'])
    expect(steps.map((s) => s.after)).toEqual([undefined, '|', '|'])
  })

  it('treats a newline as a command boundary', () => {
    expect(stepsOf('cd /tmp\nls')).toHaveLength(2)
  })

  it('refuses a line whose last command is missing', () => {
    expect(argvOf('ls |')).toBe('unterminated')
    expect(argvOf('| ls')).toBe('unterminated')
  })

  // The value of a substitution is not on the line, so there is nothing here to read.
  it('refuses a substitution', () => {
    for (const line of ['echo `whoami`', 'echo $(whoami)', '(cd /tmp && ls)']) expect(argvOf(line), line).toBe('substitution')
  })

  it('refuses a line it cannot finish reading', () => {
    expect(argvOf('rm -rf "unterminated')).toBe('unterminated')
    expect(argvOf('rm -rf x\\')).toBe('unterminated')
    expect(argvOf('cat >')).toBe('unterminated')
  })

  it('refuses an empty line', () => {
    expect(argvOf('   ')).toBe('empty')
  })
})

describe('reading where output was sent', () => {
  it('takes the path off argv', () => {
    const [step] = stepsOf('echo hello > notes.txt')
    expect(step?.argv).toEqual(['echo', 'hello'])
    expect(step?.redirects).toEqual([{ op: '>', path: 'notes.txt' }])
  })

  it.each([
    ['ls >> log', '>>', 'log', undefined],
    ['ls < in.txt', '<', 'in.txt', undefined],
    ['ls 2> err.log', '>', 'err.log', '2'],
    ['ls 2>> err.log', '>>', 'err.log', '2'],
    ['ls &> all.log', '>', 'all.log', undefined],
  ])('%s', (line, op, path, fd) => {
    const [step] = stepsOf(line)
    expect(step?.argv).toEqual(['ls'])
    expect(step?.redirects[0]).toEqual({ op, path, ...(fd ? { fd } : {}) })
  })

  it('reads one on each command of a line', () => {
    const steps = stepsOf('cat a.txt | grep TODO > found.txt')
    expect(steps[0]?.redirects).toEqual([])
    expect(steps[1]?.redirects).toEqual([{ op: '>', path: 'found.txt' }])
  })
})

describe('explaining a whole line', () => {
  it('answers one command the same way as a split argv', () => {
    const line = explain('rm -rf /Users/sam/Documents')
    const argv = explain({ program: '/bin/rm', argv: ['rm', '-rf', '/Users/sam/Documents'] })
    expect(line.facts).toEqual(argv.facts)
    expect(line.args).toEqual(argv.args)
    expect(line.key).toBe('rm')
  })

  it('does not weaken the answer for want of a path', () => {
    expect(explain('rm -rf /tmp/x').facts.confidence).toBe('verified')
  })

  it('follows a nested command on the line', () => {
    const { facts, runs } = explain('sudo rm -rf /tmp/x')
    expect(runs?.name).toBe('rm')
    expect(facts.privilege).toBe('root')
  })

  it('reads a quoted path as one argument', () => {
    expect(explain('rm -rf "/Users/sam/My Documents"').args).toEqual([
      { index: 2, value: '/Users/sam/My Documents', role: 'path' },
    ])
  })

  it('says nothing about a program it has no entry for', () => {
    expect(explain('frobnicate --hard').facts.confidence).toBe('unknown')
  })

  it('admits a line it could not read', () => {
    const { key, facts, steps } = explain('echo `whoami`')
    expect(key).toBeNull()
    expect(steps).toBeUndefined()
    expect(facts.confidence).toBe('unknown')
  })
})

describe('explaining a line of several commands', () => {
  const piped = explain('curl https://get.example.com/install.sh | sh')

  it('answers for each command in turn', () => {
    expect(piped.steps?.map((s) => s.name)).toEqual(['curl', 'sh'])
    expect(piped.steps?.[1]?.after).toBe('|')
  })

  it('widens every step into the fact set at the top', () => {
    expect(piped.facts.network).toBe('arbitrary')
    expect(piped.facts.opaque).toBe(true)
    expect(piped.facts.repeatSafe).toBe(false)
    expect(piped.key).toBeNull()
  })

  it('never claims more confidence than its weakest step', () => {
    expect(explain('ls | frobnicate').facts.confidence).toBe('unknown')
  })

  it('reads as the steps joined by what the operator does', () => {
    expect(explain('cd /tmp && rm -rf build').sentence).toContain('Only if that works, the next command runs.')
    expect(piped.sentence).toContain('What it prints is given to the next command.')
    expect(piped.sentence.startsWith('Makes a request to get.example.com')).toBe(true)
  })

  it('still answers with one sentence for a consumer that reads only says', () => {
    expect(piped.facts.says).toBe('This line runs more than one command.')
  })

  it('names every pack behind any of its steps', () => {
    expect(piped.attribution.map((a) => a.pack)).toEqual(['@cmd-facts/builtin'])
  })
})

describe('a redirection is the line’s doing, not the program’s', () => {
  const wrote = explain('echo hello > /etc/hosts')

  it('adds the writing the program knows nothing about', () => {
    expect(effectsOf(wrote.facts)).toEqual(expect.arrayContaining(['create', 'write']))
    expect(wrote.facts.reversible).toBe('no')
  })

  it('names the file it was sent to', () => {
    expect(wrote.sentence).toContain('What it prints is written to /etc/hosts.')
    expect(wrote.args.at(-1)).toMatchObject({ value: '/etc/hosts', role: 'path', flag: '>' })
  })

  // `cat x > y` must not read as though `y` were another file being shown.
  it('never lets the written path fill a slot meant for what the command was pointed at', () => {
    const e = explain('cat notes.txt > copy.txt')
    expect(e.sentence).toBe('Shows everything written inside notes.txt. What it prints is written to copy.txt.')
  })

  // The line this whole shape exists for: nothing about `echo` writes a file, and the line does.
  it('accounts for a line that writes a file the program knows nothing about', () => {
    const e = explain('echo "ssh-rsa AAAA" >> ~/.ssh/authorized_keys')
    expect(e.key).toBe('echo')
    expect(e.sentence).toBe('Shows a line of text. What it prints is written to ~/.ssh/authorized_keys.')
    expect(effectsOf(e.facts)).toEqual(expect.arrayContaining(['create', 'write']))
    expect(e.args.at(-1)).toMatchObject({ value: '~/.ssh/authorized_keys', role: 'path', flag: '>>' })
  })

  it('appending is not the same as replacing', () => {
    expect(explain('echo x >> log').facts.reversible).toBe('unknown')
    expect(explain('echo x >> log').facts.repeatSafe).toBe(false)
  })
})
