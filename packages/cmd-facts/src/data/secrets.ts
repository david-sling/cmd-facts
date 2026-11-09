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
  csrutil: {
    facts: fact('Looks at or changes the protection macOS puts around its own files.', {
      effect: ['read', 'configure'],
      reversible: 'unknown',
      privilege: 'admin',
      repeatSafe: false,
      docs: 'man 8 csrutil',
    }),
    sub: {
      status: {
        facts: fact('Shows whether the protection macOS puts around its own files is on.', { docs: 'man 8 csrutil' }),
      },
      disable: {
        facts: fact('Turns off the protection macOS puts around its own files.', {
          effect: ['configure'],
          privilege: 'admin',
          note: 'Until it is turned back on, parts of macOS that are normally kept from being changed can be changed.',
          docs: 'man 8 csrutil',
        }),
      },
      enable: {
        facts: fact('Turns on the protection macOS puts around its own files.', { effect: ['configure'], privilege: 'admin', docs: 'man 8 csrutil' }),
      },
    },
  },
  fdesetup: {
    facts: fact('Looks at or changes whether the disk on this computer can be read without the password.', {
      effect: ['read', 'configure'],
      reversible: 'unknown',
      privilege: 'admin',
      touchesCredentials: true,
      repeatSafe: false,
      docs: 'man 8 fdesetup',
    }),
    sub: {
      status: {
        facts: fact('Shows whether the disk on this computer can be read without the password.', {
          touchesCredentials: true,
          docs: 'man 8 fdesetup',
        }),
      },
      enable: {
        facts: fact('Locks the disk on this computer so it cannot be read without the password.', {
          effect: ['configure'],
          privilege: 'admin',
          touchesCredentials: true,
          note: 'A key that can unlock the disk without the password is shown once while this runs.',
          docs: 'man 8 fdesetup',
        }),
      },
      disable: {
        facts: fact('Unlocks the disk on this computer, so it can be read without the password.', {
          effect: ['configure'],
          privilege: 'admin',
          touchesCredentials: true,
          note: 'Anyone who can reach the disk afterwards can read what is on it.',
          docs: 'man 8 fdesetup',
        }),
      },
    },
  },
  socketfilterfw: {
    facts: fact('Looks at or changes which programs may accept connections coming in from the network.', {
      effect: ['read', 'configure'],
      reversible: 'unknown',
      repeatSafe: false,
      docs: 'man 8 socketfilterfw',
    }),
    flagStyle: 'words',
    flags: [
      {
        flags: ['--getglobalstate', '--getblockall', '--listapps'],
        facts: { says: 'Shows which programs may accept connections coming in from the network.' },
      },
      {
        flags: ['--setglobalstate'],
        takesValue: true,
        role: 'mode',
        facts: {
          effect: ['configure'],
          privilege: 'admin',
          says: 'Turns the check on connections coming in from the network on or off.',
          note: 'With the check off, any program on this computer may accept connections from the network.',
        },
      },
      {
        flags: ['--add', '--unblockapp'],
        takesValue: true,
        role: 'path',
        facts: {
          effect: ['configure'],
          privilege: 'admin',
          says: 'Lets one program accept connections coming in from the network.',
          tell: ['Lets ', { role: 'path' }, ' accept connections coming in from the network.'],
        },
      },
      {
        flags: ['--blockapp'],
        takesValue: true,
        role: 'path',
        facts: {
          effect: ['configure'],
          privilege: 'admin',
          says: 'Stops one program from accepting connections coming in from the network.',
          tell: ['Stops ', { role: 'path' }, ' from accepting connections coming in from the network.'],
        },
      },
    ],
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
        takesValue: true,
        role: 'path',
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
