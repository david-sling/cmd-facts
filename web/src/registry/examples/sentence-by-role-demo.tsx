import type { Role } from 'cmd-facts'
import { Cpu, FileText, Globe, Server, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CommandLine } from '@/components/command-line'
import { Sentence } from '@/components/sentence'
import { Badge } from '@/components/ui/badge'

const command = 'curl -o dump.sql https://db.example.com/export && chown alice dump.sql && ssh admin@db.internal'

// One look per kind of value, so a reader tells a host from a file at a glance. A role not listed keeps the default.
const byRole: Partial<Record<Role, { icon: LucideIcon; className: string }>> = {
  url: { icon: Globe, className: 'bg-sky-400/15 text-sky-700 dark:text-sky-300' },
  host: { icon: Server, className: 'bg-violet-400/15 text-violet-700 dark:text-violet-300' },
  path: { icon: FileText, className: 'bg-amber-400/15 text-amber-700 dark:text-amber-300' },
  user: { icon: User, className: 'bg-emerald-400/15 text-emerald-700 dark:text-emerald-300' },
  pid: { icon: Cpu, className: 'bg-rose-400/15 text-rose-700 dark:text-rose-300' },
}

export default function Page() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <CommandLine command={command} className="rounded-md border px-3 py-2 text-sm" />
      <p className="text-xl leading-relaxed">
        <Sentence
          command={command}
          renderValue={(v) => {
            const look = byRole[v.role]
            return (
              <Badge
                variant="secondary"
                title={`${v.role}: ${v.written.join(', ')}`}
                className={`font-mono text-[0.85em] font-normal ${look?.className ?? ''}`}
              >
                {look && <look.icon aria-hidden />}
                {v.text}
              </Badge>
            )
          }}
        />
      </p>
    </main>
  )
}
