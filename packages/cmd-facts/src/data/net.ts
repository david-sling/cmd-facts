import { fact, opaqueFact } from '../entry.ts'
import type { Entry } from '../entry.ts'

export const NET: Record<string, Entry> = {
  ping: {
    facts: fact('Checks whether another computer on the network answers, and how long it takes.', {
      network: 'known-host',
      tell: ['Checks whether ', { role: 'host' }, ' answers, and how long it takes.'],
      docs: 'man 8 ping',
    }),
    operands: ['host'],
  },
  curl: {
    facts: fact('Fetches whatever is at a web address and shows it.', {
      network: 'arbitrary',
      tell: ['Makes a request to ', { role: 'url', show: 'host' }, ' and shows what comes back.'],
      docs: 'man 1 curl',
    }),
    operands: ['url'],
    // Only the address being requested carries the `url` role, because the sentence takes the first of them: a
    // referer or a proxy given here would otherwise be named as the address this command reaches.
    values: {
      '--url': 'url',
      '-w': 'text',
      '--write-out': 'text',
      '-H': 'text',
      '--header': 'text',
      '-X': 'text',
      '--request': 'text',
      '-A': 'text',
      '--user-agent': 'text',
      '-e': 'text',
      '--referer': 'text',
      '-m': 'text',
      '--max-time': 'text',
      '--connect-timeout': 'text',
      '--resolve': 'text',
      '-x': 'host',
      '--proxy': 'host',
      '-D': 'path',
      '--dump-header': 'path',
      '-K': 'path',
      '--config': 'path',
    },
    flags: [
      {
        flags: ['-o', '--output'],
        takesValue: true,
        role: 'path',
        facts: {
          effect: ['read', 'create', 'write'],
          reversible: 'no',
          says: 'Fetches whatever is at a web address and saves it into a file on this computer.',
          tell: [
            'Makes a request to ',
            { role: 'url', show: 'host' },
            ' and saves what comes back into ',
            { role: 'path' },
            '.',
          ],
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
        flags: ['-d', '--data', '--data-binary', '--data-raw', '-F', '--form'],
        takesValue: true,
        role: 'text',
        facts: {
          effect: ['read', 'transmit'],
          repeatSafe: false,
          says: 'Sends information from this computer to a web address, and shows what comes back.',
          tell: ['Sends information from this computer to ', { role: 'url', show: 'host' }, ', and shows what comes back.'],
        },
      },
      {
        flags: ['-T', '--upload-file'],
        takesValue: true,
        role: 'path',
        facts: {
          effect: ['read', 'transmit'],
          repeatSafe: false,
          says: 'Sends a file from this computer to a web address, and shows what comes back.',
          tell: ['Sends ', { role: 'path' }, ' from this computer to ', { role: 'url', show: 'host' }, '.'],
        },
      },
      {
        flags: ['-b', '--cookie'],
        takesValue: true,
        role: 'text',
        facts: { touchesCredentials: true },
      },
      {
        flags: ['-c', '--cookie-jar', '-E', '--cert', '--key'],
        takesValue: true,
        role: 'path',
        facts: { touchesCredentials: true },
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
      {
        effect: ['read', 'transmit', 'execute'],
        tell: ['Connects to ', { role: 'host' }, ' and works on it from here.'],
        network: 'known-host',
        docs: 'man 1 ssh',
      },
    ),
    operands: ['host', 'command'],
  },
}
