// Where the site is, decided once at build time from the environment Vercel builds in. Read by vite.config.ts, which
// hands it to the pages, and by registry-origin.mjs, which writes it into the built registry.

/** The production address: what pages name as canonical, and where the registry lives unless a build says otherwise. */
export const PRODUCTION = 'https://cmd-facts.davidsling.in'

const origin = (host) => (host.startsWith('http') ? host : `https://${host}`).replace(/\/$/, '')

/**
 * Where this build's registry is served, so Open in v0 and `shadcn add` reach this deployment's own items:
 * `VITE_REGISTRY_URL` where it is set, this deployment's own URL on a Vercel preview, and production otherwise.
 * `VERCEL_URL` names the one deployment rather than the branch, so a button opens exactly what was built here.
 */
export function registryOrigin(env = process.env) {
  if (env.VITE_REGISTRY_URL) return origin(env.VITE_REGISTRY_URL)
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) return origin(env.VERCEL_URL)
  return PRODUCTION
}
