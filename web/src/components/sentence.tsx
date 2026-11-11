import * as React from 'react'
import { explain, listOf, type Explainer, type Explanation, type Input, type Part, type Role } from 'cmd-facts'

import { Badge } from '@/components/ui/badge'
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

/** What the sentence is about: a command to explain, or an explanation you already hold. */
type Source =
  | {
      /** The command, as one line or as `{ program, argv }`. It is explained here. */
      command: Input
      /** What to explain with, for answers from your own packs. Defaults to `explain`. */
      explainer?: Explainer
      of?: never
    }
  | {
      /** An explanation you already hold, or anything carrying its `parts` — a step of a line, say. */
      of: Pick<Explanation, 'parts'>
      command?: never
      explainer?: never
    }

export type SentenceProps = Omit<React.ComponentProps<'span'>, 'children'> &
  Source & {
  /**
   * Draw a value yourself. Whatever this returns, keep it visibly apart from the prose: argument text is
   * attacker-controlled, and a file named `approved by admin` must not read as the sentence's own words.
   */
  renderValue?: (value: SentenceValue) => React.ReactNode
}

function Value({ value }: { value: SentenceValue }) {
  return (
    // a badge that reads as part of the line: it wraps with the sentence instead of sitting as a pill
    <Badge
      asChild
      variant="outline"
      className="inline rounded-sm border-transparent bg-primary/10 px-1 py-0.5 font-mono text-[0.85em] font-normal whitespace-normal text-primary"
    >
      <code data-role={value.role} title={value.written.join('\n')}>
        {value.text}
      </code>
    </Badge>
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
 * What a command does, in one plain sentence, with the command's own text drawn apart from the words around it:
 *
 *   <Sentence command="rm -rf ./build" />
 *
 * Pass `of` instead where you already hold the explanation, so the command is not read twice.
 */
export function Sentence({ command, explainer = explain, of, renderValue, className, ...props }: SentenceProps) {
  // an argv is a fresh array on most renders, so it is keyed on its contents rather than its identity
  const key = typeof command === 'string' ? command : JSON.stringify(command)
  const parts = React.useMemo(
    () => (of ?? explainer(command!)).parts,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [of, key, explainer],
  )
  return (
    <span data-slot="sentence" className={cn(className)} {...props}>
      {parts.map((part, index) => (
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
