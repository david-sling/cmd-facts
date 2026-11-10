import { describe, expect, it } from 'vitest'
import { explain } from './index.ts'
import { effectsOf, isComplete, merge } from './facts.ts'
import type { Facts } from './facts.ts'

const run = (line: string, program?: string) => {
  const argv = line.split(' ')
  return explain({ program: program ?? `/usr/bin/${argv[0]}`, argv })
}
const roles = (line: string) => run(line).args.map((a) => `${a.value}:${a.role}`)

describe('lookup', () => {
  it('keys on the program name, not on the path it was found at', () => {
    expect(run('ls /tmp', '/opt/homebrew/bin/ls').key).toBe('ls')
  })

  it('reaches a row through a version suffix only where the row invites it', () => {
    const py = run('python3 run.py', '/usr/bin/python3')
    expect(py.key).toBe('python')
    expect(py.facts.source).toBe('name-fallback')
    expect(run('base64 -d', '/usr/bin/base64').key).toBeNull()
  })

  it('says plainly when it has no entry, and claims nothing it cannot support', () => {
    const got = run('frobnicate --all', '/usr/local/bin/frobnicate')
    expect(got.key).toBeNull()
    expect(got.facts.confidence).toBe('unknown')
    expect(got.facts.opaque).toBe(true)
    expect(isComplete(got.facts)).toBe(false)
  })

  it('keys on argv[1] as a subcommand, and not when it is a flag', () => {
    expect(run('git push').subcommand).toBe('push')
    expect(run('git --version').subcommand).toBeUndefined()
  })

  it('falls back to the base row for a subcommand it does not hold, and marks it', () => {
    const got = run('git frobnicate')
    expect(got.subcommand).toBe('frobnicate')
    expect(got.facts.confidence).toBe('derived')
    expect(got.facts.source).toBe('subcommand-miss')
  })

  // `git -c core.pager=evil log` still runs `log`; the option before it can also make the whole line run a program.
  it('steps over global options to reach the subcommand', () => {
    const got = run('git -c core.pager=evil log')
    expect(got.subcommand).toBe('log')
    expect(got.facts.says).toBe('Shows the list of save points a project has, newest first.')
    expect(got.facts.opaque).toBe(true)
    expect(effectsOf(got.facts)).toContain('execute')
    expect(got.escalated).toContain('-c')
    expect(got.args[0]).toEqual({ index: 2, value: 'core.pager=evil', role: 'text', flag: '-c' })

    const harmless = run('git -C /tmp/proj status')
    expect(harmless.subcommand).toBe('status')
    expect(harmless.facts.opaque).toBe(false)
    expect(harmless.facts.confidence).toBe('verified')
    expect(harmless.args[0]).toEqual({ index: 2, value: '/tmp/proj', role: 'path', flag: '-C' })
  })

  it('cannot resolve the subcommand behind an option it does not hold, and says so', () => {
    const got = run('git --frobnicate log')
    expect(got.subcommand).toBeUndefined()
    expect(got.facts.confidence).toBe('derived')
    expect(got.facts.source).toBe('subcommand-miss')
  })
})

describe('escalating flags', () => {
  it('turns a file removal into a folder removal', () => {
    const plain = run('rm notes.txt')
    const deep = run('rm -r ~/Documents')
    expect(effectsOf(plain.facts)).toContain('delete')
    expect(deep.escalated).toEqual(['-r'])
    expect(deep.facts.says).not.toBe(plain.facts.says)
  })

  it('reads a bundle of short flags one letter at a time', () => {
    const got = run('tar -xzf backup.tgz')
    expect(got.escalated).toEqual(['-x'])
    expect(effectsOf(got.facts)).toContain('create')
    expect(got.args).toEqual([{ index: 2, value: 'backup.tgz', role: 'path', flag: '-f' }])
  })

  // `tar xf a.tar` carries its flags as a bare first word, which must not read as a file the command was pointed at.
  it('reads an old-style mode word as the flags it bundles', () => {
    const got = run('tar xf a.tar')
    expect(got.escalated).toEqual(['-x'])
    expect(effectsOf(got.facts)).toEqual(expect.arrayContaining(['create', 'write']))
    expect(got.facts.reversible).toBe('no')
    expect(got.args).toEqual([{ index: 2, value: 'a.tar', role: 'path', flag: '-f' }])
  })

  it('goes blind where an unpacking is told to run a program', () => {
    for (const line of ['tar xf a.tar --to-command=sh', 'tar xf a.tar -I sh', 'tar xf a.tar --checkpoint-action=exec=sh']) {
      const got = run(line)
      expect(got.facts.opaque, line).toBe(true)
      if (got.facts.opaque) expect(got.facts.handsOverTo, line).toBeTruthy()
      expect(effectsOf(got.facts), line).toContain('execute')
    }
  })

  it('leaves word flags alone where a program spells them out', () => {
    expect(run('find . -delete').escalated).toEqual(['-delete'])
    expect(run('find . -name *.log').escalated).toEqual([])
  })

  it('turns a download into a write, and an upload into a transmission', () => {
    const save = run('curl -o report.pdf https://example.com/r')
    expect(effectsOf(save.facts)).toEqual(['read', 'write', 'create'])
    expect(save.args).toEqual([
      { index: 2, value: 'report.pdf', role: 'path', flag: '-o' },
      { index: 3, value: 'https://example.com/r', role: 'url' },
    ])
    expect(effectsOf(run('curl -d name=x https://example.com').facts)).toContain('transmit')
  })

  it('reads a flag given with an equals sign, and reports it as the table names it', () => {
    expect(run('curl --output=r.pdf https://example.com').args[0]).toEqual({
      index: 1,
      value: 'r.pdf',
      role: 'path',
      flag: '-o',
    })
  })

  it('lets one flag turn a lookup into a password in plain view', () => {
    const quiet = run('security find-generic-password -s github')
    const loud = run('security find-generic-password -w -s github')
    expect(quiet.facts.touchesCredentials).toBe(true)
    expect(loud.escalated).toEqual(['-w'])
    expect(loud.facts.note).toBeTruthy()
    expect(loud.facts.says).not.toBe(quiet.facts.says)
  })

  it('stops reading flags after a bare double dash', () => {
    expect(roles('rm -- -r')).toEqual(['-r:path'])
    expect(run('rm -- -r').escalated).toEqual([])
  })
})

describe('argument roles', () => {
  it('names what each position is, so a consumer resolves it rather than parsing it', () => {
    expect(roles('chmod 755 /usr/local/bin/tool')).toEqual(['755:mode', '/usr/local/bin/tool:path'])
    expect(roles('kill -9 4821')).toEqual(['4821:pid'])
    expect(roles('ping example.com')).toEqual(['example.com:host'])
    expect(roles('brew install wget')).toEqual(['wget:package'])
    expect(roles('defaults read com.apple.dock orientation')).toEqual(['com.apple.dock:domain', 'orientation:text'])
    expect(roles('chown alex /etc/hosts')).toEqual(['alex:user', '/etc/hosts:path'])
  })

  it('repeats the last role across the rest of the line', () => {
    expect(roles('cp a.txt b.txt c/')).toEqual(['a.txt:path', 'b.txt:path', 'c/:path'])
  })

  it('does not read a role out of the text of an argument', () => {
    expect(roles('ls https://example.com')).toEqual(['https://example.com:path'])
  })
})

describe('opacity', () => {
  it('marks the position where it stops being able to see', () => {
    const got = run('ssh ops@host rm -rf /var/tmp')
    expect(got.facts.opaque).toBe(true)
    expect(got.args).toEqual([
      { index: 1, value: 'ops@host', role: 'host' },
      { index: 2, value: 'rm', role: 'command' },
      { index: 3, value: '-rf', role: 'command' },
      { index: 4, value: '/var/tmp', role: 'command' },
    ])
  })

  it('does not let an opaque row be read as a complete one', () => {
    const got = run('sh -c curl')
    expect(got.facts.opaque).toBe(true)
    // `effect` is absent from the type on an opaque row; this is the only way to the list.
    expect(effectsOf(got.facts)).toEqual(['execute'])
    expect(isComplete(got.facts)).toBe(false)
    expect(got.args).toEqual([{ index: 2, value: 'curl', role: 'command', flag: '-c' }])
  })

  it('carries over to a command that is clear until a flag is added', () => {
    const plain = run('find . -name *.log')
    const exec = run('find . -exec rm {} +')
    expect(plain.facts.opaque).toBe(false)
    expect(exec.facts.opaque).toBe(true)
    expect(exec.facts.repeatSafe).toBe(false)
    // It cannot promise anything can be put back, but `rm` lets it still say that something cannot be.
    expect(exec.facts.reversible).toBe('no')
    expect(run('sh -c anything').facts.reversible).toBe('unknown')
  })

  it('is set for the package installs that run set-up steps of their own', () => {
    for (const line of ['npm install', 'pnpm add left-pad', 'brew install wget', 'pip install requests']) {
      expect(run(line).facts.opaque, line).toBe(true)
    }
  })
})

describe('the command inside the command', () => {
  it('looks up a nested command that runs here, and says where it sits on the line', () => {
    const got = run('sudo rm -rf /var/tmp')
    expect(got.runs?.key).toBe('rm')
    expect(got.runs?.facts.source).toBe('nested')
    expect(got.runs?.facts.confidence).toBe('derived')
    expect(got.runs?.args).toEqual([{ index: 3, value: '/var/tmp', role: 'path' }])
  })

  it('carries what the inner command does up to the outer one', () => {
    const got = run('sudo rm -rf /var/tmp')
    expect(effectsOf(got.facts)).toEqual(['delete', 'execute', 'elevate'])
    expect(got.facts.privilege).toBe('root')
    expect(got.facts.reversible).toBe('no')
  })

  it('never lets the inner command clear the outer one', () => {
    for (const line of ['sudo ls /tmp', 'xargs ls', 'env PATH=/bin ls']) {
      expect(run(line).facts.opaque, line).toBe(true)
      expect(run(line).facts.repeatSafe, line).toBe(false)
    }
  })

  it('steps over the settings env is given before the command', () => {
    const got = run('env FOO=bar node app.js')
    expect(got.runs?.key).toBe('node')
    expect(got.runs?.args).toEqual([{ index: 3, value: 'app.js', role: 'path' }])
  })

  it('reads the command a search hands each file to', () => {
    const got = run('find . -exec rm {} +')
    expect(got.runs?.key).toBe('rm')
    expect(effectsOf(got.facts)).toContain('delete')
  })

  it('will not split a string to find a command inside it', () => {
    expect(run('sh -c rm').runs).toBeUndefined()
    expect(run('node -e x').runs).toBeUndefined()
  })

  it('does not report a command that runs on another computer as one that runs here', () => {
    expect(run('ssh host rm -rf /var/tmp').runs).toBeUndefined()
  })

  it('admits it when the inner command is not one it knows', () => {
    const got = run('sudo frobnicate')
    expect(got.runs?.key).toBeNull()
    expect(got.runs?.facts.confidence).toBe('unknown')
    expect(got.facts.opaque).toBe(true)
  })

  it('stops going deeper rather than following a line without end', () => {
    const argv = [...Array(12).fill('sudo'), 'ls']
    const got = explain({ program: '/usr/bin/sudo', argv })
    let depth = 0
    for (let e = got.runs; e; e = e.runs) depth++
    expect(depth).toBeLessThanOrEqual(4)
  })

  it('has nothing to report where no command was given', () => {
    expect(run('sudo').runs).toBeUndefined()
    expect(run('xargs').runs).toBeUndefined()
  })
})

describe('merge', () => {
  const base: Facts = {
    effect: ['read'],
    reversible: 'yes',
    network: 'none',
    privilege: 'none',
    opaque: false,
    touchesCredentials: false,
    repeatSafe: true,
    confidence: 'verified',
    source: 'curated',
    says: 'Reads a file.',
  }

  it('widens and never narrows', () => {
    const got = merge({ ...base, reversible: 'no', network: 'arbitrary', privilege: 'root' }, {
      reversible: 'yes',
      network: 'none',
      privilege: 'none',
      repeatSafe: true,
      touchesCredentials: false,
    })
    expect(got.reversible).toBe('no')
    expect(got.network).toBe('arbitrary')
    expect(got.privilege).toBe('root')
  })

  it('makes handing over one way', () => {
    const blind = merge(base, { opaque: true, handsOverTo: 'the commands it was given' })
    expect(blind.opaque).toBe(true)
    expect(blind.reversible).toBe('unknown')
    expect(blind.repeatSafe).toBe(false)
    expect(merge(blind, { reversible: 'yes', repeatSafe: true }).opaque).toBe(true)
    expect(merge(blind, { reversible: 'yes', repeatSafe: true }).repeatSafe).toBe(false)
  })

  it('keeps the effect list in one order whichever way a row was built', () => {
    expect(effectsOf(merge(base, { effect: ['delete', 'create'] }))).toEqual(['read', 'create', 'delete'])
  })
})

describe('repeatSafe as a policy input', () => {
  it('is false wherever a standing grant would be wrong', () => {
    for (const line of ['git commit', 'npm install', 'curl -d x https://example.com', 'sudo ls']) {
      expect(run(line).facts.repeatSafe, line).toBe(false)
    }
    expect(run('ls /tmp').facts.repeatSafe).toBe(true)
  })
})
