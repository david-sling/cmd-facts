'use client'

import { Sentence } from '@/components/sentence'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const command = 'mv ~/Documents/ransom.txt ~/Desktop/note.txt'

// Each letter is cut from a different magazine. The same letter always comes from the same one.
const paper = ['bg-yellow-300', 'bg-white', 'bg-sky-300', 'bg-pink-300', 'bg-lime-300', 'bg-orange-300']
const ink = ['font-serif', 'font-mono font-bold', 'font-sans font-black', 'font-serif italic']
const tilt = ['-rotate-6', 'rotate-3', '-rotate-2', 'rotate-6', 'rotate-1', '-rotate-3']

function Cutout({ text }: { text: string }) {
  return (
    <span aria-hidden className="inline-flex flex-wrap gap-0.5 align-middle">
      {[...text].map((letter, i) => {
        const n = letter.charCodeAt(0) + i
        return (
          <span
            key={i}
            className={`inline-block px-1 text-black shadow ${paper[n % paper.length]} ${ink[n % ink.length]} ${tilt[n % tilt.length]} ${i % 2 ? 'uppercase' : ''}`}
          >
            {letter}
          </span>
        )
      })}
    </span>
  )
}

export default function Page() {
  return (
    <TooltipProvider>
      <main className="mx-auto max-w-2xl p-8 text-xl leading-[2.6]">
        <Sentence
          command={command}
          renderValue={(v) => (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} aria-label={`${v.role}: ${v.text}`} className="cursor-help">
                  <Cutout text={v.text} />
                </span>
              </TooltipTrigger>
              <TooltipContent>The letters spell {v.text}</TooltipContent>
            </Tooltip>
          )}
        />
      </main>
    </TooltipProvider>
  )
}
