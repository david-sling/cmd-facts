import { fact, opaqueFact, valuesOf } from '../entry.ts'
import type { Entry } from '../entry.ts'
import type { Overlay } from '../facts.ts'

const SETTINGS_RUN_HERE = 'any program its settings tell it to run on this computer'

// Sending a body makes a request that may change something at the other end, so it is not safe to repeat.
const WGET_SENDS: Overlay = {
  effect: ['transmit'],
  repeatSafe: false,
  says: 'Sends information from this computer to a web address, and saves what comes back.',
}

const SSH_SETTINGS_RUN =
  'whatever it is asked to run on the other computer, and any program its settings tell it to run on this one'

export const NET: Record<string, Entry> = {
  ping: {
    facts: fact('Checks whether another computer on the network answers, and how long it takes.', {
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
            { role: 'path', from: '-o' },
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
          tell: ['Sends ', { role: 'path', from: '-T' }, ' from this computer to ', { role: 'url', show: 'host' }, '.'],
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
  scp: {
    facts: fact('Copies files between this computer and another one over the network.', {
      effect: ['read', 'create', 'write', 'transmit'],
      network: 'known-host',
      reversible: 'no',
      tell: ['Copies ', { role: 'text', which: 'all-but-last', from: 'operands' }, ' to ', { role: 'text', which: 'last', from: 'operands' }, '.'],
      note: 'A file already at the destination with the same name is replaced.',
      docs: 'man 1 scp',
    }),
    operands: ['text'],
    values: valuesOf('text', ['-P', '-c', '-l', '-J', '-D', '-X']),
    flags: [
      { flags: ['-i'], takesValue: true, role: 'path', facts: { touchesCredentials: true } },
      { flags: ['-o'], takesValue: true, role: 'text', facts: { effect: ['execute'], opaque: true, handsOverTo: SETTINGS_RUN_HERE } },
      { flags: ['-F'], takesValue: true, role: 'path', facts: { effect: ['execute'], opaque: true, handsOverTo: SETTINGS_RUN_HERE } },
      {
        flags: ['-S'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['execute'], opaque: true, handsOverTo: 'the program named to make the connection in its place' },
      },
    ],
  },
  rsync: {
    facts: fact('Copies files to another place, here or on another computer, sending only what has changed.', {
      effect: ['read', 'create', 'write', 'transmit'],
      network: 'known-host',
      reversible: 'no',
      tell: [
        'Copies ',
        { role: 'text', which: 'all-but-last', from: 'operands' },
        ' to ',
        { role: 'text', which: 'last', from: 'operands' },
        ', sending only what has changed.',
      ],
      note: 'Files already at the destination with the same names are replaced.',
      docs: 'man 1 rsync',
    }),
    operands: ['text'],
    values: {
      ...valuesOf('pattern', ['--exclude', '--include', '-f', '--filter']),
      ...valuesOf('path', [
        '--exclude-from', '--include-from', '--files-from', '--log-file', '--backup-dir', '-T', '--temp-dir', '--partial-dir',
        '--compare-dest', '--copy-dest', '--link-dest', '--read-batch',
      ]),
      ...valuesOf('text', [
        '--chmod', '--chown', '--usermap', '--groupmap', '--bwlimit', '--timeout', '--max-size', '--min-size', '--suffix',
        '--rsync-path', '--port', '-B', '--block-size', '--info', '--debug', '--out-format', '--log-file-format',
        '--checksum-choice', '--compress-choice', '--iconv', '--max-delete', '--contimeout', '-M', '--remote-option', '-@',
        '--modify-window', '--compress-level', '--skip-compress', '--address', '--sockopts', '--stop-at', '--time-limit',
        '--outbuf', '--protocol', '--checksum-seed',
      ]),
    },
    flags: [
      {
        flags: ['--delete', '--del', '--delete-before', '--delete-during', '--delete-after', '--delete-delay', '--delete-excluded'],
        facts: {
          effect: ['delete'],
          says: 'Makes one folder match another exactly, removing files at the destination that are not in the source.',
        },
      },
      {
        flags: ['--remove-source-files'],
        facts: { effect: ['delete'], says: 'Moves files to another place, here or on another computer, removing the originals once sent.' },
      },
      {
        flags: ['-e', '--rsh'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['execute'], opaque: true, handsOverTo: 'the program named to reach the other computer' },
      },
      { flags: ['--password-file'], takesValue: true, role: 'path', facts: { touchesCredentials: true } },
      {
        flags: ['--write-batch', '--only-write-batch'],
        takesValue: true,
        role: 'path',
        facts: { effect: ['create', 'write'], note: 'It also saves a record of the changes into the named file, to be played back later.' },
      },
    ],
  },
  wget: {
    facts: fact('Fetches whatever is at a web address and saves it into a file in this folder.', {
      effect: ['read', 'create'],
      network: 'arbitrary',
      reversible: 'unknown',
      tell: ['Makes a request to ', { role: 'url', show: 'host', from: 'operands' }, ' and saves what comes back into this folder.'],
      docs: 'man 1 wget',
    }),
    operands: ['url'],
    values: {
      ...valuesOf('path', ['-P', '--directory-prefix', '-i', '--input-file', '--ca-certificate', '--ca-directory', '--crl-file']),
      ...valuesOf('pattern', ['--accept-regex', '--reject-regex']),
      ...valuesOf('text', [
        '-U', '--user-agent', '--header', '-t', '--tries', '-T', '--timeout', '-w', '--wait', '-l', '--level', '-A', '--accept',
        '-R', '--reject', '-D', '--domains', '--limit-rate', '--method', '--report-speed', '-B', '--base', '--start-pos',
        '--progress', '--dns-timeout', '--connect-timeout', '--read-timeout', '--waitretry', '-Q', '--quota', '--bind-address',
        '--restrict-file-names', '--local-encoding', '--remote-encoding', '--cut-dirs', '--compression', '--referer',
        '--secure-protocol', '--certificate-type', '--private-key-type', '--ciphers', '--regex-type', '--exclude-domains',
        '--follow-tags', '--ignore-tags', '-I', '--include-directories', '-X', '--exclude-directories',
      ]),
    },
    flags: [
      {
        flags: ['-O', '--output-document'],
        takesValue: true,
        role: 'path',
        facts: {
          effect: ['write'],
          reversible: 'no',
          says: 'Fetches whatever is at a web address and saves it into a file on this computer.',
          tell: ['Makes a request to ', { role: 'url', show: 'host', from: 'operands' }, ' and saves what comes back into ', { role: 'path', from: '-O' }, '.'],
          note: 'What the named file held before is replaced.',
        },
      },
      {
        flags: ['-o', '--output-file', '-a', '--append-output', '--rejected-log'],
        takesValue: true,
        role: 'path',
        facts: { effect: ['write'], note: 'It also writes a record of what it did into the named file.' },
      },
      { flags: ['--post-data', '--body-data'], takesValue: true, role: 'text', facts: WGET_SENDS },
      { flags: ['--post-file', '--body-file'], takesValue: true, role: 'path', facts: WGET_SENDS },
      {
        flags: ['--user', '--password', '--http-user', '--http-password', '--ftp-user', '--ftp-password', '--proxy-user', '--proxy-password'],
        takesValue: true,
        role: 'text',
        facts: { touchesCredentials: true },
      },
      { flags: ['--load-cookies', '--certificate', '--private-key'], takesValue: true, role: 'path', facts: { touchesCredentials: true } },
      { flags: ['--ask-password'], facts: { touchesCredentials: true } },
      {
        flags: ['-r', '--recursive', '-m', '--mirror'],
        facts: { says: 'Fetches a web page and everything it links to on the same site, saving it all into this folder.' },
      },
      {
        // An instruction given this way can change where files are saved, or anything else a settings file could.
        flags: ['-e', '--execute'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['write'], reversible: 'no' },
      },
      { flags: ['--config'], takesValue: true, role: 'path', facts: { effect: ['write'], reversible: 'no' } },
      {
        flags: ['--save-cookies'],
        takesValue: true,
        role: 'path',
        facts: { effect: ['write'], touchesCredentials: true, note: 'The sign-in details the site hands back are saved into the named file.' },
      },
      { flags: ['--no-check-certificate'], facts: { note: 'This one does not check that the site answering is the site it claims to be.' } },
    ],
  },
  nc: {
    facts: fact('Opens a direct connection to another computer and passes text back and forth through it.', {
      effect: ['read', 'transmit'],
      network: 'arbitrary',
      repeatSafe: false,
      tell: ['Opens a direct connection to ', { role: 'host', from: 'operands' }, ' and passes text back and forth through it.'],
      docs: 'man 1 nc',
    }),
    operands: ['host', 'text'],
    // macOS takes `-c` as a switch; elsewhere it can name a program, so only `-e` is read as one.
    values: valuesOf('text', ['-p', '-s', '-w', '-x', '-X', '-i', '-I', '-O', '-T', '-V', '-P', '-b', '-G', '-H', '-J', '-L']),
    flags: [
      {
        flags: ['-l'],
        operands: ['text'],
        facts: { network: 'listens', says: 'Waits for another computer to connect to this one, and passes text back and forth with it.' },
      },
      {
        flags: ['-e'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['execute'], opaque: true, handsOverTo: 'the program named to take over the connection, run on this computer' },
      },
    ],
  },
  dig: {
    facts: fact('Asks the naming service which address a name on the network points to.', { network: 'known-host', docs: 'man 1 dig' }),
    operands: ['text'],
    values: { '-f': 'path', ...valuesOf('text', ['-b', '-c', '-p', '-q', '-t', '-x']) },
    flags: [
      { flags: ['-k'], takesValue: true, role: 'path', facts: { touchesCredentials: true } },
      { flags: ['-y'], takesValue: true, role: 'text', facts: { touchesCredentials: true } },
    ],
  },
  nslookup: {
    facts: fact('Asks the naming service which address a name on the network points to.', { network: 'known-host', docs: 'man 1 nslookup' }),
    operands: ['domain', 'host'],
  },
  host: {
    facts: fact('Asks the naming service which address a name on the network points to.', { network: 'known-host', docs: 'man 1 host' }),
    operands: ['domain', 'host'],
    values: valuesOf('text', ['-t', '-c', '-W', '-N', '-R', '-m']),
  },
  traceroute: {
    facts: fact('Shows each step network traffic takes on its way to another computer.', {
      network: 'known-host',
      tell: ['Shows each step network traffic takes on its way to ', { role: 'host', from: 'operands' }, '.'],
      docs: 'man 8 traceroute',
    }),
    operands: ['host', 'text'],
    values: valuesOf('text', ['-f', '-g', '-i', '-m', '-M', '-p', '-q', '-s', '-t', '-w', '-z', '-A', '-P']),
  },
  netstat: {
    facts: fact("Shows this computer's network connections, and how its traffic is sent on.", { docs: 'man 1 netstat' }),
    values: valuesOf('text', ['-f', '-I', '-p', '-w']),
  },
  ifconfig: {
    facts: fact('Shows or changes the settings of the network connections on this computer.', {
      effect: ['read', 'configure'],
      reversible: 'unknown',
      privilege: 'admin',
      repeatSafe: false,
      note: 'A changed setting can cut this computer off from the network until it is put back.',
      docs: 'man 8 ifconfig',
    }),
    operands: ['device', 'text'],
  },
  whois: {
    facts: fact('Looks up who a web address or network address is registered to.', {
      network: 'known-host',
      tell: ['Looks up who ', { role: 'domain', from: 'operands' }, ' is registered to.'],
      docs: 'man 1 whois',
    }),
    operands: ['domain'],
    values: { '-h': 'text', '-p': 'text', '-c': 'text' },
  },
  arp: {
    facts: fact('Shows the list that matches network addresses to the devices nearby.', { docs: 'man 8 arp' }),
    operands: ['host', 'text'],
    values: { '-i': 'text' },
    flags: [
      {
        flags: ['-d'],
        facts: { effect: ['configure', 'delete'], reversible: 'unknown', privilege: 'admin', says: 'Removes entries from the list that matches network addresses to nearby devices.' },
      },
      {
        flags: ['-s', '-S'],
        facts: { effect: ['configure'], reversible: 'unknown', privilege: 'admin', says: 'Adds an entry to the list that matches network addresses to nearby devices.' },
      },
    ],
  },
}
