import { explain } from 'cmd-facts'
import { Sentence } from '@/components/sentence'

const explanation = explain('rm notes.txt draft.txt old.txt backup.txt')

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl p-8 text-xl">
      <Sentence
        of={explanation}
        renderValue={(v) => (
          <code
            title={v.written.join('\n')}
            className="rounded bg-amber-400/15 px-1 font-mono text-amber-700 dark:text-amber-300"
          >
            {v.values.length > 3 ? `${v.values.length} files` : v.text}
          </code>
        )}
      />
    </main>
  )
}
