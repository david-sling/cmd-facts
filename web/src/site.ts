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
  : 'https://cmd-facts.vercel.app'

export const TITLE = 'cmd-facts — structured facts about what a command does'

/** One sentence that says who it is for, because the name alone says nothing to a stranger. */
export const DESCRIPTION =
  'A library that answers what a command does in typed fields — effect, reversibility, network reach, privilege — for the surface that has to ask a person to approve it. No risk score, no model at run time.'

export const OG_IMAGE = `${SITE}/og.png`
