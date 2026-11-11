/**
 * Where this page lives, which the tags a crawler reads cannot be relative about: always production, previews
 * included, so a preview never names itself as the original. vite.config.ts sets it from scripts/origin.mjs, and
 * `VITE_SITE_URL` overrides it.
 */
const host = import.meta.env.VITE_SITE_URL

export const SITE = host
  ? host.startsWith('http')
    ? host.replace(/\/$/, '')
    : `https://${host}`
  : 'https://cmd-facts.davidsling.in'

export const TITLE = 'cmd-facts — structured facts about what a command does'

/** One sentence that says who it is for, because the name alone says nothing to a stranger. */
export const DESCRIPTION =
  'A library that answers what a command does in typed fields — effect, reversibility, network reach, privilege — for the surface that has to ask a person to approve it. No risk score, no model at run time.'

export const OG_IMAGE = `${SITE}/og.png`

export const REPO_URL = 'https://github.com/david-sling/cmd-facts'

/**
 * The two issue forms for a wrong or missing explanation. Both carry the `inaccurate-explanation`
 * label, so the accuracy backlog is one label rather than a search.
 */
export const REPORT_URL = `${REPO_URL}/issues/new?template=inaccurate-explanation.yml`
export const MISSING_URL = `${REPO_URL}/issues/new?template=missing-command.yml`
export const REPORTS_URL = `${REPO_URL}/issues?q=is%3Aissue+label%3Ainaccurate-explanation`

/**
 * Where this build's registry is served: production, or on a Vercel preview the preview itself (see scripts/origin.mjs).
 * Install commands and Open in v0 use it, so a preview's buttons open the items that preview built.
 */
const registry = import.meta.env.VITE_REGISTRY_URL
export const REGISTRY = registry ? registry.replace(/\/$/, '') : SITE

/** A shadcn registry item served by this site, as v0 opens it: v0 fetches the item's JSON and starts a chat from it. */
export const registryItemUrl = (name: string) => `${REGISTRY}/r/${name}.json`

/**
 * What v0 opens for a component: its first example. Opened bare, v0 writes its own page, imports the component as a
 * default export and renders it with no props, and these components have neither; the example installs the component
 * all the same, onto a page that renders.
 */
export const V0_OPENS: Record<string, string> = {
  sentence: 'sentence-demo',
  'command-line': 'command-line-demo',
  'use-explain': 'approve-demo',
}

export const openInV0Url = (name: string) =>
  `https://v0.dev/chat/api/open?url=${encodeURIComponent(registryItemUrl(V0_OPENS[name] ?? name))}`
