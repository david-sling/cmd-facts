'use client'

import { useState } from 'react'
import { CommandLine } from '@/components/command-line'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sentence } from '@/components/sentence'
import { useExplain } from '@/hooks/use-explain'

export default function Page() {
  const [command, setCommand] = useState('curl https://get.example.com/i.sh | sh')
  const explanation = useExplain(command)

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <Input
        value={command}
        onChange={(event) => setCommand(event.target.value)}
        aria-label="Command"
        className="font-mono"
      />
      <Card>
        <CardHeader>
          <CardDescription>An agent wants to run</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CommandLine command={command} of={explanation} className="rounded-md bg-muted px-3 py-2 text-sm" />
          <p className="text-lg">
            <Sentence of={explanation} />
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
