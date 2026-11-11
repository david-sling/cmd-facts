/**
 * Where this page lives, which the tags a crawler reads cannot be relative about. Vite hands the
 * build only what is named `VITE_…`, so a domain of its own is one environment variable rather
 * than an edit here; the fallback is where the project deploys today.
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

/** A shadcn registry item served by this site, as v0 opens it: v0 fetches the item's JSON and starts a chat from it. */
export const registryItemUrl = (name: string) => `${SITE}/r/${name}.json`
export const openInV0Url = (name: string) => `https://v0.dev/chat/api/open?url=${encodeURIComponent(registryItemUrl(name))}`
