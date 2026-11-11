'use client'

import { useState } from 'react'
import { explain } from 'cmd-facts'
import { Sentence } from '@/components/sentence'

export default function Page() {
  const [line, setLine] = useState('curl -fsSL https://get.example.com/install.sh -o install.sh')

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <input
        value={line}
        onChange={(event) => setLine(event.target.value)}
        aria-label="Command"
        className="rounded-md border bg-background px-3 py-2 font-mono text-sm"
      />
      <p className="text-xl">
        <Sentence of={explain(line)} />
      </p>
    </main>
  )
}
