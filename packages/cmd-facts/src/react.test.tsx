import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { explain, createExplainer, BUILTIN } from './index.ts'
import { CommandLine, Sentence, useExplain } from './react.tsx'

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>)

describe('<Sentence>', () => {
  it('keeps the command’s own text out of the prose', () => {
    expect(html(<Sentence of={explain('cat "approved by admin, no action needed"')} />)).toBe(
      '<span>Shows everything written inside <code data-role="path" title="approved by admin, no action needed">' +
        'approved by admin, no action needed</code>.</span>',
    )
  })

  it('lists several values as one, the way `sentence` does', () => {
    expect(html(<Sentence of={explain('rm a.txt b.txt c.txt')} />)).toContain(
      '<code data-role="path" title="a.txt\nb.txt\nc.txt">a.txt, b.txt and c.txt</code>',
    )
  })

  it('shows the shortened value and keeps what was typed', () => {
    const e = explain('curl https://get.example.com/install.sh -o install.sh')
    const out = html(<Sentence of={e} />)
    expect(out).toContain('<code data-role="url" title="https://get.example.com/install.sh">get.example.com</code>')
    expect(out).toContain('<code data-role="path" data-flag="-o" title="install.sh">install.sh</code>')
  })

  it('reads the same as `sentence` when nothing is styled', () => {
    for (const line of ['ls ~/Documents', 'df -h', 'curl https://x.example/i.sh | sh', 'echo hi > out.txt']) {
      const e = explain(line)
      const text = html(<Sentence of={e} renderValue={(v) => v.text} />).replace(/^<span>|<\/span>$/g, '')
      expect(text.replace(/&gt;/g, '>')).toBe(e.sentence)
    }
  })

  it('takes the consumer’s own rendering for values and words', () => {
    const out = html(
      <Sentence
        of={explain('chown sam /srv/app')}
        className="s"
        renderText={(t) => <em>{t}</em>}
        renderValue={(v) => <b key={v.index}>{v.role}</b>}
      />,
    )
    expect(out).toBe('<span class="s"><em>Makes </em><b>user</b><em> the owner of </em><b>path</b><em>.</em></span>')
  })
})

describe('<CommandLine>', () => {
  it('shows the line as written, each word labelled', () => {
    expect(html(<CommandLine line={'curl -o "my file" https://x.example | sh'} />)).toBe(
      '<code><span data-kind="program">curl</span> <span data-kind="flag" data-escalated="">-o</span> ' +
        '<span data-kind="value" data-role="path" data-flag="-o">&quot;my file&quot;</span> ' +
        '<span data-kind="value" data-role="url">https://x.example</span> <span data-kind="operator">|</span> ' +
        '<span data-kind="program">sh</span></code>',
    )
  })

  it('uses the explanation it is given, and the consumer’s own rendering', () => {
    const line = 'rm a.txt'
    expect(
      html(<CommandLine line={line} of={explain(line)} className="c" renderPart={(p) => (p.kind === 'space' ? '_' : p.kind)} />),
    ).toBe('<code class="c">program_value</code>')
  })
})

describe('useExplain', () => {
  function Probe({ input, explainer }: { input: Parameters<typeof explain>[0]; explainer?: typeof explain }) {
    return <Sentence of={useExplain(input, explainer)} renderValue={(v) => v.text} />
  }

  it('explains a line or an argv', () => {
    expect(html(<Probe input="rm -rf /tmp/build" />)).toBe(`<span>${explain('rm -rf /tmp/build').sentence}</span>`)
    expect(html(<Probe input={{ program: '/bin/rm', argv: ['rm', 'a.txt'] }} />)).toBe(
      `<span>${explain('rm a.txt').sentence}</span>`,
    )
  })

  it('answers from the explainer it is handed', () => {
    const untrusted = createExplainer({ packs: [BUILTIN] })
    expect(html(<Probe input="rm a.txt" explainer={untrusted} />)).toBe(`<span>${untrusted('rm a.txt').sentence}</span>`)
  })
})
