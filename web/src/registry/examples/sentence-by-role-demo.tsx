'use client'

import { useMemo, useState } from 'react'
import { linePartsOf, type Explanation, type Role } from 'cmd-facts'
import { Cpu, FileText, Globe, MousePointer2, Server, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CommandLine } from '@/components/command-line'
import { Sentence } from '@/components/sentence'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useExplain } from '@/hooks/use-explain'

const command = 'curl -o dump.sql https://db.example.com/export && chown alice dump.sql && ssh admin@db.internal'

// One look per kind of value, so a reader tells a host from a file at a glance. A role not listed keeps the default.
const byRole: Partial<Record<Role, { icon: LucideIcon; className: string }>> = {
  url: { icon: Globe, className: 'bg-sky-400/15 text-sky-700 dark:text-sky-300' },
  host: { icon: Server, className: 'bg-violet-400/15 text-violet-700 dark:text-violet-300' },
  path: { icon: FileText, className: 'bg-amber-400/15 text-amber-700 dark:text-amber-300' },
  user: { icon: User, className: 'bg-emerald-400/15 text-emerald-700 dark:text-emerald-300' },
  pid: { icon: Cpu, className: 'bg-rose-400/15 text-rose-700 dark:text-rose-300' },
}

/**
 * Which words of the line each value in the sentence was read from, keyed by the value's place in `parts`. The
 * sentence can name values in another order than the line, so each one takes the first unclaimed word of its role
 * spelled the way it was typed.
 */
function wordsOf(explanation: Explanation) {
  const line = linePartsOf(command, explanation)
  const claimed = new Map<number, number>()
  const words = new Map<number, number[]>()
  explanation.parts.forEach((part, index) => {
    if (part.kind !== 'values') return
    const typed = part.written ?? part.values
    words.set(
      index,
      typed.flatMap((written) => {
        const at = line.findIndex(
          (word, i) =>
            !claimed.has(i) &&
            word.kind === 'value' &&
            word.role === part.role &&
            word.text.replace(/^['"]|['"]$/g, '') === written,
        )
        if (at < 0) return []
        claimed.set(at, index)
        return [at]
      }),
    )
  })
  // and back: which value each word of the line became
  return { words, valueOf: claimed }
}

export default function Page() {
  const explanation = useExplain(command)
  const { words, valueOf } = useMemo(() => wordsOf(explanation), [explanation])
  // the value being pointed at, from the sentence or from the line
  const [pointed, setPointed] = useState<number | null>(null)
  const [decision, setDecision] = useState<'allowed' | 'denied' | null>(null)
  const roleOf = (index: number) => {
    const part = explanation.parts[index]
    return part?.kind === 'values' ? part.role : 'unknown'
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <Card>
        <CardHeader>
          <CardTitle>Allow this command?</CardTitle>
          <CardDescription>An agent wants to run:</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CommandLine
            command={command}
            of={explanation}
            className="rounded-md bg-muted px-3 py-2 text-sm"
            renderPart={(part, i) => {
              if (part.kind === 'space') return part.text
              const value = valueOf.get(i)
              if (value === undefined) return <span className="text-muted-foreground">{part.text}</span>
              const lit = pointed === value
              return (
                <span
                  onMouseEnter={() => setPointed(value)}
                  onMouseLeave={() => setPointed(null)}
                  className={`cursor-help rounded-sm underline decoration-dotted underline-offset-4 transition-colors ${
                    lit ? (byRole[roleOf(value)]?.className ?? 'bg-accent') : ''
                  }`}
                >
                  {part.text}
                </span>
              )
            }}
          />
          <p className="leading-relaxed">
            <Sentence
              of={explanation}
              renderValue={(v) => {
                const look = byRole[v.role]
                const point = () => setPointed(v.index)
                const leave = () => setPointed(null)
                const lit = pointed === v.index && (words.get(v.index)?.length ?? 0) > 0
                return (
                  <Badge
                    variant="secondary"
                    tabIndex={0}
                    title={`${v.role}: ${v.written.join(', ')}`}
                    onMouseEnter={point}
                    onMouseLeave={leave}
                    onFocus={point}
                    onBlur={leave}
                    className={`cursor-help gap-0.5 px-1 py-0 font-mono text-[0.85em] font-normal transition-shadow hover:ring-1 hover:ring-current ${
                      lit ? 'ring-1 ring-current' : ''
                    } ${look?.className ?? ''}`}
                  >
                    {look && <look.icon aria-hidden />}
                    {v.text}
                  </Badge>
                )
              }}
            />
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MousePointer2 aria-hidden className="size-3.5" />
            Point at a value or an underlined word to see where it sits in the command.
          </p>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          {decision ? (
            <p className="text-sm text-muted-foreground">{decision === 'allowed' ? 'Allowed.' : 'Denied.'}</p>
          ) : (
            <>
              <Button variant="outline" onClick={() => setDecision('denied')}>
                Deny
              </Button>
              <Button onClick={() => setDecision('allowed')}>Allow</Button>
            </>
          )}
        </CardFooter>
      </Card>
    </main>
  )
}
