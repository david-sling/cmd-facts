import { openInV0Url } from '#/site'

/**
 * v0's own button, as shadcn's docs give it (ui.shadcn.com/docs/registry/open-in-v0), black with a white outline so it
 * stands off the dark page, linking to one of this site's
 * registry items: an example, or a component, which opens onto its first example (see V0_OPENS). `items` is one name
 * or several, space-separated; several get one button each, with the name beside it so they can be told apart.
 */
export function OpenInV0({ items, className = '' }: { items: string; className?: string }) {
  const names = items.split(/\s+/).filter(Boolean)
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      {names.map((name) => (
        <span key={name} className="inline-flex items-center gap-2">
          {names.length > 1 && <span className="font-mono text-[12.5px] text-ink">{name}</span>}
          <a
            data-slot="open-in-v0"
            href={openInV0Url(name)}
            target="_blank"
            rel="noreferrer"
            aria-label={names.length > 1 ? `Open ${name} in v0` : 'Open in v0'}
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-[6px] border border-white/40 bg-black px-3 font-sans text-xs font-medium whitespace-nowrap text-white no-underline outline-none hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-pink/60"
          >
            Open in{' '}
            <svg viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden className="size-5 text-current">
              <path
                d="M23.3919 0H32.9188C36.7819 0 39.9136 3.13165 39.9136 6.99475V16.0805H36.0006V6.99475C36.0006 6.90167 35.9969 6.80925 35.9898 6.71766L26.4628 16.079C26.4949 16.08 26.5272 16.0805 26.5595 16.0805H36.0006V19.7762H26.5595C22.6964 19.7762 19.4788 16.6139 19.4788 12.7508V3.68923H23.3919V12.7508C23.3919 12.9253 23.4054 13.0977 23.4316 13.2668L33.1682 3.6995C33.0861 3.6927 33.003 3.68923 32.9188 3.68923H23.3919V0Z"
                fill="currentColor"
              />
              <path
                d="M13.7688 19.0956L0 3.68759H5.53933L13.6231 12.7337V3.68759H17.7535V17.5746C17.7535 19.6705 15.1654 20.6584 13.7688 19.0956Z"
                fill="currentColor"
              />
            </svg>
          </a>
        </span>
      ))}
    </span>
  )
}
