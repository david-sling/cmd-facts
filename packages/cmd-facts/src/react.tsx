import { Fragment, useMemo, type ReactNode } from 'react'
import { explain as builtin } from './index.ts'
import type { Explainer, Explanation, Input } from './explain.ts'
import type { Role } from './entry.ts'
import { listOf, type Part } from './tell.ts'
import { linePartsOf, type LinePart } from './cmdline.ts'

/**
 * One value off the command line, ready to render. `text` is what goes in the sentence; `written` is what was typed,
 * which differs from `values` only where the row shortened it (`show: 'host'`).
 */
export type ValueProps = {
  /** The values joined the way `sentence` joins them: `a.txt, b.txt and c.txt`. */
  text: string
  values: string[]
  written: string[]
  role: Role
  flag?: string
  show?: 'host'
  /** Position of this part in `parts`, for keys and staggered animation. */
  index: number
}

export type SentenceProps = {
  /** An explanation, or anything carrying its `parts` — a step of a line, say. */
  of: Pick<Explanation, 'parts'>
  /**
   * How a value is drawn. The default is a `<code>` carrying `data-role`, with what was typed in `title`. Whatever
   * this returns, keep it visibly apart from the prose: argument text is attacker-controlled, and a file named
   * `approved by admin` must not read as the row's own words.
   */
  renderValue?: (value: ValueProps) => ReactNode
  /** How the row's own words are drawn. The default is the bare string. */
  renderText?: (text: string, index: number) => ReactNode
  className?: string
}

const defaultValue = (v: ValueProps): ReactNode => (
  <code
    data-role={v.role}
    {...(v.flag ? { 'data-flag': v.flag } : {})}
    title={v.written.join('\n')}
  >
    {v.text}
  </code>
)

/**
 * The sentence from `parts`, with the row's words and the command's own text rendered apart. Use it in place of
 * `{explanation.sentence}`, which has the argument text already joined into the prose.
 *
 * Unstyled: it renders a `<span>` of strings and `<code>` elements, so it takes whatever styles the page gives it.
 */
export function Sentence({ of, renderValue = defaultValue, renderText, className }: SentenceProps) {
  return (
    <span className={className}>
      {of.parts.map((part: Part, index) => (
        <Fragment key={index}>
          {part.kind === 'text'
            ? renderText
              ? renderText(part.text, index)
              : part.text
            : renderValue({
                text: listOf(part.values),
                values: part.values,
                written: part.written ?? part.values,
                role: part.role,
                ...(part.flag ? { flag: part.flag } : {}),
                ...(part.show ? { show: part.show } : {}),
                index,
              })}
        </Fragment>
      ))}
    </span>
  )
}

export type CommandLineProps = {
  /** The line as it was written. */
  line: string
  /** The answer for this line, where you already have one. Otherwise it is explained here, with `explainer`. */
  of?: Explanation
  explainer?: Explainer
  /** How a piece is drawn. The default is a `<span>` carrying `data-kind` and, where they apply, `data-role`, `data-flag`, `data-escalated`, `data-unread` and `data-nested`; spaces stay bare text. */
  renderPart?: (part: LinePart, index: number) => ReactNode
  className?: string
}

const defaultPart = (part: LinePart): ReactNode => {
  if (part.kind === 'space') return part.text
  const data: Record<string, string> = { 'data-kind': part.kind }
  if ('role' in part) data['data-role'] = part.role
  if ('flag' in part && part.flag) data['data-flag'] = part.flag
  if ('escalated' in part && part.escalated) data['data-escalated'] = ''
  if ('unread' in part && part.unread) data['data-unread'] = ''
  if ('nested' in part && part.nested) data['data-nested'] = ''
  return <span {...data}>{part.text}</span>
}

/**
 * The command line exactly as written, with each word labelled by what it was read as: the program, its flags, the
 * arguments and their roles, operators and redirections. Unstyled: a `<code>` of `<span data-kind>`s.
 */
export function CommandLine({ line, of, explainer = builtin, renderPart = defaultPart, className }: CommandLineProps) {
  const parts = useMemo(() => linePartsOf(line, of ?? explainer(line)), [line, of, explainer])
  return (
    <code className={className}>
      {parts.map((part, index) => (
        <Fragment key={index}>{renderPart(part, index)}</Fragment>
      ))}
    </code>
  )
}

/**
 * `explain()` for a component, recomputed only when the line changes. Pass an explainer built with
 * `createExplainer` to answer from your own packs; keep it stable (module scope or `useMemo`), or every render
 * explains again.
 */
export function useExplain(input: Input, explainer: Explainer = builtin): Explanation {
  // An argv is a fresh array on most renders, so it is keyed on its contents rather than its identity.
  const key = typeof input === 'string' ? input : JSON.stringify(input)
  return useMemo(() => explainer(input), [key, explainer])
}
