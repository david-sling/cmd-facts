import { describe, expect, it } from 'vitest'
import { effectsOf, explain } from './index.ts'

describe('accuracy of the developer tool rows', () => {
  it('steps over a one-time code before the subcommand, and reads publishing as using the saved sign-in', () => {
    const otp = explain('npm --otp 123456 publish')
    expect(otp.subcommand).toBe('publish')
    expect(otp.facts.confidence).toBe('verified')
    expect(effectsOf(otp.facts)).toContain('transmit')
    expect(otp.facts.touchesCredentials).toBe(true)
    expect(otp.unread).toBeUndefined()
    for (const line of ['npm publish', 'pnpm publish']) expect(explain(line).facts.touchesCredentials, line).toBe(true)
  })

  it('reads the options that share a part of this computer as reaching past the sealed-off copy', () => {
    for (const line of [
      'docker run --pid=host ubuntu',
      'docker run --ipc=host ubuntu',
      'docker run --uts=host ubuntu',
      'docker run --userns=host ubuntu',
      'docker run --network host ubuntu',
      'docker run --security-opt seccomp=unconfined ubuntu',
      'docker run --security-opt apparmor=unconfined ubuntu',
      'docker run --security-opt label=disable ubuntu',
      'docker run --device-cgroup-rule "b *:* rmw" ubuntu',
    ]) {
      const got = explain(line)
      expect(got.facts.privilege, line).toBe('root')
      expect(effectsOf(got.facts), line).toContain('elevate')
      expect(got.facts.confidence, line).toBe('verified')
    }
    expect(effectsOf(explain('docker run --pid=host ubuntu').facts)).toContain('terminate')
    expect(effectsOf(explain('docker run --cgroupns host ubuntu').facts)).toContain('read')
  })

  it('reads a folder or device of this computer as in the full control of the packaged program', () => {
    for (const line of [
      'docker run -v /:/host ubuntu',
      'docker run --mount type=bind,src=/,dst=/host ubuntu',
      'docker run -v /var/run/docker.sock:/var/run/docker.sock ubuntu',
      'docker run --volumes-from other ubuntu',
      'docker run --device /dev/sda ubuntu',
      'docker run --cap-add NET_BIND_SERVICE ubuntu',
    ]) {
      expect(explain(line).facts.privilege, line).toBe('root')
    }
  })

  it('reads the other spellings of run, create and exec with the same flags', () => {
    for (const line of [
      'docker create --privileged ubuntu',
      'docker container run --privileged ubuntu',
      'docker container create --privileged ubuntu',
      'docker container exec --privileged web sh',
      'docker compose exec --privileged web sh',
      'podman create --privileged ubuntu',
      'podman container run --privileged ubuntu',
    ]) {
      const got = explain(line)
      expect(got.facts.privilege, line).toBe('root')
      expect(got.facts.confidence, line).toBe('verified')
    }
    const created = explain('docker create ubuntu')
    expect(created.facts.opaque).toBe(false)
    expect(effectsOf(created.facts)).not.toContain('execute')
  })

  it('steps over the options that say where Docker finds the service that runs programs', () => {
    const context = explain('docker --context prod run --privileged ubuntu')
    expect(context.subcommand).toBe('run')
    expect(context.facts.confidence).toBe('verified')
    expect(context.facts.privilege).toBe('root')
    expect(context.facts.touchesCredentials).toBe(true)
    const remote = explain('docker -H ssh://build.example.com ps')
    expect(remote.subcommand).toBe('ps')
    expect(remote.facts.network).toBe('arbitrary')
    expect(remote.args[0]).toMatchObject({ value: 'ssh://build.example.com', role: 'url', flag: '-H' })
    expect(explain('docker -l debug --tls --tlskey key.pem images').facts.touchesCredentials).toBe(true)
  })

  it('reads a file of settings handed to a one-off packaged program as holding secrets', () => {
    const got = explain('docker compose run --env-from-file .env web sh')
    expect(got.facts.touchesCredentials).toBe(true)
    expect(got.facts.confidence).toBe('verified')
    expect(got.args.map((a) => a.role)).toEqual(['path', 'text', 'command'])
  })

  it('names the mount option as the one that took its value', () => {
    const got = explain('docker run --mount type=bind,src=/,dst=/host ubuntu')
    expect(got.args[0]).toEqual({ index: 3, value: 'type=bind,src=/,dst=/host', role: 'text', flag: '--mount' })
  })

  it("reads GNU xargs' delimiter and argument file before the command it runs", () => {
    const delimited = explain('xargs -d x rm')
    expect(delimited.unread).toBeUndefined()
    expect(delimited.runs?.key).toBe('rm')
    expect(effectsOf(delimited.facts)).toContain('delete')
    const fromFile = explain('xargs -a list.txt rm')
    expect(fromFile.runs?.key).toBe('rm')
    expect(fromFile.args[0]).toMatchObject({ value: 'list.txt', role: 'path', flag: '-a' })
  })

  it('does not read a two-word sqlite3 memory option as taking one', () => {
    for (const line of ['sqlite3 -lookaside 100 50 db.sqlite', 'sqlite3 -pagecache 4096 64 db.sqlite']) {
      const got = explain(line)
      expect(got.facts.confidence, line).toBe('derived')
      expect(got.args.every((a) => a.role === 'unknown'), line).toBe(true)
    }
  })

  it('does not read the word after sudo -h as the command', () => {
    const got = explain('sudo -h somehost ls')
    expect(got.unread).toContain('-h')
    expect(got.args.some((a) => a.role === 'command')).toBe(false)
  })
})
