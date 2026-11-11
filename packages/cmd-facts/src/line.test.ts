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
    ['ls &> all.log', '>', 'all.log', '&'],
    ['ls &>> all.log', '>>', 'all.log', '&'],
    ['echo hi >| notes.txt', '>', 'notes.txt', undefined],
  ])('%s', (line, op, path, fd) => {
    const [step] = stepsOf(line)
    expect(step?.argv[0]).toBe(line.split(' ')[0])
    expect(step?.redirects[0]).toEqual({ op, path, ...(fd ? { fd } : {}) })
  })

  // `2>&1` points one stream at another that is already open: nothing new lands on disk, and the command keeps its row.
  it.each(['ls 2>&1', 'ls >&2', 'ls 2>&-', 'make 2>&1 | tee build.log'])('%s', (line) => {
    const steps = stepsOf(line)
    expect(steps.length, line).toBeGreaterThan(0)
    expect(steps[0]?.argv).toEqual([line.split(' ')[0]])
    expect(steps[0]?.redirects).toEqual([])
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

  it('keeps the stream on the written path, and says which one went there', () => {
    const errs = explain('ls 2> err.txt')
    expect(errs.sentence).toContain('The errors it prints are written to err.txt.')
    expect(errs.args.at(-1)).toMatchObject({ value: 'err.txt', role: 'path', flag: '2>', fd: '2' })
    expect(explain('ls 2>> err.txt').args.at(-1)).toMatchObject({ flag: '2>>', fd: '2' })

    const both = explain('ls &> out.txt')
    expect(both.sentence).toContain('Everything it prints, errors included, is written to out.txt.')
    expect(both.args.at(-1)).toMatchObject({ value: 'out.txt', role: 'path', flag: '&>', fd: '&' })
  })

  it('reads a duplicated stream as the command alone, with nothing new written', () => {
    const dup = explain('ls 2>&1')
    expect(dup.key).toBe('ls')
    expect(dup.facts.confidence).toBe('verified')
    expect(effectsOf(dup.facts)).toEqual(['read'])
    expect(explain('echo hi >| x').key).toBe('echo')
  })
})

describe('words the shell would expand', () => {
  const openOf = (line: string) => stepsOf(line)[0]?.open ?? []

  it('names the position of a word that is not what the program will receive', () => {
    expect(openOf('curl $OPTS https://example.com')).toEqual([1])
    expect(openOf("curl $'-o' /tmp/x https://example.com")).toEqual([1])
    expect(openOf('curl $"-o" /tmp/x https://example.com')).toEqual([1])
    expect(openOf('curl {-o,/tmp/x} https://example.com')).toEqual([1])
    expect(openOf('ls a{1..3}')).toEqual([1])
    expect(openOf('cat *')).toEqual([1])
    expect(openOf('cat *.log')).toEqual([1])
    expect(openOf('echo [abc]')).toEqual([1])
    expect(openOf('curl "$OPTS" https://example.com')).toEqual([1])
    expect(openOf('rm -rf $HOME/x')).toEqual([2])
  })

  it('leaves alone a word that can only arrive starting the way it was written', () => {
    for (const line of [
      'rm ~/x',
      'cat ./*.log',
      'cat src/*.ts',
      "ls '$HOME' \\$HOME",
      'ls "/srv/$NAME"',
      'curl --output="$F" https://example.com',
      'echo $',
      'echo a$ b',
      'find . -name x -exec rm {} +',
      'xargs -I{} rm {}',
      "ls '{a,b}' \\{a,b\\}",
    ]) {
      expect(openOf(line), line).toEqual([])
    }
  })

  it('carries no `open` at all where nothing expands, and keeps one per step', () => {
    expect(stepsOf('ls -la')[0]).toEqual({ argv: ['ls', '-la'], redirects: [] })
    expect(stepsOf('ls $A | cat b | cat $C').map((s) => s.open)).toEqual([[1], undefined, [1]])
  })

  it('joins two lines at a backslash, in or out of double quotes', () => {
    expect(argvOf('curl \\\n-o /tmp/x https://example.com')).toEqual(['curl', '-o', '/tmp/x', 'https://example.com'])
    expect(argvOf('curl "\\\n-o" /tmp/x')).toEqual(['curl', '-o', '/tmp/x'])
    expect(argvOf('ls a\\\nb')).toEqual(['ls', 'ab'])
  })

  // Each of these reaches curl as `-o /tmp/x`, so none of them may read as a request that only shows what came back.
  it('never answers for such a line from the row as written', () => {
    const plain = explain('curl https://example.com')
    expect(plain.facts.confidence).toBe('verified')
    for (const line of [
      "curl $'-o' /tmp/x https://example.com",
      'curl $"-o" /tmp/x https://example.com',
      'curl {-o,/tmp/x} https://example.com',
      'curl $OPTS https://example.com',
      'curl "$OPTS" https://example.com',
      'curl -o $F https://example.com',
    ]) {
      const e = explain(line)
      expect(e.facts.confidence, line).toBe('derived')
      expect(e.facts.source, line).toBe('unread')
      expect(e.unread?.length, line).toBe(1)
      expect(effectsOf(e.facts), line).toEqual(expect.arrayContaining(['write', 'create']))
    }
    const joined = explain('curl \\\n-o /tmp/x https://example.com')
    expect(joined.escalated).toEqual(['-o'])
    expect(effectsOf(joined.facts)).toContain('write')
  })

  it('reads an expanded word after `--` as an operand, since nothing there is a flag', () => {
    const e = explain('rm -- $X')
    expect(e.unread).toBeUndefined()
    expect(e.facts.confidence).toBe('verified')
  })

  it('does not know a program whose name the shell expands', () => {
    for (const line of ['$DIR/ls -la', "$'ls' -la", '{ls,-la}']) expect(explain(line).key, line).toBeNull()
  })

  it('follows the word into a command that is handed over to', () => {
    const e = explain('sudo rm $X')
    expect(e.runs?.unread).toEqual(['$X'])
    expect(e.facts.confidence).toBe('derived')
    expect(explain('sudo $X').runs).toBeUndefined()
  })
})

describe('a line far longer than any command', () => {
  // The subcommand walk used to re-join every word read so far at each flag, which made ten kilobytes take fifteen
  // seconds. The bound is loose on purpose: it has to hold on a slow runner, and the old cost was hours at this size.
  it('is answered in time that grows with its length', () => {
    for (const line of ['git log ' + '-p x '.repeat(20000), 'npm install ' + '-D x '.repeat(20000), 'git ' + 'a '.repeat(50000)]) {
      const began = performance.now()
      explain(line)
      expect(performance.now() - began).toBeLessThan(2000)
    }
    const began = performance.now()
    explain({ program: 'git', argv: ['git', 'log', ...Array.from({ length: 40000 }, (_, n) => (n % 2 ? 'x' : '-p'))] })
    expect(performance.now() - began).toBeLessThan(2000)
  })

  it('still finds the subcommand, and the word after it, where the table holds longer ones', () => {
    expect(explain('gh pr create --title x').subcommand).toBe('pr create')
    expect(explain('aws s3 cp a b').subcommand).toBe('s3 cp')
    expect(explain('docker compose -f prod.yml down').subcommand).toBe('compose down')
    expect(explain('git stash pop x y z').subcommand).toBe(explain('git stash pop').subcommand)
  })
})

describe('a program written as a path', () => {
  it('is answered from the row its last word names, but not as a checked answer', () => {
    for (const line of ['./ls -la', '/tmp/build/ls -la', 'bin/ls', '/bin/ls']) {
      const e = explain(line)
      expect(e.key, line).toBe('ls')
      expect(e.facts.confidence, line).toBe('derived')
      expect(e.facts.source, line).toBe('name-fallback')
    }
    expect(explain('ls -la').facts.confidence).toBe('verified')
  })

  it('keeps the confidence of the row where the consumer resolved the program itself', () => {
    expect(explain({ program: '/bin/ls', argv: ['ls', '-la'] }).facts.confidence).toBe('verified')
  })

  it('stays unknown where the name was never known', () => {
    expect(explain('./nothing-here').facts.confidence).toBe('unknown')
  })

  it('holds for each step of a longer line', () => {
    const e = explain('ls | ./cat')
    expect(e.steps!.map((s) => s.facts.confidence)).toEqual(['verified', 'derived'])
  })
})

describe('a redirection the shell turns into a connection', () => {
  it('reaches the network, and sends where it writes', () => {
    const out = explain('echo hi > /dev/tcp/203.0.113.9/80')
    expect(out.facts.network).toBe('arbitrary')
    expect(effectsOf(out.facts)).toContain('transmit')
    const back = explain('cat < /dev/udp/203.0.113.9/53')
    expect(back.facts.network).toBe('arbitrary')
    expect(effectsOf(back.facts)).not.toContain('transmit')
  })

  it('is only those two names, written in full', () => {
    for (const line of ['echo hi > /dev/null', 'echo hi > /dev/tcp', 'echo hi > /dev/tcp/host', 'echo hi > dev/tcp/host/80', 'echo hi > /dev/tcp/a/b/c']) {
      expect(explain(line).facts.network, line).toBe('none')
    }
  })
})
