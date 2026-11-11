'use client'

import type { LinePart } from 'cmd-facts'
import { CommandLine, commandLinePartClassName } from '@/components/command-line'
import { Sentence } from '@/components/sentence'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useExplain } from '@/hooks/use-explain'

const command = 'curl -fsSL https://get.example.com/install.sh -o install.sh'

/** What to say when someone hovers a word of the line. */
function whatItIs(part: Exclude<LinePart, { kind: 'space' }>) {
  if (part.kind === 'flag' && part.escalated) return 'A flag that widens what this command can do'
  if (part.kind === 'flag' && part.unread) return 'A flag nothing here knows'
  if (part.kind === 'program') return part.nested ? 'The command the one before it runs' : 'The program that runs'
  if (part.kind === 'value') return `An argument, read as a ${part.role}${part.flag ? `, taken by ${part.flag}` : ''}`
  if (part.kind === 'operator') return 'Joins this command to the next'
  if (part.kind === 'redirect') return 'Sends output somewhere'
  if (part.kind === 'unread') return 'A line that could not be read'
  return part.kind === 'subcommand' ? 'Picks what the program does' : 'A word read as nothing in particular'
}

export default function Page() {
  const explanation = useExplain(command)

  return (
    <TooltipProvider>
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
        <CommandLine
          command={command}
          of={explanation}
          className="rounded-md border px-3 py-2 text-sm"
          renderPart={(part) =>
            part.kind === 'space' ? (
              part.text
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className={`${commandLinePartClassName(part)} cursor-help`}>
                    {part.text}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{whatItIs(part)}</TooltipContent>
              </Tooltip>
            )
          }
        />
        <p className="text-lg">
          <Sentence
            of={explanation}
            renderValue={(v) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge tabIndex={0} variant="secondary" className="cursor-help font-mono">
                    {v.text}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {v.role}, typed as {v.written.join(', ')}
                </TooltipContent>
              </Tooltip>
            )}
          />
        </p>
      </main>
    </TooltipProvider>
  )
}
