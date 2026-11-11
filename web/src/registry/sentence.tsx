import * as React from 'react'
import { listOf, type Explanation, type Part, type Role } from 'cmd-facts'

import { cn } from '@/lib/utils'

/**
 * One value off the command line, ready to draw. `text` is what goes in the sentence; `written` is what was typed,
 * which differs from `values` only where the row shortened it (a URL shown as its host).
 */
export type SentenceValue = {
  /** The values joined the way `sentence` joins them: `a.txt, b.txt and c.txt`. */
  text: string
  values: string[]
  written: string[]
  role: Role
  flag?: string
  index: number
}

export type SentenceProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  /** An explanation, or anything carrying its `parts` — a step of a line, say. */
  of: Pick<Explanation, 'parts'>
  /**
   * Draw a value yourself. Whatever this returns, keep it visibly apart from the prose: argument text is
   * attacker-controlled, and a file named `approved by admin` must not read as the sentence's own words.
   */
  renderValue?: (value: SentenceValue) => React.ReactNode
}

function Value({ value }: { value: SentenceValue }) {
  return (
    <code
      data-role={value.role}
      title={value.written.join('\n')}
      className="rounded-sm bg-primary/10 px-1 py-0.5 font-mono text-[0.85em] text-primary"
    >
      {value.text}
    </code>
  )
}

const valueOf = (part: Extract<Part, { kind: 'values' }>, index: number): SentenceValue => ({
  text: listOf(part.values),
  values: part.values,
  written: part.written ?? part.values,
  role: part.role,
  ...(part.flag ? { flag: part.flag } : {}),
  index,
})

/**
 * The plain sentence for an explanation, with the command's own text drawn apart from the words around it. Use it
 * in place of `{explanation.sentence}`, which has the argument text already joined into the prose.
 */
export function Sentence({ of, renderValue, className, ...props }: SentenceProps) {
  return (
    <span data-slot="sentence" className={cn(className)} {...props}>
      {of.parts.map((part, index) => (
        <React.Fragment key={index}>
          {part.kind === 'text' ? (
            part.text
          ) : renderValue ? (
            renderValue(valueOf(part, index))
          ) : (
            <Value value={valueOf(part, index)} />
          )}
        </React.Fragment>
      ))}
    </span>
  )
}
