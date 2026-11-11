import { ArrowUpRight } from 'lucide-react'
import { openInV0Url } from '#/site'

/**
 * A link that opens one of this site's registry items in v0: a component on its own, or an example built from them.
 * `items` is one name or several, space-separated; several get one link each, named so they can be told apart.
 */
export function OpenInV0({ items, className = '' }: { items: string; className?: string }) {
  const names = items.split(/\s+/).filter(Boolean)
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      {names.map((name) => (
        <a
          key={name}
          href={openInV0Url(name)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-line-2 bg-panel px-2.5 py-1 font-sans text-[12.5px] font-medium text-ink no-underline transition-colors hover:border-pink/50 hover:text-pink"
        >
          {names.length > 1 ? <>Open <span className="font-mono text-[0.95em]">{name}</span> in v0</> : 'Open in v0'}
          <ArrowUpRight aria-hidden className="size-3.5" />
        </a>
      ))}
    </span>
  )
}
