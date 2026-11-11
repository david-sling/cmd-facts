'use client'

import { effectsOf } from 'cmd-facts'
import { CommandLine } from '@/components/command-line'
import { Sentence } from '@/components/sentence'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useExplain } from '@/hooks/use-explain'

const command = 'scp ~/.ssh/id_ed25519 backup@vault.example.com:/srv/keys'

export default function Page() {
  const explanation = useExplain(command)
  const { facts } = explanation
  const effects = effectsOf(facts)

  // every line of the receipt is a field of the answer, and its tooltip says which
  const lines = [
    ['Effects', effects.join(', '), facts.opaque ? 'What it does, at least — it hands over to something not shown' : 'What it does'],
    ['Reversible', facts.reversible, 'Whether it can be undone: yes, no, with a backup, or unknown'],
    ['Network', facts.network, 'Whether it reaches beyond this computer, and how far'],
    ['Privilege', facts.privilege, 'Whether it needs an administrator'],
    ['Secrets', facts.touchesCredentials ? 'touched' : 'not by nature', 'Whether the program reaches passwords and keys whatever it is given'],
  ] as const

  return (
    <TooltipProvider>
      <main className="flex justify-center p-8">
        <section className="w-80 rotate-1 bg-white px-6 py-8 font-mono text-[13px] text-zinc-900 shadow-xl [mask:radial-gradient(6px_at_50%_100%,#0000_98%,#000)_50%_100%/14px_100%_repeat-x]">
          <p className="text-center font-bold tracking-widest">CMD-FACTS GENERAL STORE</p>
          <p className="text-center text-xs text-zinc-500">no refunds on rm</p>
          <Separator className="my-4 bg-zinc-300" />
          <p>1 x</p>
          <CommandLine command={command} of={explanation} className="text-xs text-zinc-700" />
          <p className="mt-3 font-sans text-sm leading-snug">
            <Sentence of={explanation} />
          </p>
          <Separator className="my-4 bg-zinc-300" />
          <dl className="space-y-1">
            {lines.map(([label, value, says]) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <div tabIndex={0} className="flex cursor-help gap-1">
                    <dt className="uppercase">{label}</dt>
                    <span aria-hidden className="flex-1 overflow-hidden whitespace-nowrap text-zinc-400">
                      {'.'.repeat(40)}
                    </span>
                    <dd className="font-bold">{value}</dd>
                  </div>
                </TooltipTrigger>
                <TooltipContent>{says}</TooltipContent>
              </Tooltip>
            ))}
          </dl>
          <Separator className="my-4 bg-zinc-300" />
          <p className="flex justify-between font-bold">
            <span>TOTAL</span>
            <span>
              {effects.length} effects, {facts.reversible === 'yes' ? 'refundable' : 'no refunds'}
            </span>
          </p>
          <p className="mt-6 text-center text-xs text-zinc-500">THANK YOU FOR READING BEFORE RUNNING</p>
        </section>
      </main>
    </TooltipProvider>
  )
}
