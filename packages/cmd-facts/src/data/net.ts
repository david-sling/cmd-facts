import { fact, opaqueFact, valuesOf } from '../entry.ts'
import type { Entry } from '../entry.ts'

const SSH_SETTINGS_RUN =
  'whatever it is asked to run on the other computer, and any program its settings tell it to run on this one'

export const NET: Record<string, Entry> = {
  ping: {
    facts: fact('Checks whether another computer on the network answers, and how long it takes.', {
      effect: ['read'], reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true,
      network: 'known-host',
      tell: ['Checks whether ', { role: 'host' }, ' answers, and how long it takes.'],
      docs: 'man 8 ping',
    }),
    operands: ['host'],
    // The source address (`-S`) stays text: the sentence names the first host on the line, the one being checked.
    values: valuesOf('text', [
      '-b', '-c', '-G', '-g', '-h', '-I', '-i', '-k', '-K', '-l', '-M', '-m', '-P', '-p', '-S', '-s', '-T', '-t', '-W', '-z',
    ]),
  },
  curl: {
    facts: fact('Fetches whatever is at a web address and shows it.', {
      effect: ['read'], reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true,
      network: 'arbitrary',
      tell: ['Makes a request to ', { role: 'url', show: 'host' }, ' and shows what comes back.'],
      docs: 'man 1 curl',
    }),
    operands: ['url'],
    plain: ['-f', '--fail', '-s', '--silent', '-S', '--show-error', '-L', '--location', '-v', '--verbose', '-i', '--include', '-I', '--head', '--compressed'],
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
      '--socks4': 'host',
      '--socks4a': 'host',
      '--socks5': 'host',
      '--socks5-hostname': 'host',
      '--proxy1.0': 'host',
      '--cacert': 'path',
      '--capath': 'path',
      '--crlfile': 'path',
      '--proxy-cacert': 'path',
      '--proxy-capath': 'path',
      '--proxy-crlfile': 'path',
      '--pubkey': 'path',
      '--egd-file': 'path',
      '--random-file': 'path',
      '--etag-compare': 'path',
      '--etag-save': 'path',
      '--alt-svc': 'path',
      '--libcurl': 'path',
      '--trace': 'path',
      '--trace-ascii': 'path',
      '--unix-socket': 'path',
      ...valuesOf('text', [
          '-C', '--continue-at', '-P', '--ftp-port', '-r', '--range', '-Y', '--speed-limit', '-y', '--speed-time',
          '-t', '--telnet-option', '-z', '--time-cond', '--abstract-unix-socket', '--cert-type', '--ciphers',
          '--connect-to', '--delegation', '--dns-interface', '--dns-ipv4-addr', '--dns-ipv6-addr', '--dns-servers',
          '--doh-url', '--engine', '--expect100-timeout', '--ftp-account', '--ftp-alternative-to-user', '--ftp-method',
          '--ftp-ssl-ccc-mode', '--happy-eyeballs-timeout-ms', '--hostpubmd5', '--interface', '--keepalive-time',
          '--key-type', '--krb', '--limit-rate', '--local-port', '--login-options', '--mail-auth', '--mail-from',
          '--mail-rcpt', '--max-filesize', '--max-redirs', '--noproxy', '--pinnedpubkey', '--proto', '--proto-default',
          '--proto-redir', '--proxy-cert-type', '--proxy-ciphers', '--proxy-header', '--proxy-key-type',
          '--proxy-pinnedpubkey', '--proxy-service-name', '--proxy-tls13-ciphers', '--proxy-tlsauthtype', '--retry',
          '--retry-delay', '--retry-max-time', '--service-name', '--socks5-gssapi-service', '--tftp-blksize',
          '--tls-max', '--tls13-ciphers', '--tlsauthtype',
      ]),
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
          // `-O` takes the name from the address rather than from the line, so the slot is the host
          // it reaches; `note` carries the naming, which no slot can.
          tell: ['Makes a request to ', { role: 'url', show: 'host' }, ' and saves what comes back into a file in this folder.'],
          note: 'The web address decides what the saved file is called.',
        },
      },
      {
        flags: ['-d', '--data', '--data-binary', '--data-raw', '--data-ascii', '--data-urlencode', '--json', '-F', '--form', '--form-string'],
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
        flags: [
          '-b', '--cookie', '-U', '--proxy-user', '--oauth2-bearer', '--pass', '--proxy-pass', '--tlsuser', '--tlspassword',
          '--proxy-tlsuser', '--proxy-tlspassword',
        ],
        takesValue: true,
        role: 'text',
        facts: { touchesCredentials: true },
      },
      {
        flags: ['-c', '--cookie-jar', '-E', '--cert', '--key', '--proxy-cert', '--proxy-key', '--netrc-file'],
        takesValue: true,
        role: 'path',
        facts: { touchesCredentials: true },
      },
      {
        // A settings file can carry any option this line could, including ones that send or save files.
        flags: ['-K', '--config'],
        takesValue: true,
        role: 'path',
        facts: {
          effect: ['read', 'create', 'write', 'transmit'],
          reversible: 'no',
          repeatSafe: false,
          note: 'The settings file it reads can tell it to send or save files that this line does not name.',
        },
      },
      { flags: ['-n', '--netrc', '--netrc-optional'], facts: { touchesCredentials: true } },
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
        privilege: 'none', touchesCredentials: false,
        effect: ['read', 'transmit', 'execute'],
        tell: ['Connects to ', { role: 'host' }, ' and works on it from here.'],
        network: 'known-host',
        docs: 'man 1 ssh',
      },
    ),
    operands: ['host', 'command'],
    // A jump host (`-J`) and a bind address are left as text: the sentence names the first host on the line, and
    // that has to be the computer being connected to.
    values: {
      '-E': 'path',
      '-S': 'path',
      '-l': 'user',
      ...valuesOf('text', ['-B', '-b', '-c', '-e', '-I', '-J', '-m', '-O', '-P', '-p', '-Q', '-R', '-W', '-w']),
    },
    flags: [
      { flags: ['-i'], takesValue: true, role: 'path', facts: { touchesCredentials: true } },
      {
        // A setting such as ProxyCommand or LocalCommand names a program that runs here, not on the other computer.
        flags: ['-o'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['execute'], opaque: true, handsOverTo: SSH_SETTINGS_RUN },
      },
      { flags: ['-F'], takesValue: true, role: 'path', facts: { effect: ['execute'], opaque: true, handsOverTo: SSH_SETTINGS_RUN } },
      {
        flags: ['-L', '-D'],
        takesValue: true,
        role: 'text',
        facts: {
          network: 'listens',
          note: 'It also opens a door on this computer: anything that connects to it is passed through to the other side.',
        },
      },
    ],
  },
}
