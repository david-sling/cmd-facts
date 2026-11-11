import { CommandLine, commandLinePartClassName } from '@/components/command-line'
import { cn } from '@/lib/utils'

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <CommandLine
        command="curl -fsSL https://get.example.com/install.sh -o install.sh"
        renderPart={(part) =>
          part.kind === 'space' ? (
            part.text
          ) : (
            <span
              title={part.kind === 'value' ? part.role : part.kind}
              className={cn(commandLinePartClassName(part), part.kind === 'value' && 'cursor-help underline decoration-dotted')}
            >
              {part.text}
            </span>
          )
        }
      />
    </main>
  )
}
