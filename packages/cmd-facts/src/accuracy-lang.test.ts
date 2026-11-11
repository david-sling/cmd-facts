import { describe, expect, it } from 'vitest'
import { effectsOf, explain } from './index.ts'

const roles = (line: string) => explain(line).args.map((a) => `${a.value}:${a.role}`)

describe('language tools, read against their manuals', () => {
  it('says that taking a package out can run code and reach the network', () => {
    for (const line of ['yarn remove lodash', 'composer remove foo/bar', 'conda remove numpy', 'gem uninstall rails', 'bun remove x', 'poetry remove x']) {
      const { facts } = explain(line)
      expect(facts.opaque, line).toBe(true)
      expect(facts.network, line).toBe('arbitrary')
      expect(facts.confidence, line).toBe('verified')
    }
    expect(explain('cargo remove serde').facts.network).toBe('arbitrary')
  })

  it('says that go env -w changes settings, and that any go command may fetch a newer Go first', () => {
    const { facts } = explain('go env -w GOPROXY=https://proxy.example')
    expect(effectsOf(facts)).toContain('configure')
    expect(facts.confidence).toBe('verified')
    expect(effectsOf(explain('go env -u GOPROXY').facts)).toContain('configure')
    expect(explain('go version').facts.network).toBe('arbitrary')
  })

  it('reads gem list --remote as reaching the network, and leaves its optional proxy value unread', () => {
    for (const line of ['gem list -r rails', 'gem list --remote', 'gem list -b']) {
      expect(explain(line).facts.network, line).toBe('arbitrary')
      expect(explain(line).facts.confidence, line).toBe('verified')
    }
    expect(explain('gem list -p http://proxy.example').unread).toEqual(['-p'])
  })

  it('reads the sign-in poetry publish is handed on the line', () => {
    const line = explain('poetry publish -u me -p hunter2')
    expect(line.facts.touchesCredentials).toBe(true)
    expect(line.facts.confidence).toBe('verified')
    expect(roles('poetry publish -u me -p hunter2')).toEqual(['me:user', 'hunter2:text'])
  })

  it('says every publish uses the sign-in the tool keeps', () => {
    for (const line of ['cargo publish', 'yarn publish', 'bun publish', 'poetry publish']) {
      expect(explain(line).facts.touchesCredentials, line).toBe(true)
    }
  })

  it('answers gem push, deno publish and yarn npm publish as sending code out', () => {
    for (const line of ['gem push x-1.0.gem', 'deno publish', 'yarn npm publish']) {
      const { facts } = explain(line)
      expect(effectsOf(facts), line).toContain('transmit')
      expect(facts.touchesCredentials, line).toBe(true)
      expect(facts.confidence, line).toBe('verified')
    }
  })

  it('reads xcrun -sdk as taking the name of an SDK', () => {
    const line = explain('xcrun -sdk iphoneos clang -c x.c')
    expect(line.unread).toBeUndefined()
    expect(line.runs?.name).toBe('clang')
    expect(roles('xcrun -sdk iphoneos clang -c x.c')[0]).toBe('iphoneos:text')
  })

  it('says xcodebuild may change the Apple developer account it signs in to', () => {
    const updates = explain('xcodebuild -allowProvisioningUpdates -scheme App')
    expect(updates.facts.touchesCredentials).toBe(true)
    expect(effectsOf(updates.facts)).toContain('configure')
    expect(updates.facts.confidence).toBe('verified')
    const key = explain('xcodebuild -authenticationKeyPath key.p8 -authenticationKeyID AB12 -authenticationKeyIssuerID 69a6 -scheme App')
    expect(key.facts.touchesCredentials).toBe(true)
    expect(key.args.map((a) => a.role)).toEqual(['path', 'text', 'text', 'text'])
  })

  it('puts the values of these options where they belong', () => {
    expect(roles('ruby -E UTF-8 script.rb')).toEqual(['UTF-8:text', 'script.rb:path'])
    expect(roles('perl -I lib script.pl')).toEqual(['lib:path', 'script.pl:path'])
    expect(roles('php -S 0.0.0.0:8000 -t public')).toEqual(['0.0.0.0:8000:host', 'public:path'])
    expect(roles('ninja -C build')).toEqual(['build:path'])
    expect(roles('composer remove foo/bar -d app')).toEqual(['foo/bar:package', 'app:path'])
    expect(roles('deno install -g -n tool https://example.com/tool.ts')).toEqual(['tool:text', 'https://example.com/tool.ts:package'])
    expect(roles('cargo new --bin foo')).toEqual(['foo:path'])
    expect(explain('cargo init --bin').facts.confidence).toBe('verified')
  })

  it('says deno install -g is for this account, and reads swift build as a build', () => {
    expect(explain('deno install -g npm:cowsay').facts.says).not.toMatch(/anyone/)
    const build = explain('swift build')
    expect(build.facts.says).toBe('Builds a project written in Swift into a program.')
    expect(build.args).toEqual([])
    expect(explain('swift test').facts.confidence).toBe('verified')
  })

  it('names the delete cmake -E can do, and reads inline code as code', () => {
    expect(effectsOf(explain('cmake -E rm -rf build').facts)).toContain('delete')
    expect(roles('bun -e "console.log(1)"')).toEqual(['console.log(1):command'])
    expect(roles('deno eval "console.log(1)"')).toEqual(['console.log(1):command'])
  })
})
