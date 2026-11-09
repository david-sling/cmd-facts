import { fact, opaqueFact } from '../entry.ts'
import type { Entry } from '../entry.ts'

export const NET: Record<string, Entry> = {
  ping: {
    facts: fact('Checks whether another computer on the network answers, and how long it takes.', {
      network: 'known-host',
      docs: 'man 8 ping',
    }),
    operands: ['host'],
  },
  curl: {
    facts: fact('Fetches whatever is at a web address and shows it.', { network: 'arbitrary', docs: 'man 1 curl' }),
    operands: ['url'],
    values: { '--url': 'url' },
    flags: [
      {
        flags: ['-o', '--output'],
        takesValue: true,
        role: 'path',
        facts: {
          effect: ['read', 'create', 'write'],
          reversible: 'no',
          says: 'Fetches whatever is at a web address and saves it into a file on this computer.',
          note: 'A file already in that place with the same name is replaced by what is downloaded.',
        },
      },
      {
        flags: ['-O', '--remote-name'],
        facts: {
          effect: ['read', 'create', 'write'],
          reversible: 'no',
          says: 'Fetches whatever is at a web address and saves it into a file on this computer.',
          note: 'The web address decides what the saved file is called.',
        },
      },
      {
        flags: ['-d', '--data', '--data-binary', '--data-raw', '-F', '--form', '-T', '--upload-file'],
        facts: {
          effect: ['read', 'transmit'],
          repeatSafe: false,
          says: 'Sends information from this computer to a web address, and shows what comes back.',
        },
      },
      {
        flags: ['-k', '--insecure'],
        facts: { note: 'This one does not check that the site answering is the site it claims to be.' },
      },
      { flags: ['-u', '--user'], takesValue: true, role: 'user', facts: { touchesCredentials: true } },
    ],
  },
  ssh: {
    facts: opaqueFact(
      'Connects to another computer and works on it from here.',
      'whatever it is asked to run, which happens on the other computer',
      { effect: ['read', 'transmit', 'execute'], network: 'known-host', docs: 'man 1 ssh' },
    ),
    operands: ['host', 'command'],
  },
}
