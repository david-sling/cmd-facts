import { Sentence } from '@/components/sentence'
import { Badge } from '@/components/ui/badge'

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl p-8 text-xl">
      <Sentence
        command="rm notes.txt draft.txt old.txt backup.txt"
        renderValue={(v) => (
          <Badge
            title={v.written.join('\n')}
            className="bg-amber-400/15 font-mono text-amber-700 dark:text-amber-300"
          >
            {v.values.length > 3 ? `${v.values.length} files` : v.text}
          </Badge>
        )}
      />
    </main>
  )
}
