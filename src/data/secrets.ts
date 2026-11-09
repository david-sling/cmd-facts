import { fact } from '../entry.ts'
import type { Entry } from '../entry.ts'

export const SECRETS: Record<string, Entry> = {
  security: {
    facts: fact('Works with the passwords, keys and certificates this computer keeps locked away.', {
      touchesCredentials: true,
      reversible: 'unknown',
      repeatSafe: false,
      docs: 'man 1 security',
    }),
    sub: {
      'find-generic-password': {
        facts: fact('Looks up a saved password for an app or service.', {
          touchesCredentials: true,
          docs: 'man 1 security',
        }),
        operands: ['text'],
        values: { '-s': 'text', '-a': 'user' },
        flags: [
          {
            flags: ['-w'],
            facts: {
              touchesCredentials: true,
              says: 'Shows a saved password in plain view, as readable text.',
              note: 'Once shown, the password is readable by anyone who can see what this command prints.',
            },
          },
        ],
      },
      'find-internet-password': {
        facts: fact('Looks up a saved password for a website or server.', {
          touchesCredentials: true,
          docs: 'man 1 security',
        }),
        operands: ['text'],
        values: { '-s': 'host', '-a': 'user' },
        flags: [
          {
            flags: ['-w'],
            facts: {
              touchesCredentials: true,
              says: 'Shows a saved website password in plain view, as readable text.',
              note: 'Once shown, the password is readable by anyone who can see what this command prints.',
            },
          },
        ],
      },
      'dump-keychain': {
        facts: fact('Shows everything held in one of the saved-password stores on this computer.', {
          touchesCredentials: true,
          docs: 'man 1 security',
        }),
        operands: ['path'],
      },
      'list-keychains': {
        facts: fact('Lists the saved-password stores this computer knows about.', { docs: 'man 1 security' }),
      },
      'unlock-keychain': {
        facts: fact('Unlocks a saved-password store, so saved passwords can be read without asking again.', {
          effect: ['configure'],
          touchesCredentials: true,
          reversible: 'yes',
          docs: 'man 1 security',
        }),
        operands: ['path'],
      },
      'add-generic-password': {
        facts: fact('Saves a new password into the locked store on this computer.', {
          effect: ['create'],
          touchesCredentials: true,
          docs: 'man 1 security',
        }),
      },
      'delete-generic-password': {
        facts: fact('Removes a saved password from the locked store on this computer.', {
          effect: ['delete'],
          touchesCredentials: true,
          reversible: 'no',
          docs: 'man 1 security',
        }),
      },
    },
  },
  spctl: {
    facts: fact('Looks at or changes the check macOS makes before opening programs downloaded from the internet.', {
      effect: ['read', 'configure'],
      reversible: 'unknown',
      repeatSafe: false,
      docs: 'man 8 spctl',
    }),
    flagStyle: 'words',
    flags: [
      {
        flags: ['--master-disable', '--global-disable'],
        facts: {
          effect: ['configure'],
          privilege: 'admin',
          reversible: 'yes',
          says: 'Turns off the check macOS makes before opening programs downloaded from the internet.',
          note: 'Until it is turned back on, downloaded programs open without that check.',
        },
      },
      {
        flags: ['--master-enable', '--global-enable'],
        facts: {
          effect: ['configure'],
          privilege: 'admin',
          reversible: 'yes',
          says: 'Turns on the check macOS makes before opening programs downloaded from the internet.',
        },
      },
      {
        flags: ['--add'],
        facts: {
          effect: ['configure'],
          privilege: 'admin',
          reversible: 'yes',
          says: 'Tells macOS to allow a program that it would otherwise hold back.',
        },
      },
    ],
  },
  tccutil: {
    facts: fact('Changes which apps are allowed to reach private parts of this computer, like the camera or the screen.', {
      effect: ['configure'],
      reversible: 'no',
      repeatSafe: false,
      docs: 'man 1 tccutil',
    }),
    sub: {
      reset: {
        facts: fact('Takes away the permissions apps were given for one private feature, so each app has to ask again.', {
          effect: ['configure', 'delete'],
          reversible: 'no',
          docs: 'man 1 tccutil',
        }),
        operands: ['text'],
      },
    },
  },
}
