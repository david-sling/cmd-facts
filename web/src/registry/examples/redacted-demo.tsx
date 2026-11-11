'use client'

import { Fragment } from 'react'
import { Sentence } from '@/components/sentence'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const command = 'rm -rf ~/Desktop/evidence ~/Documents/plans.txt'

export default function Page() {
  return (
    <TooltipProvider>
      <main className="flex justify-center p-8">
        <article className="relative w-full max-w-xl -rotate-1 border border-stone-300 bg-amber-50 p-8 font-serif text-stone-900 shadow-xl">
          <Badge
            variant="outline"
            className="absolute top-6 right-6 rotate-12 rounded-none border-4 border-red-700 font-sans text-sm font-black tracking-widest text-red-700 uppercase opacity-80"
          >
            Top secret
          </Badge>
          <p className="font-mono text-xs tracking-widest text-stone-500 uppercase">Subject: one shell command</p>
          <p className="mt-6 text-xl leading-relaxed">
            <Sentence
              command={command}
              renderValue={(v) =>
                v.written.map((written, i) => (
                  <Fragment key={written}>
                    {i > 0 && (i === v.written.length - 1 ? ' and ' : ', ')}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          tabIndex={0}
                          aria-label={`${v.role}: ${written}`}
                          className="cursor-help bg-stone-950 font-mono text-transparent select-none"
                        >
                          {written}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Declassified {v.role}: {written}
                      </TooltipContent>
                    </Tooltip>
                  </Fragment>
                ))
              }
            />
          </p>
          <p className="mt-8 font-mono text-xs text-stone-500">
            Hover a bar to declassify it. This document will not self-destruct. The command would.
          </p>
        </article>
      </main>
    </TooltipProvider>
  )
}
