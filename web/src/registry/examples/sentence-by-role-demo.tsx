import type { Role } from 'cmd-facts'
import { Sentence } from '@/components/sentence'
import { Badge } from '@/components/ui/badge'

// One look per kind of value, so a reader tells a host from a file at a glance. A role not listed keeps the default.
const byRole: Partial<Record<Role, string>> = {
  url: 'bg-sky-400/15 text-sky-700 dark:text-sky-300',
  host: 'bg-violet-400/15 text-violet-700 dark:text-violet-300',
  path: 'bg-amber-400/15 text-amber-700 dark:text-amber-300',
  user: 'bg-emerald-400/15 text-emerald-700 dark:text-emerald-300',
  pid: 'bg-rose-400/15 text-rose-700 dark:text-rose-300',
}

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl p-8 text-xl leading-relaxed">
      <Sentence
        command="curl -o dump.sql https://db.example.com/export && chown alice dump.sql && ssh admin@db.internal"
        renderValue={(v) => (
          <Badge
            variant="secondary"
            title={`${v.role}: ${v.written.join(', ')}`}
            className={`font-mono text-[0.85em] font-normal ${byRole[v.role] ?? ''}`}
          >
            {v.text}
          </Badge>
        )}
      />
    </main>
  )
}
