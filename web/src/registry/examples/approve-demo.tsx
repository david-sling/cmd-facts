'use client'

import { useState } from 'react'
import { CommandLine } from '@/components/command-line'
import { Sentence } from '@/components/sentence'
import { useExplain } from '@/hooks/use-explain'

export default function Page() {
  const [line, setLine] = useState('curl https://get.example.com/i.sh | sh')
  const explanation = useExplain(line)

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <input
        value={line}
        onChange={(event) => setLine(event.target.value)}
        aria-label="Command"
        className="rounded-md border bg-background px-3 py-2 font-mono text-sm"
      />
      <div className="flex flex-col gap-4 rounded-lg border p-6">
        <p className="text-sm text-muted-foreground">An agent wants to run</p>
        <CommandLine line={line} of={explanation} className="rounded-md bg-muted px-3 py-2 text-sm" />
        <p className="text-lg">
          <Sentence of={explanation} />
        </p>
      </div>
    </main>
  )
}
