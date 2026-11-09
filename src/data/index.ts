import { DEV } from './dev.ts'
import { FILES } from './files.ts'
import { NET } from './net.ts'
import { SECRETS } from './secrets.ts'
import { SYSTEM } from './system.ts'
import type { Entry } from '../entry.ts'

// Programs that are the same program under another name, as far as what the person approving needs to know.
const SAME_AS: Record<string, keyof typeof TABLES | string> = { bash: 'sh', zsh: 'sh', dash: 'sh' }

const TABLES: Record<string, Entry> = { ...FILES, ...SYSTEM, ...NET, ...SECRETS, ...DEV }

/**
 * Every command this library can account for, compiled into the package. There is no way to add to it at run time:
 * anyone who could drop in a file of their own could relabel a command that takes over the computer as one that
 * checks free disk space, which is the one thing a prompt like this must never let happen.
 */
export const COMMANDS: Record<string, Entry> = {
  ...TABLES,
  ...Object.fromEntries(Object.entries(SAME_AS).map(([name, real]) => [name, TABLES[real]!])),
}

export { DEV, FILES, NET, SECRETS, SYSTEM }
