import * as React from 'react'
import { explain, linePartsOf, type Explainer, type Explanation, type LinePart } from 'cmd-facts'

import { cn } from 'cn'

/** The classes each kind of word is drawn with. This file is yours now: change them here. */
const tone: Record<Exclude<LinePart['kind'], 'space'>, string> = {
  program: 'font-medium text-foreground',
  subcommand: 'text-foreground',
  flag: 'text-primary',
  value: 'text-sky-700 dark:text-sky-300',
  operator: 'text-muted-foreground',
  redirect: 'text-muted-foreground',
  word: 'text-foreground/80',
  unread: 'text-destructive underline decoration-wavy',
}

/** The classes for one piece of the line, for a `renderPart` that wants the defaults and something more. */
export function commandLinePartClassName(part: LinePart) {
  if (part.kind === 'space') return undefined
  return cn(
    tone[part.kind],
    // a flag that widened what the command can do
    part.kind === 'flag' && part.escalated && 'rounded-sm bg-primary/15',
    // a flag or word the explanation does not account for
    'unread' in part && part.unread && 'text-destructive underline decoration-wavy',
    // the command another one hands over to, as rm in sudo rm
    part.kind === 'program' && part.nested && 'underline decoration-dotted underline-offset-4',
  )
}

function Part({ part }: { part: LinePart }) {
  if (part.kind === 'space') return part.text
  return (
    <span
      data-kind={part.kind}
      data-role={part.kind === 'value' ? part.role : undefined}
      className={commandLinePartClassName(part)}
    >
      {part.text}
    </span>
  )
}

export type CommandLineProps = Omit<React.ComponentProps<'code'>, 'children'> & {
  /** The command, as it was written. */
  command: string
  /** The answer for this command, where you already have one. Otherwise it is explained here, with `explainer`. */
  of?: Explanation
  explainer?: Explainer
  /** Draw a piece yourself. Return `part.text` for a `space` to keep the line as written. */
  renderPart?: (part: LinePart, index: number) => React.ReactNode
}

/**
 * The command line exactly as written, each word drawn by what it was read as: the program, its flags, the
 * arguments, operators and redirections.
 */
export function CommandLine({ command, of, explainer = explain, renderPart, className, ...props }: CommandLineProps) {
  const parts = React.useMemo(() => linePartsOf(command, of ?? explainer(command)), [command, of, explainer])
  return (
    <code
      data-slot="command-line"
      className={cn('font-mono break-words whitespace-pre-wrap', className)}
      {...props}
    >
      {parts.map((part, index) => (
        <React.Fragment key={index}>{renderPart ? renderPart(part, index) : <Part part={part} />}</React.Fragment>
      ))}
    </code>
  )
}
