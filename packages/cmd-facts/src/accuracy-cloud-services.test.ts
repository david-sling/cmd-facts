import { describe, expect, it } from 'vitest'
import { effectsOf, explain } from './index.ts'

const roles = (line: string) => explain(line).args.map((a) => `${a.value}:${a.role}`)

describe('cloud services, as their manuals describe them', () => {
  it('hands helm uninstall and rollback over to the steps a chart runs on the cluster', () => {
    for (const line of ['helm uninstall web', 'helm rollback web 2']) {
      const { facts } = explain(line)
      expect(facts.opaque, line).toBe(true)
      expect(effectsOf(facts), line).toContain('execute')
      expect(facts.confidence, line).toBe('verified')
    }
  })

  it('marks vercel build and vercel dev as reaching the secret settings they download', () => {
    for (const line of ['vercel build', 'vercel dev']) {
      expect(explain(line).facts.touchesCredentials, line).toBe(true)
      expect(explain(line).facts.note, line).toMatch(/secret settings/)
    }
  })

  it('reads gcloud config config-helper as showing a live key', () => {
    const { facts, subcommand } = explain('gcloud config config-helper')
    expect(subcommand).toBe('config config-helper')
    expect(facts.touchesCredentials).toBe(true)
    expect(facts.confidence).toBe('verified')
    expect(facts.note).toMatch(/act as the account/)
  })

  it('marks gcloud compute ssh and scp as making a key and adding it to the project', () => {
    for (const line of ['gcloud compute ssh vm', 'gcloud compute scp notes.txt vm:notes.txt']) {
      const { facts } = explain(line)
      expect(facts.touchesCredentials, line).toBe(true)
      expect(effectsOf(facts), line).toEqual(expect.arrayContaining(['create', 'configure']))
    }
    expect(roles('gcloud compute ssh --internal-ip vm')).toEqual(['vm:text'])
  })

  it('does not call stopping a cloud computer fully reversible', () => {
    const aws = explain('aws ec2 stop-instances --instance-ids i-1').facts
    expect(aws.reversible).toBe('no')
    expect(aws.says).not.toMatch(/keeping their disks\./)
    expect(explain('gcloud compute instances stop vm').facts.reversible).toBe('unknown')
    expect(explain('gcloud compute instances stop vm --discard-local-ssd').facts.reversible).toBe('no')
  })

  it('reads gcloud secrets versions access --out-file as writing the secret to a file', () => {
    const got = explain('gcloud secrets versions access latest --secret=pw --out-file=pw.txt')
    expect(effectsOf(got.facts)).toEqual(expect.arrayContaining(['read', 'create', 'write']))
    expect(got.facts.reversible).toBe('no')
    expect(got.args.find((a) => a.flag === '--out-file')?.role).toBe('path')
  })

  it('reads the aws s3 value options the manual lists', () => {
    const cp = explain('aws s3 cp a s3://b/c --sse-c AES256 --sse-c-key k')
    expect(cp.unread).toBeUndefined()
    expect(cp.facts.confidence).toBe('verified')
    expect(cp.facts.touchesCredentials).toBe(true)
    expect(explain('aws s3 sync . s3://b --progress-frequency 5').facts.confidence).toBe('verified')
    const rm = explain('aws s3 rm s3://b/c --request-payer requester')
    expect(rm.subcommand).toBe('s3 rm')
    expect(rm.facts.confidence).toBe('verified')
    expect(roles('aws s3 rm s3://b/c --request-payer requester')).toEqual(['s3://b/c:url', 'requester:text'])
  })

  it('answers each gcloud auth application-default command on its own', () => {
    const login = explain('gcloud auth application-default login')
    expect(login.subcommand).toBe('auth application-default login')
    expect(login.facts.note).toBeUndefined()
    expect(explain('gcloud auth application-default print-access-token').facts.note).toMatch(/act as the account/)
  })

  it('notes that vercel deploy --target can replace the live site', () => {
    expect(explain('vercel deploy --target production').facts.note).toMatch(/live address/)
  })

  it('reaches helm and vercel rows through their short options and aliases', () => {
    expect(explain('helm install web ./chart -l team=a').unread).toBeUndefined()
    expect(explain('helm install web ./chart -l team=a').facts.confidence).toBe('verified')
    const keys: Record<string, string> = {
      'vercel env remove API_KEY': 'env remove',
      'helm delete web': 'delete',
      'helm del web': 'del',
      'helm un web': 'un',
      'helm repo rm stable': 'repo rm',
      'helm repo ls': 'repo ls',
      'helm plugin ls': 'plugin ls',
      'helm plugin rm secrets': 'plugin rm',
      'helm repo index .': 'repo index',
    }
    for (const [line, key] of Object.entries(keys)) {
      expect(explain(line).subcommand, line).toBe(key)
      expect(explain(line).facts.confidence, line).toBe('verified')
    }
    expect(effectsOf(explain('helm delete web').facts)).toContain('delete')
    expect(effectsOf(explain('helm repo index .').facts)).toEqual(expect.arrayContaining(['create', 'write']))
  })

  it('accounts for the rest of what these tools do that the rows had missed', () => {
    // A downloader add-on runs wherever a set or a settings file is named by an address it claims.
    expect(explain('helm template web ./chart').facts.opaque).toBe(true)
    expect(explain('helm lint ./chart -f secrets://values.yaml').facts.opaque).toBe(true)
    expect(explain('op item get db --format json').facts.note).toMatch(/readable form/)
    expect(roles('doppler run --only-secrets NAME -- node app.js')).toEqual(['NAME:text', 'node:command', 'app.js:command'])
    expect(explain('doppler secrets download').facts.says).toMatch(/passphrase/)
    expect(explain('gcloud components repositories add https://example.com/c.json').facts.network).toBe('arbitrary')
    expect(explain('helm package --sign --key me ./chart').facts.touchesCredentials).toBe(true)
    const debug = explain('aws --debug s3 ls')
    expect(debug.subcommand).toBe('s3 ls')
    expect(debug.facts.touchesCredentials).toBe(true)
    expect(explain('aws --no-cli-pager s3 ls').subcommand).toBe('s3 ls')
  })
})
