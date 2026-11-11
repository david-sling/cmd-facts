import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BUILTIN, createExplainer, explain } from 'cmd-facts'
import { CommandLine } from './command-line'
import { Sentence } from './sentence'
import { useExplain } from './use-explain'

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>)
const text = (markup: string) => markup.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

describe('<Sentence>', () => {
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
      expect(text(html(<CommandLine line={line} />))).toBe(line)
    }
  })

  it('labels each word and marks a flag that widened the answer', () => {
    const out = html(<CommandLine line="curl -o out.txt https://x.example" />)
    expect(out).toContain('<span data-kind="program" class="font-medium text-foreground">curl</span>')
    expect(out).toMatch(/<span data-kind="flag" class="text-primary rounded-sm bg-primary\/15">-o<\/span>/)
    expect(out).toContain('<span data-kind="value" data-role="path"')
  })

  it('takes the consumer’s own drawing and classes', () => {
    const line = 'rm a.txt'
    const out = html(
      <CommandLine line={line} of={explain(line)} className="x" renderPart={(p) => (p.kind === 'space' ? '_' : p.kind)} />,
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
    items: { name: string; dependencies: string[]; files: { path: string }[] }[]
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
      const wanted = item.dependencies.find((d) => d.startsWith('cmd-facts@'))
      expect(wanted, item.name).toBeDefined()
      const [, wMajor, wMinor] = /\^(\d+)\.(\d+)/.exec(wanted!)!.map(Number)
      expect(major === wMajor && minor! >= wMinor!, `${item.name} wants ${wanted}, core is ${core.version}`).toBe(true)
    }
  })
})
