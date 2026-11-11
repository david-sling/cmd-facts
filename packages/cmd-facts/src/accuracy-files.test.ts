import { describe, expect, it } from 'vitest'
import { explain } from './index.ts'
import { effectsOf } from './facts.ts'

const roles = (line: string) => explain(line).args.map((a) => `${a.value}:${a.role}`)

describe('files and keys, read as the manuals have them', () => {
  it('reads the xattr modes as taking nothing, with the label named by the first operand', () => {
    expect(roles('xattr -dr com.apple.quarantine /Applications/X.app')).toEqual([
      'com.apple.quarantine:text',
      '/Applications/X.app:path',
    ])
    expect(roles('xattr -d -r name dir')).toEqual(['name:text', 'dir:path'])
    expect(roles('xattr -w -r name val dir')).toEqual(['name:text', 'val:text', 'dir:path'])
    expect(roles('xattr -p -l name f')).toEqual(['name:text', 'f:path'])
    expect(explain('xattr -dr com.apple.quarantine /Applications/X.app').facts.confidence).toBe('verified')
  })

  it('keeps the removal in the sentence when xattr also goes inside a folder', () => {
    const cleared = explain('xattr -cr X.app')
    expect(cleared.sentence).toBe('Removes hidden labels from X.app.')
    expect(cleared.facts.note).toMatch(/every file kept inside/)
    expect(effectsOf(cleared.facts)).toContain('delete')
  })

  it('reads ln -F as removing what is in the way, and ln -t as naming the folder first', () => {
    const forced = explain('ln -sF a b')
    expect(effectsOf(forced.facts)).toContain('delete')
    expect(forced.facts.reversible).toBe('no')
    expect(forced.facts.confidence).toBe('verified')
    expect(explain('ln -t /usr/local/bin /opt/x/bin/foo').sentence).toBe('Puts a second name for /opt/x/bin/foo inside /usr/local/bin.')
    expect(roles('ln -S .bak -f a b')).toEqual(['.bak:text', 'a:path', 'b:path'])
  })

  it('does not read stat -f as taking a value, since on Linux it takes none', () => {
    const got = explain('stat -f /')
    expect(got.unread).toEqual(['-f'])
    expect(got.facts.confidence).toBe('derived')
  })

  it('reads file -C as saving a new file', () => {
    const got = explain('file -C')
    expect(effectsOf(got.facts)).toEqual(expect.arrayContaining(['create', 'write']))
    expect(got.facts.reversible).toBe('no')
  })

  it('reads more -o as saving a copy, as less does', () => {
    const got = explain('more -o log file')
    expect(got.sentence).toBe('Shows what is written inside file and saves a copy into log.')
    expect(effectsOf(got.facts)).toContain('write')
    expect(got.facts.confidence).toBe('verified')
  })

  it('reads the value each of these flags takes', () => {
    expect(roles('md5 -s str')).toEqual(['str:text'])
    expect(roles('md5 -c abc f')).toEqual(['abc:text', 'f:path'])
    expect(roles('zip -t 2024-01-01 -tt 2025-01-01 -Z store -ds 10m a.zip f')).toEqual([
      '2024-01-01:text',
      '2025-01-01:text',
      'store:text',
      '10m:text',
      'a.zip:path',
      'f:path',
    ])
    const logged = explain('zip -lf log.txt a.zip f')
    expect(logged.args[0]).toMatchObject({ value: 'log.txt', role: 'path' })
    expect(logged.facts.reversible).toBe('no')
    expect(roles('diff -A myers --tabsize 4 a b')).toEqual(['myers:text', '4:text', 'a:path', 'b:path'])
    expect(roles('sort --parallel 4 f')).toEqual(['4:text', 'f:path'])
    expect(roles('less -# 8 f')).toEqual(['8:text', 'f:path'])
    expect(roles('realpath --relative-to /a /a/b')).toEqual(['/a:path', '/a/b:path'])
    expect(roles('cut --output-delimiter , -f1 f')).toEqual([',:text', '1:text', 'f:path'])
  })

  it('reads zip -e as reaching a password, as -P does', () => {
    expect(explain('zip -e a.zip f').facts.touchesCredentials).toBe(true)
  })

  it('reads a library ssh-keygen is told to load as running code it cannot see', () => {
    for (const line of ['ssh-keygen -D lib.so', 'ssh-keygen -w prov.so -t ed25519-sk']) {
      const got = explain(line)
      expect(got.facts.opaque, line).toBe(true)
      expect(got.args[0], line).toMatchObject({ role: 'path' })
    }
  })

  it('says what ssh-add -K does on a Mac and elsewhere', () => {
    expect(explain('ssh-add -K').facts.note).toMatch(/elsewhere it loads keys kept on a hardware key/)
  })

  it('reads ssh-keygen -R as keeping the old list', () => {
    const got = explain('ssh-keygen -R host')
    expect(got.facts.reversible).toBe('unknown')
    expect(got.facts.note).toMatch(/\.old/)
  })

  it('does not read base64 -i or df -T as taking a value, since on Linux neither does', () => {
    expect(explain('base64 -i f').unread).toEqual(['-i'])
    expect(explain('df -T apfs').unread).toContain('-T')
    expect(explain('df -T apfs').facts.confidence).toBe('derived')
  })
})
