import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import GlassSurface from '#/components/GlassSurface'

const MANAGERS = [
  { id: 'npm', command: 'npm i cmd-facts' },
  { id: 'pnpm', command: 'pnpm add cmd-facts' },
  { id: 'yarn', command: 'yarn add cmd-facts' },
  { id: 'bun', command: 'bun add cmd-facts' },
] as const

export function InstallCommand() {
  const [active, setActive] = useState<string>('npm')
  const [copied, setCopied] = useState(false)
  const command = MANAGERS.find((m) => m.id === active)!.command

  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable; the command is selectable either way */
    }
  }

  return (
    <GlassSurface
      width="100%"
      height={104}
      borderRadius={16}
      backgroundOpacity={0.16}
      saturation={1.1}
      blur={14}
      className="w-full max-w-[400px]"
    >
      <div className="flex h-full w-full flex-col">
        <div
          role="tablist"
          aria-label="Package manager"
          className="flex items-center gap-1 border-b border-white/12 px-1.5 pt-1.5"
        >
          {MANAGERS.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={active === m.id}
              onClick={() => setActive(m.id)}
              className={`rounded-t-md px-3 py-1.5 font-mono text-xs transition-colors ${
                active === m.id
                  ? 'bg-white/12 text-pink'
                  : 'text-white/45 hover:text-white/75'
              }`}
            >
              {m.id}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-3 px-4">
          <span aria-hidden className="font-mono text-sm text-white/40">
            $
          </span>
          <code className="flex-1 font-mono text-[15px] text-white">{command}</code>
          <button
            onClick={copy}
            aria-label={copied ? 'Copied' : `Copy ${command}`}
            className="shrink-0 rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/12 hover:text-white"
          >
            {copied ? (
              <Check className="size-4 text-pink" />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
        </div>
      </div>
    </GlassSurface>
  )
}
