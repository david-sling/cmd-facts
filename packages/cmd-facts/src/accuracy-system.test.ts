import { describe, expect, it } from 'vitest'
import { effectsOf, explain } from './index.ts'

const roles = (line: string) => explain(line).args.map((a) => `${a.value}:${a.role}`)

describe('network commands answer what the line does', () => {
  it('ssh: -R reaches onward from this computer, -A lends its keys, -E writes a log', () => {
    expect(explain('ssh -R 8080 host').facts).toMatchObject({ network: 'arbitrary', confidence: 'verified' })
    expect(explain('ssh -A host').facts.touchesCredentials).toBe(true)
    const logged = explain('ssh -E ssh.log host')
    expect(effectsOf(logged.facts)).toEqual(expect.arrayContaining(['create', 'write']))
    expect(roles('ssh -E ssh.log host')).toEqual(['ssh.log:path', 'host:host'])
  })

  it('curl: a trace file holds the whole exchange, and the other dump files are written too', () => {
    const traced = explain('curl --trace t.log https://x.example').facts
    expect(effectsOf(traced)).toEqual(expect.arrayContaining(['create', 'write']))
    expect(traced).toMatchObject({ reversible: 'no', touchesCredentials: true, confidence: 'verified' })
    for (const line of [
      'curl --trace-ascii t.log https://x.example',
      'curl --etag-save e.txt https://x.example',
      'curl --libcurl c.c https://x.example',
      'curl --alt-svc a.txt https://x.example',
    ]) {
      expect(explain(line).facts.reversible, line).toBe('no')
      expect(effectsOf(explain(line).facts), line).toContain('write')
    }
  })

  it('ping: -b is an interface on macOS but a switch on Linux, so it is unread', () => {
    const got = explain('ping -b en0 host')
    expect(got.unread).toEqual(['-b'])
    expect(got.facts.confidence).toBe('derived')
  })

  it('arp: -f sets entries from a file', () => {
    const got = explain('arp -f entries.txt')
    expect(got.facts).toMatchObject({ privilege: 'admin', confidence: 'verified' })
    expect(effectsOf(got.facts)).toContain('configure')
    expect(roles('arp -f entries.txt')).toEqual(['entries.txt:path'])
  })

  it('wget: an askpass program or settings runs unseen, a second fetch is not the same, and a WARC file is written', () => {
    expect(explain('wget --use-askpass /usr/local/bin/ask https://x.example/a').facts).toMatchObject({ opaque: true, touchesCredentials: true })
    expect(explain('wget -e use_askpass=/tmp/p https://x.example/a').facts.opaque).toBe(true)
    expect(explain('wget --config my.wgetrc https://x.example/a').facts.opaque).toBe(true)
    expect(explain('wget https://x.example/a').facts.repeatSafe).toBe(false)
    const warc = explain('wget --warc-file arc https://x.example/a')
    expect(warc.facts.confidence).toBe('verified')
    expect(roles('wget --warc-file arc https://x.example/a')).toEqual(['arc:path', 'https://x.example/a:url'])
  })

  it('rsync: --daemon waits for connections and runs what its settings name', () => {
    const got = explain('rsync --daemon --config /tmp/r.conf')
    expect(got.facts).toMatchObject({ network: 'listens', opaque: true, confidence: 'verified' })
    expect(roles('rsync --daemon --config /tmp/r.conf')).toEqual(['/tmp/r.conf:path'])
  })

  it('nc: -c is a switch on macOS but runs a command on Linux, so it stays unread', () => {
    const got = explain('nc -c sh host 80')
    expect(got.unread).toEqual(['-c'])
    expect(got.facts).toMatchObject({ opaque: true, confidence: 'derived' })
  })

  it('netstat: -p names a protocol on macOS but is a switch on Linux, so it is unread', () => {
    expect(explain('netstat -p tcp').unread).toContain('-p')
    expect(explain('netstat -tulpn').facts.confidence).toBe('derived')
  })
})

describe('system commands answer what the line does', () => {
  it('env: -C takes the folder to start in, and the command after it is still found', () => {
    const got = explain('env -C /tmp rm -rf x')
    expect(got.unread).toBeUndefined()
    expect(got.args[0]).toMatchObject({ value: '/tmp', role: 'path', flag: '-C' })
    expect(got.runs?.name).toBe('rm')
  })

  it("crontab: -u reaches another account's schedule, which needs the administrator", () => {
    expect(explain('crontab -u bob jobs.txt').facts).toMatchObject({ privilege: 'admin', confidence: 'verified' })
  })

  it('scutil: with no option, --prefs, --nc and --renew all change things', () => {
    expect(explain('scutil').facts.opaque).toBe(true)
    expect(effectsOf(explain('scutil --prefs').facts)).toContain('configure')
    const vpn = explain('scutil --nc start Work --password x')
    expect(vpn.facts).toMatchObject({ network: 'known-host', touchesCredentials: true, confidence: 'verified' })
    expect(effectsOf(explain('scutil --renew en0').facts)).toContain('configure')
    expect(effectsOf(explain('scutil --set HostName foo').facts)).toContain('configure')
  })

  it('sysadminctl: autologin, a new password and the login window clock are changes', () => {
    const auto = explain('sysadminctl -autologin set -userName bob -password x')
    expect(auto.facts).toMatchObject({ touchesCredentials: true, confidence: 'verified' })
    expect(effectsOf(auto.facts)).toContain('configure')
    expect(roles('sysadminctl -autologin set -userName bob -password x')).toEqual(['set:text', 'bob:user', 'x:text'])
    const pw = explain('sysadminctl -newPassword n -oldPassword o')
    expect(pw.facts.reversible).toBe('no')
    expect(effectsOf(pw.facts)).toContain('configure')
    expect(effectsOf(explain('sysadminctl -use12HourClockForLoginWindow on').facts)).toContain('configure')
    expect(explain('sysadminctl -newPassword n -oldPassword o -passwordHint h').unread).toBeUndefined()
  })

  it('dscl: the plist and index commands are read as changes', () => {
    expect(explain('dscl . -createpl /Users/bob K p v').facts).toMatchObject({ privilege: 'admin', confidence: 'verified' })
    expect(effectsOf(explain('dscl . -deletepl /Users/bob K p').facts)).toContain('delete')
    expect(effectsOf(explain('dscl . -changei /Users/bob K 1 v').facts)).toContain('configure')
  })

  it('dscl: a command written without its dash after the source is read as that command', () => {
    const create = explain('dscl . create /Users/bob')
    expect(create.facts).toMatchObject({ privilege: 'admin', confidence: 'verified' })
    expect(effectsOf(create.facts)).toContain('create')
    expect(effectsOf(explain('dscl -u admin -P pw . delete /Users/bob').facts)).toContain('delete')
    expect(explain('dscl . read /Users/bob').facts).toMatchObject({ privilege: 'none', confidence: 'verified' })
    const odd = explain('dscl . frobnicate /Users/bob')
    expect(odd.facts.confidence).toBe('derived')
    expect(odd.unread).toEqual(['frobnicate'])
    // Only the word straight after the source is a command; after a dashed one, a bare word is an operand.
    expect(explain('dscl . -list Users').unread).toBeUndefined()
  })

  it('hdiutil: attach can fetch from the web, -passphrase takes its value, create keeps an existing file', () => {
    const web = explain('hdiutil attach https://x.example/a.dmg')
    expect(web.facts.network).toBe('arbitrary')
    expect(roles('hdiutil attach https://x.example/a.dmg')).toEqual(['https://x.example/a.dmg:text'])
    expect(roles('hdiutil attach -passphrase p a.dmg')).toEqual(['p:text', 'a.dmg:text'])
    expect(explain('hdiutil attach -passphrase p a.dmg').facts).toMatchObject({ touchesCredentials: true, confidence: 'verified' })
    expect(roles('hdiutil attach -shadow a.dmg')).toEqual(['a.dmg:text'])
    expect(explain('hdiutil create -size 1g a.dmg').facts.note).toBeUndefined()
    expect(explain('hdiutil create -ov -size 1g a.dmg').facts.reversible).toBe('no')
    expect(explain('hdiutil erasekeys a.dmg').facts).toMatchObject({ reversible: 'no', confidence: 'verified' })
    expect(explain('hdiutil chpass a.dmg').facts).toMatchObject({ touchesCredentials: true, confidence: 'verified' })
  })

  it('tmutil: listing backups needs the administrator, and thinning removes snapshots', () => {
    expect(explain('tmutil listbackups').facts.privilege).toBe('admin')
    expect(explain('tmutil latestbackup').facts.privilege).toBe('admin')
    expect(effectsOf(explain('tmutil thinlocalsnapshots /').facts)).toContain('delete')
    expect(explain('tmutil deleteinprogress /Volumes/B/x').facts).toMatchObject({ reversible: 'no', confidence: 'verified' })
  })

  it('codesign: --timestamp takes only an attached address and reaches the network', () => {
    expect(roles('codesign -s ID --timestamp My.app')).toEqual(['ID:text', 'My.app:path'])
    expect(explain('codesign -s ID --timestamp My.app').facts.network).toBe('arbitrary')
    expect(roles('codesign -s ID --timestamp=http://ts.example My.app')).toEqual(['ID:text', 'http://ts.example:url', 'My.app:path'])
  })

  it('say: -n offers the speech on the network, and the sound file options take values', () => {
    expect(explain('say -n host:9000 hi').facts).toMatchObject({ network: 'listens', confidence: 'verified' })
    const line = 'say -o a.m4a --file-format m4af --channels 1 --bit-rate 64000 --quality 127 hi'
    expect(explain(line).unread).toBeUndefined()
    expect(roles(line).at(-1)).toBe('hi:text')
  })

  it('plutil: -create makes a file, -extract takes a key and a format, -insert reads its kind of value', () => {
    const made = explain('plutil -create xml1 a.plist')
    expect(made.facts).toMatchObject({ reversible: 'no', confidence: 'verified' })
    expect(effectsOf(made.facts)).toContain('create')
    expect(roles('plutil -extract Foo raw a.plist')).toEqual(['Foo:text', 'raw:text', 'a.plist:path'])
    expect(roles('plutil -insert Foo -string bar a.plist')).toEqual(['Foo:text', 'bar:text', 'a.plist:path'])
    expect(explain('plutil -insert Foo -string bar a.plist').facts.confidence).toBe('verified')
  })

  it('killall: -s is a dry run on macOS but takes a signal on Linux, so it is unread', () => {
    expect(explain('killall -s Finder').unread).toEqual(['-s'])
  })

  it('shutdown: -s puts the computer to sleep', () => {
    expect(explain('shutdown -s now').sentence).toBe('Puts this computer to sleep.')
  })

  it('pkill: -f matches the whole command, not only the name', () => {
    expect(explain('pkill -f node').sentence).toBe('Stops the running programs whose whole command, not only the name, matches node.')
  })
})
