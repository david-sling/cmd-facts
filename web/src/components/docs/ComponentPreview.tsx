import { useState, type ComponentType, type ReactNode } from 'react'
import { OpenInV0 } from '#/components/open-in-v0'

// Every example the registry serves, so a docs page can draw one by name.
const EXAMPLES = import.meta.glob<{ default: ComponentType }>('../../registry/examples/*.tsx', { eager: true })

const TABS = ['Preview', 'Code'] as const

/**
 * An example from the registry, drawn live under Preview and shown under Code, the way shadcn's docs do it. The code
 * is the page's own highlighted block, passed as children, so it is what Open in v0 opens. Both panels are rendered
 * and one is hidden, so the code is in the page for search and for Copy as Markdown whichever tab is open.
 */
export function ComponentPreview({ name, children }: { name: string; children: ReactNode }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Preview')
  const Example = EXAMPLES[`../../registry/examples/${name}.tsx`]?.default
  if (!Example) throw new Error(`No example named ${name} in src/registry/examples`)

  return (
    <div className="docs-preview">
      <div className="docs-preview-bar">
        <div role="tablist" aria-label={`${name} example`} className="docs-preview-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`${name}-${t}-tab`}
              aria-controls={`${name}-${t}`}
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <OpenInV0 items={name} />
      </div>
      <div role="tabpanel" id={`${name}-Preview`} aria-labelledby={`${name}-Preview-tab`} hidden={tab !== 'Preview'} className="docs-preview-stage">
        <Example />
      </div>
      <div role="tabpanel" id={`${name}-Code`} aria-labelledby={`${name}-Code-tab`} hidden={tab !== 'Code'}>
        {children}
      </div>
    </div>
  )
}
