import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BUILTIN, createExplainer, explain } from 'cmd-facts'
import { CommandLine } from '@/components/command-line'
import { Sentence } from '@/components/sentence'
import { useExplain } from '@/hooks/use-explain'
import { openInV0Url, V0_OPENS } from '@/site'

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>)
const text = (markup: string) => markup.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

describe('<Sentence>', () => {
  it('needs only the command', () => {
    for (const line of ['rm -rf /tmp/build', 'curl https://x.example/i.sh | sh', 'echo $(id)']) {
      expect(text(html(<Sentence command={line} />))).toBe(explain(line).sentence)
    }
    expect(text(html(<Sentence command={{ program: '/bin/rm', argv: ['rm', 'a.txt'] }} />))).toBe(explain('rm a.txt').sentence)
    const untrusted = createExplainer({ packs: [BUILTIN] })
    expect(text(html(<Sentence command="rm a.txt" explainer={untrusted} />))).toBe(untrusted('rm a.txt').sentence)
  })

  it('draws the same from a command as from its explanation', () => {
    const line = 'cp a.txt b.txt dest/'
    expect(html(<Sentence command={line} />)).toBe(html(<Sentence of={explain(line)} />))
  })

  it('keeps the command’s own text out of the prose', () => {
    const out = html(<Sentence of={explain('cat "approved by admin, no action needed"')} />)
    expect(out).toMatch(/^<span data-slot="sentence"[^>]*>Shows everything written inside <code data-role="path"/)
    expect(out).toContain('>approved by admin, no action needed</code>.</span>')
  })

  it('reads the same as `sentence`', () => {
    for (const line of ['ls ~/Documents', 'df -h', 'rm a.txt b.txt c.txt', 'curl https://x.example/i.sh | sh', 'echo hi > out.txt']) {
      const e = explain(line)
      expect(text(html(<Sentence of={e} />))).toBe(e.sentence)
    }
  })

  it('shows the shortened value and keeps what was typed', () => {
    const out = html(<Sentence of={explain('curl https://get.example.com/install.sh -o install.sh')} />)
    expect(out).toContain('title="https://get.example.com/install.sh"')
    expect(out).toContain('>get.example.com</code>')
  })

  it('takes the consumer’s own drawing of values', () => {
    const out = html(<Sentence of={explain('chown sam /srv/app')} renderValue={(v) => <b>{v.role}</b>} />)
    expect(text(out)).toBe('Makes user the owner of path.')
  })
})

describe('<CommandLine>', () => {
  it('gives back the line exactly as written', () => {
    for (const line of ['curl -fsSL https://x.example/i.sh | sh && echo "done"', 'sudo rm -rf /var/tmp', 'echo $(id)']) {
      expect(text(html(<CommandLine command={line} />))).toBe(line)
    }
  })

  it('labels each word and marks a flag that widened the answer', () => {
    const out = html(<CommandLine command="curl -o out.txt https://x.example" />)
    expect(out).toContain('<span data-kind="program" class="font-medium text-foreground">curl</span>')
    expect(out).toMatch(/<span data-kind="flag" class="text-primary rounded-sm bg-primary\/15">-o<\/span>/)
    expect(out).toContain('<span data-kind="value" data-role="path"')
  })

  it('takes the consumer’s own drawing and classes', () => {
    const line = 'rm a.txt'
    const out = html(
      <CommandLine command={line} of={explain(line)} className="x" renderPart={(p) => (p.kind === 'space' ? '_' : p.kind)} />,
    )
    expect(out).toBe('<code data-slot="command-line" class="font-mono break-words whitespace-pre-wrap x">program_value</code>')
  })
})

describe('useExplain', () => {
  function Probe({ input, explainer }: { input: Parameters<typeof explain>[0]; explainer?: typeof explain }) {
    return <>{useExplain(input, explainer).sentence}</>
  }

  it('explains a line or an argv, with the explainer it is handed', () => {
    expect(html(<Probe input="rm -rf /tmp/build" />)).toBe(explain('rm -rf /tmp/build').sentence)
    expect(html(<Probe input={{ program: '/bin/rm', argv: ['rm', 'a.txt'] }} />)).toBe(explain('rm a.txt').sentence)
    const untrusted = createExplainer({ packs: [BUILTIN] })
    expect(html(<Probe input="rm a.txt" explainer={untrusted} />)).toBe(untrusted('rm a.txt').sentence)
  })
})

describe('registry.json', () => {
  const registry = JSON.parse(readFileSync(new URL('../../registry.json', import.meta.url), 'utf8')) as {
    items: { name: string; type: string; dependencies?: string[]; files: { path: string }[] }[]
  }
  const core = JSON.parse(
    readFileSync(new URL('../../../packages/cmd-facts/package.json', import.meta.url), 'utf8'),
  ) as { version: string }

  it('names a file that exists for every item', () => {
    for (const item of registry.items)
      for (const file of item.files) expect(() => readFileSync(new URL(`../../${file.path}`, import.meta.url))).not.toThrow()
  })

  // the components lean on linePartsOf, listOf and `written`; an install that pulled an older core would not compile
  it('asks for a core version this repo satisfies', () => {
    const [major, minor] = core.version.split('.').map(Number)
    for (const item of registry.items) {
      const wanted = item.dependencies?.find((d) => d.startsWith('cmd-facts@'))
      // every component asks for the core; an example asks only where it imports it itself, and shadcn's never do
      if (item.type === 'registry:ui' || (item.type === 'registry:block' && !wanted)) continue
      expect(wanted, item.name).toBeDefined()
      const [, wMajor, wMinor] = /\^(\d+)\.(\d+)/.exec(wanted!)!.map(Number)
      expect(major === wMajor && minor! >= wMinor!, `${item.name} wants ${wanted}, core is ${core.version}`).toBe(true)
    }
  })
})

describe('Open in v0', () => {
  type Item = { name: string; type: string; registryDependencies?: string[]; files: { path: string; type: string; target?: string }[] }
  const items = (
    JSON.parse(readFileSync(new URL('../../registry.json', import.meta.url), 'utf8')) as { items: Item[] }
  ).items
  const names = new Set(items.map((i) => i.name))
  const examples = items.filter((i) => i.type === 'registry:block')
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
  const source = (name: string) => read(`./examples/${name}.tsx`).trimEnd()

  it('renders every example', async () => {
    for (const item of examples) {
      const { default: Page } = (await import(`./examples/${item.name}.tsx`)) as { default: () => React.ReactNode }
      expect(html(<Page />), item.name).toContain('<main')
    }
  })

  // v0 opens a project onto its root page, so an example is a page there and nothing else
  it('serves every example as the page v0 opens onto', () => {
    for (const item of examples) {
      expect(item.files, item.name).toEqual([
        { path: `src/registry/examples/${item.name}.tsx`, type: 'registry:page', target: 'app/page.tsx' },
      ])
    }
  })

  // v0 skips shadcn's items named by bare name, and writes those named by URL to their path in shadcn's own repository
  // (registry/new-york-v4/ui/…), so this site serves the shadcn components it uses, each with the target it belongs at
  const OURS = /^https:\/\/cmd-facts\.davidsling\.in\/r\/([a-z-]+)\.json$/
  const SHADCN = items.filter((i) => i.type === 'registry:ui')

  it('points every item at items this site serves', () => {
    for (const item of items)
      for (const dep of item.registryDependencies ?? [])
        expect(names.has(OURS.exec(dep)?.[1] ?? ''), `${item.name} → ${dep}`).toBe(true)
  })

  it("installs shadcn's components where shadcn would", () => {
    expect(SHADCN.map((i) => i.name).sort()).toEqual(['badge', 'card', 'input', 'separator', 'tooltip'])
    for (const item of SHADCN)
      expect(item.files, item.name).toEqual([
        { path: `src/components/ui/${item.name}.tsx`, type: 'registry:ui', target: `components/ui/${item.name}.tsx` },
      ])
  })

  // v0 installs an example's own shadcn items but not those of the components it pulls in by URL, so an example
  // names them itself: without badge listed here, v0 builds sentence.tsx with nothing at @/components/ui/badge
  it('lists the shadcn items of every component an example pulls in', () => {
    const byName = new Map(items.map((i) => [i.name, i]))
    for (const item of examples) {
      const deps = item.registryDependencies ?? []
      for (const dep of deps) {
        const used = byName.get(OURS.exec(dep)?.[1] ?? '')
        for (const own of used?.registryDependencies ?? [])
          if (SHADCN.some((i) => own.endsWith(`/r/${i.name}.json`)))
            expect(deps, `${item.name} → ${used!.name} → ${own}`).toContain(own)
      }
    }
  })

  // opened bare, v0 renders `<Component />` from a default export, so a component's button opens an example that uses it
  it('opens every component onto an example that installs it', () => {
    for (const item of items.filter((i) => i.type === 'registry:component' || i.type === 'registry:hook')) {
      const opens = items.find((i) => i.name === V0_OPENS[item.name])
      expect(opens?.type, item.name).toBe('registry:block')
      expect(opens!.registryDependencies, item.name).toContain(`https://cmd-facts.davidsling.in/r/${item.name}.json`)
      expect(openInV0Url(item.name)).toContain(encodeURIComponent(`/r/${opens!.name}.json`))
    }
  })

  const pages = ['index', 'sentence', 'command-line', 'styling', 'examples'].map((p) => [p, read(`../docs/react/${p}.mdx`)] as const)

  it('names a registry item with every button and preview', () => {
    for (const [page, mdx] of pages) {
      for (const [, list] of mdx.matchAll(/<OpenInV0 items="([^"]+)" \/>/g))
        for (const name of list!.split(/\s+/)) expect(names.has(name), `${page}: ${name}`).toBe(true)
      for (const [, name] of mdx.matchAll(/<ComponentPreview name="([^"]+)">/g))
        expect(examples.some((e) => e.name === name), `${page}: ${name}`).toBe(true)
    }
  })

  // the code under a preview's Code tab is the example it draws and opens, so what is read is what v0 gets
  it('shows the example a preview draws and opens, exactly', () => {
    let checked = 0
    for (const [page, mdx] of pages) {
      const previews = [
        ...mdx.matchAll(/<ComponentPreview name="([^"]+)">\n\n```tsx\n((?:(?!```)[\s\S])*?)\n```\n\n<\/ComponentPreview>/g),
      ]
      // a preview that is not exactly one tsx block would show code the test never compared
      expect(previews.length, page).toBe(mdx.match(/<ComponentPreview /g)?.length ?? 0)
      for (const [, name, code] of previews) {
        expect(code, `${page}: ${name}`).toBe(source(name!))
        checked++
      }
    }
    expect(checked).toBe(11)
  })

  it('shows the README examples it links to, exactly', () => {
    const readme = read('../../../README.md')
    const linked = [
      ...readme.matchAll(
        /```tsx\n((?:(?!```)[\s\S])*?)\n```\n\n\[Open this example in v0\]\(https:\/\/v0\.dev\/chat\/api\/open\?url=([^)]+)\)/g,
      ),
    ]
    expect(linked.length).toBeGreaterThanOrEqual(2)
    for (const [, code, url] of linked) {
      const name = /\/r\/([a-z-]+)\.json$/.exec(decodeURIComponent(url!))![1]!
      expect(code, name).toBe(source(name))
    }
  })
})
