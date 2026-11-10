import { describe, expect, it } from 'vitest'
import { effectsOf, explain } from './index.ts'

const facts = (line: string) => explain(line).facts
const roles = (line: string) => explain(line).args.map((a) => `${a.value}:${a.role}`)

describe('kubectl', () => {
  it('reads auth reconcile as changing access roles, not as a check', () => {
    const e = explain('kubectl auth reconcile -f rbac.yaml')
    expect(e.facts.confidence).toBe('verified')
    expect(effectsOf(e.facts)).toEqual(expect.arrayContaining(['create', 'write']))
    expect(effectsOf(facts('kubectl auth reconcile'))).toContain('write')
    expect(effectsOf(facts('kubectl auth can-i get pods'))).toEqual(['read'])
    expect(explain('kubectl auth frobnicate').facts.confidence).toBe('derived')
  })

  it('reads config view --flatten as showing the keys', () => {
    const f = facts('kubectl config view --flatten')
    expect(f.touchesCredentials).toBe(true)
    expect(f.confidence).toBe('verified')
  })

  it('reads cluster-info dump as writing files when given a folder', () => {
    const f = facts('kubectl cluster-info dump --output-directory d')
    expect(f.confidence).toBe('verified')
    expect(effectsOf(f)).toEqual(expect.arrayContaining(['create', 'write']))
    expect(roles('kubectl cluster-info dump --output-directory d')).toEqual(['d:path'])
  })

  it('reads drain --force as removing programs for good', () => {
    const f = facts('kubectl drain n1 --force')
    expect(f.confidence).toBe('verified')
    expect(effectsOf(f)).toContain('delete')
    expect(f.reversible).toBe('no')
    expect(facts('kubectl drain n1 --disable-eviction').confidence).toBe('verified')
  })

  it('reads -f as able to fetch from any address', () => {
    for (const line of ['kubectl apply -f https://x.example/a.yaml', 'kubectl delete -f a.yaml', 'kubectl get -f a.yaml', 'kubectl create -f a.yaml']) {
      expect(facts(line).network, line).toBe('arbitrary')
    }
    expect(facts('kubectl get pods').network).toBe('known-host')
  })

  it("reads proxy as lending the account's access, and port-forward --address as open to others", () => {
    expect(facts('kubectl proxy').touchesCredentials).toBe(true)
    const f = facts('kubectl port-forward --address 0.0.0.0 svc/web 8080:80')
    expect(f.confidence).toBe('verified')
    expect(f.note).toMatch(/Other computers/)
  })
})

describe('gh', () => {
  it('reads repo deploy-key add as handing over access', () => {
    const f = facts('gh repo deploy-key add key.pub')
    expect(f.confidence).toBe('verified')
    expect(f.touchesCredentials).toBe(true)
  })

  it('reads repo fork and gist clone as handing words after a double dash to the copying program', () => {
    const fork = facts('gh repo fork o/r --clone -- --template=x')
    expect(fork.opaque).toBe(true)
    expect(fork.confidence).toBe('verified')
    expect(facts('gh gist clone abc -- -c x=y').opaque).toBe(true)
  })

  it('reads release upload --clobber as removing the files already there', () => {
    const f = facts('gh release upload v1 a.zip --clobber')
    expect(f.confidence).toBe('verified')
    expect(effectsOf(f)).toContain('delete')
  })

  it('reads gh api as reaching secrets and any host', () => {
    const f = facts('gh api repos/o/r')
    expect(f.touchesCredentials).toBe(true)
    expect(f.network).toBe('arbitrary')
  })

  it('reads secret -u and --remove-milestone as switches', () => {
    expect(roles('gh secret set -u API_KEY -b x')).toEqual(['API_KEY:text', 'x:text'])
    expect(roles('gh secret delete --user API_KEY')).toEqual(['API_KEY:text'])
    expect(roles('gh issue edit --remove-milestone 23')).toEqual(['23:text'])
  })

  it('reads closing and reopening as telling the people watching, and sign-in and connecting as making keys', () => {
    for (const line of ['gh pr close 1', 'gh pr reopen 1', 'gh issue close 1', 'gh issue reopen 1']) {
      expect(facts(line).reversible, line).toBe('no')
    }
    expect(effectsOf(facts('gh auth login'))).toContain('transmit')
    expect(facts('gh codespace ssh').touchesCredentials).toBe(true)
  })
})

describe('terraform', () => {
  it('reads providers mirror, lock and schema as downloading or starting the plugins', () => {
    const mirror = facts('terraform providers mirror ./m')
    expect(mirror.confidence).toBe('verified')
    expect(mirror.network).toBe('arbitrary')
    expect(effectsOf(mirror)).toEqual(expect.arrayContaining(['create', 'write']))
    expect(effectsOf(facts('terraform providers lock'))).toContain('write')
    expect(facts('terraform providers schema -json').opaque).toBe(true)
  })

  it('reads two dashes the same as one', () => {
    const apply = facts('terraform apply --auto-approve')
    expect(apply.confidence).toBe('verified')
    expect(apply.note).toBe(facts('terraform apply -auto-approve').note)
    const plan = explain('terraform plan --out plan.bin')
    expect(plan.facts.confidence).toBe('verified')
    expect(effectsOf(plan.facts)).toContain('create')
    expect(roles('tofu plan --out plan.bin')).toEqual(['plan.bin:path'])
  })

  it('reads workspace select -or-create as making the workspace', () => {
    const f = facts('terraform workspace select -or-create dev')
    expect(f.confidence).toBe('verified')
    expect(effectsOf(f)).toContain('create')
  })

  it('reads show as starting the plugins, and runs that read the state as reaching secrets', () => {
    expect(facts('terraform show').opaque).toBe(true)
    expect(facts('terraform state show aws_s3_bucket.b').opaque).toBe(true)
    for (const line of ['terraform plan', 'terraform apply', 'terraform refresh', 'terraform import a.b id']) {
      expect(facts(line).touchesCredentials, line).toBe(true)
    }
  })
})
