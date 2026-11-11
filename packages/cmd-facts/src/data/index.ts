import { CLOUD } from './cloud.ts'
import { DEV } from './dev.ts'
import { FILES } from './files.ts'
import { LANG } from './lang.ts'
import { NET } from './net.ts'
import { SECRETS } from './secrets.ts'
import { SYSTEM } from './system.ts'
import type { Entry } from '../entry.ts'
import type { Pack } from '../pack.ts'
import { VERSION } from '../version.ts'
import { freeze } from '../registry.ts'

// Programs that are the same program under another name, as far as what the person approving needs to know.
const SAME_AS: Record<string, keyof typeof TABLES | string> = { bash: 'sh', zsh: 'sh', dash: 'sh', ksh: 'sh', fish: 'sh', csh: 'sh', tcsh: 'sh', podman: 'docker', tofu: 'terraform' }

const TABLES: Record<string, Entry> = { ...FILES, ...SYSTEM, ...NET, ...SECRETS, ...DEV, ...LANG, ...CLOUD }

/** Every command this library can account for, compiled into the package. */
export const COMMANDS: Record<string, Entry> = {
  ...TABLES,
  ...Object.fromEntries(Object.entries(SAME_AS).map(([name, real]) => [name, TABLES[real]!])),
}

/**
 * The curated table as a pack, so it is resolved by the same path as anything a consumer adds: it is pack zero,
 * not a special case. It still has to be named in `trust` to keep the confidence its rows were written with —
 * trusting a table is a decision a consumer makes in its own source, never one a table makes about itself.
 *
 * Frozen all the way down, rows included: it is one object shared by everything in the process that imports this
 * package, and a row rewritten by one of them would answer for all the others. Spread it to build on it.
 */
export const BUILTIN: Pack = freeze({
  // The package version. It is reported in `attribution`, so an audit log records which table answered.
  name: '@cmd-facts/builtin',
  version: VERSION,
  description: 'Structured facts about what a command does, for people who have to approve it.',
  license: 'MIT',
  codeRepository: 'https://github.com/david-sling/cmd-facts',
  commands: COMMANDS,
})

export { CLOUD, DEV, FILES, LANG, NET, SECRETS, SYSTEM }
