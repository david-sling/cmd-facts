// `shadcn build` copies registry.json as written, and its examples name their components by production URL. A preview
// rewrites those to itself, so an example opened in v0 from a preview pulls in that preview's components.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { PRODUCTION, registryOrigin } from './origin.mjs'

const dir = new URL('../public/r/', import.meta.url)
const to = registryOrigin()

if (to !== PRODUCTION) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const path = new URL(file, dir)
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll(`${PRODUCTION}/`, `${to}/`))
  }
}
console.log(`registry served from ${to}`)
