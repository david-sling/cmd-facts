import * as React from 'react'
import { explain, type Explainer, type Explanation, type Input } from 'cmd-facts'

/**
 * `explain()` for a component, recomputed only when the line changes. Pass an explainer built with
 * `createExplainer` to answer from your own packs; keep it stable (module scope or `useMemo`), or every render
 * explains again.
 */
export function useExplain(input: Input, explainer: Explainer = explain): Explanation {
  // An argv is a fresh array on most renders, so it is keyed on its contents rather than its identity.
  const key = typeof input === 'string' ? input : JSON.stringify(input)
  return React.useMemo(() => explainer(input), [key, explainer])
}
