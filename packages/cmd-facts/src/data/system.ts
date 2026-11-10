import { fact, opaqueFact, valuesOf, LOCAL, LOOKS } from '../entry.ts'
import type { Entry, Rule } from '../entry.ts'

// Which running programs a pattern is matched against, shared by the two commands that take the same options.
const PICK_VALUES = {
  ...valuesOf('user', ['-u', '-U']),
  ...valuesOf('text', ['-g', '-G', '-t', '-d', '-s', '--signal', '-O', '--older', '-r', '--runstates', '--ns', '--nslist']),
  '-P': 'pid',
  '-F': 'path',
} as const

const DISK_IMAGE_OPEN: Rule = {
  facts: fact('Opens a disk image so the files inside it can be reached, like a disk that was plugged in.', {
    ...LOCAL, reversible: 'yes', repeatSafe: true,
    effect: ['read', 'configure'],
    docs: 'man 1 hdiutil',
  }),
  operands: ['path'],
  values: { '-mountpoint': 'path', '-shadow': 'path' },
  flags: [{ flags: ['-stdinpass'], facts: { touchesCredentials: true } }],
}

const DISK_IMAGE_CLOSE: Rule = {
  facts: fact('Disconnects a disk image or a disk, so its files can no longer be reached.', {
    ...LOCAL, reversible: 'yes', repeatSafe: true,
    effect: ['terminate', 'configure'],
    docs: 'man 1 hdiutil',
  }),
  operands: ['device'],
}

export const SYSTEM: Record<string, Entry> = {
  // `echo` and `printf` are given no slotted sentence: the words they are handed are one message, and listing them
  // with commas would read as though each were a separate thing.
  echo: {
    facts: fact('Shows a line of text.', { ...LOOKS, docs: 'man 1 echo' }),
    operands: ['text'],
  },
  printf: {
    facts: fact('Shows text, laid out to a pattern.', { ...LOOKS, docs: 'man 1 printf' }),
    operands: ['pattern', 'text'],
  },
  uname: {
    facts: fact('Shows which kind of computer and system this is.', { ...LOOKS, docs: 'man 1 uname' }),
  },
  pwd: {
    facts: fact('Shows which folder this is working in.', { ...LOOKS, docs: 'man 1 pwd' }),
  },
  whoami: {
    facts: fact('Shows which account on this computer is being used.', { ...LOOKS, docs: 'man 1 whoami' }),
  },
  date: {
    facts: fact('Shows what day and time it is now.', { ...LOOKS, docs: 'man 1 date' }),
    values: valuesOf('text', ['-d', '-f', '-r', '-t', '-v', '-z']),
  },
  ps: {
    facts: fact('Lists the programs running on this computer.', { ...LOOKS, docs: 'man 1 ps' }),
    // The long options are the Linux `ps`; they are declared so a line written for it still reads its values.
    values: {
      ...valuesOf('pid', ['-p', '--pid', '--ppid']),
      ...valuesOf('user', ['-U', '-u', '--User', '--user']),
      ...valuesOf('text', ['-o', '-O', '-G', '-t', '--sid', '--tty', '--sort', '--cols', '--columns', '--lines', '--rows', '--width']),
    },
  },
  top: {
    facts: fact('Shows the programs running right now, and how much of the computer each one is using.', {
      ...LOOKS,
      docs: 'man 1 top',
    }),
    // macOS `top` spells some of its options as whole words with one dash; those are declared whole.
    values: {
      '-pid': 'pid',
      '-user': 'user',
      '-U': 'user',
      ...valuesOf('text', ['-s', '-i', '-c', '-l', '-n', '-o', '-O', '-stats']),
    },
  },
  kill: {
    facts: fact('Stops a running program.', {
      ...LOCAL, repeatSafe: true,
      effect: ['terminate'],
      reversible: 'no',
      tell: ['Stops the program running as ', { role: 'pid', which: 'all' }, '.'],
      note: 'Anything the program had not saved is lost.',
      docs: 'man 1 kill',
    }),
    plain: ['-HUP', '-INT', '-QUIT', '-ABRT', '-ALRM', '-TERM', '-1', '-2', '-3', '-6', '-14', '-15'],
    operands: ['pid'],
    values: { '-s': 'signal' },
    flags: [
      {
        flags: ['-9', '-KILL'],
        facts: {
          says: 'Stops a running program at once, without letting it finish what it was doing.',
          tell: [
            'Stops the program running as ',
            { role: 'pid', which: 'all' },
            ' at once, without letting it finish what it was doing.',
          ],
        },
      },
    ],
  },
  lsof: {
    facts: fact('Lists which running programs have which files open.', {
      ...LOOKS,
      note: 'The list also shows which programs are connected to the network, and where.',
      docs: 'man 1 lsof',
    }),
    operands: ['path'],
    // Only the options whose value is required. `-i`, `-s`, `-r` and `-F` may stand alone, and `lsof -i -P` is the
    // usual form, so declaring a value would read `-P` as an address. The `+` options are not read as options here.
    values: { '-p': 'pid', '-u': 'user', ...valuesOf('text', ['-c', '-d', '-D']) },
  },
  env: {
    facts: opaqueFact(
      'Shows the hidden settings that programs on this computer are started with, or starts a program with different ones.',
      'the command it was given, if it was given one',
      {
        network: 'none', privilege: 'none',
        effect: ['read', 'execute'],
        touchesCredentials: true,
        note: 'These hidden settings often hold passwords and access keys for other services.',
        docs: 'man 1 env',
      },
    ),
    operands: ['command'],
    // `-S` carries a whole command line in one word, which is not split here, so its value stays text.
    values: { '-u': 'text', '-P': 'path', '-S': 'text' },
    nestedHere: true,
    assignmentsFirst: true,
  },
  sw_vers: { facts: fact('Shows which version of macOS this computer is running.', { ...LOOKS, docs: 'man 1 sw_vers' }) },
  system_profiler: {
    facts: fact('Puts together a report about this computer, covering its parts and the software on it.', {
      ...LOOKS,
      note: 'The report can include the serial number of this computer and the names of networks it has joined.',
      docs: 'man 8 system_profiler',
    }),
    flagStyle: 'words',
  },
  log: {
    facts: fact('Reads or clears the record macOS keeps of what programs on this computer have been doing.', {
      network: 'none', touchesCredentials: false,
      effect: ['read', 'create', 'delete'],
      reversible: 'no',
      privilege: 'admin',
      repeatSafe: false,
      docs: 'man 1 log',
    }),
    flagStyle: 'words',
    sub: {
      show: {
        facts: fact('Shows past entries from the record macOS keeps of what programs have been doing.', {
          ...LOOKS,
          docs: 'man 1 log',
        }),
        flagStyle: 'words',
      },
      stream: {
        facts: fact('Shows what programs are doing as macOS records it, and keeps going until it is stopped.', {
          ...LOOKS,
          docs: 'man 1 log',
        }),
        flagStyle: 'words',
      },
      collect: {
        facts: fact('Saves a copy of the computer activity record into a file.', {
          ...LOCAL, reversible: 'yes', repeatSafe: true,
          effect: ['read', 'create'],
          note: 'That record can mention the names of files, apps and networks this computer has used.',
          docs: 'man 1 log',
        }),
        flagStyle: 'words',
        values: { '--output': 'path' },
      },
      erase: {
        facts: fact('Removes the record macOS keeps of what programs have been doing.', {
          network: 'none', touchesCredentials: false, repeatSafe: true,
          effect: ['delete'],
          reversible: 'no',
          privilege: 'admin',
          docs: 'man 1 log',
        }),
        flagStyle: 'words',
      },
    },
  },
  defaults: {
    facts: fact('Reads or changes the settings that apps and macOS have saved on this computer.', {
      ...LOCAL,
      effect: ['read', 'create', 'delete', 'configure'],
      reversible: 'no',
      repeatSafe: false,
      docs: 'man 1 defaults',
    }),
    flagStyle: 'words',
    sub: {
      read: {
        facts: fact('Shows the settings an app or macOS has saved.', {
          ...LOOKS,
          note: 'With no app named, it shows every saved setting on this computer, and some apps keep account details there.',
          docs: 'man 1 defaults',
        }),
        operands: ['domain', 'text'],
      },
      'read-type': { facts: fact('Shows what kind of value a saved setting holds.', { ...LOOKS, docs: 'man 1 defaults' }), operands: ['domain', 'text'] },
      write: {
        facts: fact('Changes a saved setting for an app or for macOS.', {
          ...LOCAL, repeatSafe: true,
          effect: ['configure'],
          reversible: 'unknown',
          docs: 'man 1 defaults',
        }),
        operands: ['domain', 'text'],
      },
      delete: {
        facts: fact('Removes a setting an app or macOS had saved, so it goes back to its starting value.', {
          ...LOCAL, repeatSafe: true,
          effect: ['configure', 'delete'],
          reversible: 'no',
          docs: 'man 1 defaults',
        }),
        operands: ['domain', 'text'],
      },
      domains: { facts: fact('Lists the apps and parts of macOS that have saved settings.', { ...LOOKS, docs: 'man 1 defaults' }) },
      export: {
        facts: fact('Writes the saved settings of an app into a file.', { ...LOCAL, reversible: 'yes', repeatSafe: true, effect: ['read', 'create'], docs: 'man 1 defaults' }),
        operands: ['domain', 'path'],
      },
      import: {
        facts: fact('Replaces the saved settings of an app with the ones held in a file.', {
          ...LOCAL, repeatSafe: true,
          effect: ['configure'],
          reversible: 'no',
          docs: 'man 1 defaults',
        }),
        operands: ['domain', 'path'],
      },
    },
  },
  launchctl: {
    facts: fact('Looks at or changes the background programs macOS starts and keeps running.', {
      ...LOCAL,
      effect: ['read', 'terminate', 'configure', 'execute'],
      reversible: 'unknown',
      repeatSafe: false,
      docs: 'man 1 launchctl',
    }),
    sub: {
      list: { facts: fact('Lists the background programs macOS is keeping running.', { ...LOOKS, docs: 'man 1 launchctl' }) },
      print: { facts: fact('Shows how one background program is set up and whether it is running.', { ...LOOKS, docs: 'man 1 launchctl' }) },
      load: {
        facts: fact('Tells macOS to run a background program, and to keep starting it from now on.', {
          ...LOCAL, repeatSafe: true,
          effect: ['configure', 'execute'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['path'],
        values: { '-S': 'text', '-D': 'text' },
      },
      unload: {
        facts: fact('Tells macOS to stop a background program and to stop starting it.', {
          ...LOCAL, repeatSafe: true,
          effect: ['terminate', 'configure'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['path'],
        values: { '-S': 'text', '-D': 'text' },
      },
      bootstrap: {
        facts: fact('Starts a background program and sets macOS up to keep it running.', {
          ...LOCAL, repeatSafe: true,
          effect: ['configure', 'execute'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['text', 'path'],
      },
      bootout: {
        facts: fact('Stops a background program and takes it off the list macOS keeps running.', {
          ...LOCAL, repeatSafe: true,
          effect: ['terminate', 'configure'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['text', 'path'],
      },
      start: {
        facts: fact('Starts one of the background programs macOS knows about.', {
          ...LOCAL, reversible: 'yes', repeatSafe: true,
          effect: ['execute'],
          docs: 'man 1 launchctl',
        }),
        operands: ['service'],
      },
      stop: {
        facts: fact('Stops one of the background programs macOS is running.', {
          ...LOCAL, repeatSafe: true,
          effect: ['terminate'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['service'],
      },
      kickstart: {
        facts: fact('Starts a background program again straight away, whether or not it was running.', {
          ...LOCAL, reversible: 'yes', repeatSafe: true,
          effect: ['terminate', 'execute'],
          docs: 'man 1 launchctl',
        }),
        operands: ['service'],
      },
      enable: {
        facts: fact('Allows a background program to be started on this computer.', {
          ...LOCAL, repeatSafe: true,
          effect: ['configure'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['service'],
      },
      disable: {
        facts: fact('Stops a background program from being started on this computer.', {
          ...LOCAL, repeatSafe: true,
          effect: ['configure'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['service'],
      },
    },
  },
  networksetup: {
    facts: fact('Looks at or changes how this computer connects to networks.', {
      ...LOCAL,
      effect: ['read', 'configure'],
      reversible: 'unknown',
      repeatSafe: false,
      docs: 'man 8 networksetup',
    }),
    flagStyle: 'words',
    flags: [
      {
        flags: ['-setdnsservers'],
        takesValue: true,
        role: 'service',
        facts: {
          effect: ['configure'],
          reversible: 'unknown',
          privilege: 'admin',
          says: 'Changes which service this computer asks to find websites and other computers by name.',
          note: 'Every name this computer looks up from now on goes to whoever runs that service.',
        },
      },
      {
        flags: ['-setwebproxy', '-setsecurewebproxy', '-setsocksfirewallproxy'],
        takesValue: true,
        role: 'service',
        facts: {
          effect: ['configure'],
          reversible: 'unknown',
          privilege: 'admin',
          says: 'Sends this computer web traffic through another computer first.',
          note: 'Whoever runs that other computer can see the traffic that passes through it.',
        },
      },
      {
        flags: ['-setairportnetwork'],
        takesValue: true,
        role: 'device',
        facts: {
          effect: ['configure'],
          reversible: 'yes',
          touchesCredentials: true,
          says: 'Joins this computer to a wireless network.',
          note: 'The password for the network is given to this command as it runs.',
        },
      },
      {
        flags: ['-setairportpower', '-setv4off', '-setv4dhcp', '-setv4manual'],
        takesValue: true,
        role: 'service',
        facts: { effect: ['configure'], reversible: 'yes', says: 'Changes whether and how this computer connects to a network.' },
      },
    ],
  },
  softwareupdate: {
    facts: fact('Asks Apple which updates are available for macOS.', { effect: ['read'], reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true, network: 'known-host', docs: 'man 8 softwareupdate' }),
    values: { '--product-types': 'text' },
    flags: [
      {
        // Left without `takesValue` on purpose: the name of an update is optional here, and `-i -a` is the common
        // form, so declaring a value would read that `-a` as the name of an update.
        flags: ['-i', '--install'],
        facts: {
          effect: ['install', 'write'],
          reversible: 'no',
          privilege: 'admin',
          network: 'known-host',
          says: 'Downloads updates for macOS from Apple and installs them on this computer.',
          note: 'The computer may restart on its own while this is running.',
        },
      },
      {
        flags: ['-l', '--list'],
        facts: { says: 'Lists the updates Apple has available for this computer.' },
      },
    ],
  },
  diskutil: {
    facts: fact('Looks at or changes the disks and storage attached to this computer.', {
      network: 'none', touchesCredentials: false,
      effect: ['read', 'write', 'delete', 'terminate', 'configure'],
      reversible: 'no',
      privilege: 'admin',
      repeatSafe: false,
      docs: 'man 8 diskutil',
    }),
    sub: {
      list: { facts: fact('Lists the disks and storage attached to this computer.', { ...LOOKS, docs: 'man 8 diskutil' }), operands: ['device'] },
      info: { facts: fact('Shows the details of one disk attached to this computer.', { ...LOOKS, docs: 'man 8 diskutil' }), operands: ['device'] },
      mount: {
        facts: fact('Makes a disk available so its files can be opened.', { ...LOCAL, reversible: 'yes', repeatSafe: true, effect: ['configure'], docs: 'man 8 diskutil' }),
        operands: ['device'],
      },
      unmount: {
        facts: fact('Disconnects a disk so that it can be unplugged.', {
          ...LOCAL, reversible: 'yes', repeatSafe: true,
          effect: ['terminate', 'configure'],
          docs: 'man 8 diskutil',
        }),
        operands: ['device'],
      },
      verifyVolume: {
        facts: fact('Checks a disk for faults without changing anything on it.', { ...LOOKS, docs: 'man 8 diskutil' }),
        operands: ['device'],
      },
      repairVolume: {
        facts: fact('Tries to put right faults found on a disk.', {
          network: 'none', touchesCredentials: false, repeatSafe: true,
          effect: ['write'],
          reversible: 'unknown',
          privilege: 'admin',
          docs: 'man 8 diskutil',
        }),
        operands: ['device'],
      },
      eraseDisk: {
        facts: fact('Wipes a whole disk and sets it up again as empty.', {
          network: 'none', touchesCredentials: false, repeatSafe: true,
          effect: ['delete', 'write'],
          reversible: 'no',
          privilege: 'admin',
          note: 'Everything stored on that disk is gone and cannot be put back.',
          docs: 'man 8 diskutil',
        }),
        operands: ['text', 'text', 'device'],
      },
      eraseVolume: {
        facts: fact('Wipes one part of a disk and sets it up again as empty.', {
          network: 'none', touchesCredentials: false, repeatSafe: true,
          effect: ['delete', 'write'],
          reversible: 'no',
          privilege: 'admin',
          note: 'Everything stored on that part of the disk is gone and cannot be put back.',
          docs: 'man 8 diskutil',
        }),
        operands: ['text', 'text', 'device'],
      },
    },
  },
  killall: {
    facts: fact('Stops every running program that has a given name.', {
      ...LOCAL, repeatSafe: true,
      effect: ['terminate'],
      reversible: 'no',
      tell: ['Stops every running program called ', { role: 'text', which: 'all', from: 'operands' }, '.'],
      note: 'Anything those programs had not saved is lost.',
      docs: 'man 1 killall',
    }),
    plain: ['-HUP', '-INT', '-QUIT', '-ABRT', '-ALRM', '-TERM', '-1', '-2', '-3', '-6', '-14', '-15'],
    operands: ['text'],
    values: { '-u': 'user', '-t': 'text', '-c': 'text' },
    flags: [{ flags: ['-9', '-KILL'], facts: { says: 'Stops at once every running program that has a given name, without letting it finish.' } }],
  },
  pkill: {
    facts: fact('Stops the running programs whose names match a pattern.', {
      ...LOCAL, repeatSafe: true,
      effect: ['terminate'],
      reversible: 'no',
      tell: ['Stops the running programs whose names match ', { role: 'pattern' }, '.'],
      note: 'Anything those programs had not saved is lost.',
      docs: 'man 1 pkill',
    }),
    plain: ['-HUP', '-INT', '-QUIT', '-ABRT', '-ALRM', '-TERM', '-1', '-2', '-3', '-6', '-14', '-15'],
    operands: ['pattern'],
    // A signal is named as a word (`-HUP`), which read as a bundle would hand `P` to `-U` as an account.
    flagStyle: 'words',
    values: { ...PICK_VALUES },
    flags: [{ flags: ['-9', '-KILL'], facts: { says: 'Stops at once the running programs whose names match a pattern, without letting them finish.' } }],
  },
  pgrep: {
    facts: fact('Lists the running programs whose names match a pattern.', {
      ...LOOKS,
      tell: ['Lists the running programs whose names match ', { role: 'pattern' }, '.'],
      docs: 'man 1 pgrep',
    }),
    operands: ['pattern'],
    flagStyle: 'words',
    values: { ...PICK_VALUES },
  },
  // Replacing the schedule means commands this line never shows will run later on their own, so the row is blind,
  // and listing the schedule reads the same way: the line alone cannot say which of the two it is.
  crontab: {
    facts: opaqueFact(
      'Shows or replaces the list of commands this computer runs on a schedule for one account.',
      'the commands in the schedule, which run later on their own',
      { ...LOCAL, effect: ['read', 'configure'], reversible: 'no', docs: 'man 1 crontab' },
    ),
    operands: ['path'],
    values: { '-u': 'user' },
    flags: [
      {
        flags: ['-r'],
        facts: { effect: ['delete'], says: 'Removes every command one account has scheduled to run.' },
      },
    ],
  },
  nohup: {
    facts: opaqueFact(
      'Runs another command so that it keeps going after the window it was started from is closed.',
      'the command it was given, which keeps running on its own',
      { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs: 'man 1 nohup' },
    ),
    operands: ['command'],
    nestedHere: true,
  },
  caffeinate: {
    facts: opaqueFact(
      'Keeps this computer awake, for a while or for as long as another command runs.',
      'the command it was given, if it was given one',
      { ...LOCAL, effect: ['configure', 'execute'], docs: 'man 8 caffeinate' },
    ),
    operands: ['command'],
    values: { '-t': 'text', '-w': 'pid' },
    nestedHere: true,
  },
  say: {
    facts: fact('Reads text aloud through the speakers.', { ...LOOKS, docs: 'man 1 say' }),
    operands: ['text'],
    values: { '-f': 'path', '--input-file': 'path', ...valuesOf('text', ['-v', '--voice', '-r', '--rate', '-a', '--audio-device', '--data-format']) },
    flags: [
      {
        flags: ['-o', '--output-file'],
        takesValue: true,
        role: 'path',
        facts: { effect: ['create', 'write'], reversible: 'no', says: 'Turns text into speech and saves it as a sound file.' },
      },
    ],
  },
  pbcopy: {
    facts: fact('Puts the text it is given onto the clipboard, in place of what was there.', {
      ...LOCAL, repeatSafe: true,
      effect: ['write'],
      reversible: 'no',
      docs: 'man 1 pbcopy',
    }),
  },
  pbpaste: {
    facts: fact('Shows what is on the clipboard.', {
      effect: ['read'], reversible: 'yes', network: 'none', privilege: 'none', repeatSafe: true,
      touchesCredentials: true,
      note: 'The clipboard holds whatever was copied last, which is often a password or a sign-in code.',
      docs: 'man 1 pbpaste',
    }),
  },
  osascript: {
    facts: opaqueFact(
      'Runs a script that can control the apps on this computer, and this computer itself.',
      'the script it was given, which can do anything the apps it talks to can do, and run other commands',
      { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs: 'man 1 osascript' },
    ),
    operands: ['path', 'text'],
    values: { '-l': 'text', '-s': 'text' },
    flags: [{ flags: ['-e'], takesValue: true, role: 'text', operands: ['text'], facts: {} }],
  },
  shutdown: {
    facts: fact('Turns this computer off or restarts it.', {
      network: 'none', touchesCredentials: false,
      effect: ['terminate'],
      reversible: 'no',
      privilege: 'admin',
      repeatSafe: false,
      note: 'Anything not saved in open apps is lost, and everyone connected to this computer is cut off.',
      docs: 'man 8 shutdown',
    }),
    operands: ['text'],
    flags: [
      { flags: ['-r'], facts: { says: 'Restarts this computer.' } },
      { flags: ['-h'], facts: { says: 'Turns this computer off.' } },
    ],
  },
  reboot: {
    facts: fact('Restarts this computer straight away.', {
      network: 'none', touchesCredentials: false,
      effect: ['terminate'],
      reversible: 'no',
      privilege: 'admin',
      repeatSafe: false,
      note: 'Anything not saved in open apps is lost, and everyone connected to this computer is cut off.',
      docs: 'man 8 reboot',
    }),
  },
  pmset: {
    facts: fact('Shows or changes the power settings of this computer, such as when it goes to sleep.', {
      network: 'none', touchesCredentials: false,
      effect: ['read', 'configure'],
      reversible: 'unknown',
      privilege: 'admin',
      repeatSafe: false,
      docs: 'man 1 pmset',
    }),
    operands: ['text'],
  },
  scutil: {
    facts: fact('Shows the names and network settings this computer uses.', { ...LOOKS, docs: 'man 8 scutil' }),
    values: { '--get': 'text', '-r': 'host' },
    flags: [
      {
        // `--set Name value`: the new value is the operand that follows.
        flags: ['--set'],
        takesValue: true,
        role: 'text',
        facts: {
          effect: ['configure'],
          reversible: 'unknown',
          privilege: 'admin',
          says: 'Changes one of the names this computer goes by, or how it finds other computers on a network.',
        },
      },
    ],
    operands: ['text'],
  },
  hostname: {
    facts: fact('Shows or changes the name this computer goes by on a network.', {
      network: 'none', touchesCredentials: false, repeatSafe: true,
      effect: ['read', 'configure'],
      reversible: 'unknown',
      privilege: 'admin',
      docs: 'man 1 hostname',
    }),
    operands: ['text'],
  },
  id: {
    facts: fact('Shows which account is being used and which groups it belongs to.', { ...LOOKS, docs: 'man 1 id' }),
    operands: ['user'],
  },
  uptime: { facts: fact('Shows how long this computer has been running since it last started.', { ...LOOKS, docs: 'man 1 uptime' }) },
  who: { facts: fact('Shows the accounts signed in to this computer right now.', { ...LOOKS, docs: 'man 1 who' }) },
  w: {
    facts: fact('Shows the accounts signed in to this computer right now, and what each one is running.', { ...LOOKS, docs: 'man 1 w' }),
    operands: ['user'],
  },
  last: {
    facts: fact('Shows when accounts signed in to this computer, and from where.', { ...LOOKS, docs: 'man 1 last' }),
    operands: ['user'],
    values: { '-f': 'path', '-h': 'host', '-t': 'text', '-n': 'text' },
  },
  sysctl: {
    facts: fact('Shows or changes low-level settings of the system this computer runs.', {
      network: 'none', touchesCredentials: false, repeatSafe: true,
      effect: ['read', 'configure'],
      reversible: 'unknown',
      privilege: 'admin',
      note: 'A changed setting usually lasts until the computer next restarts.',
      docs: 'man 8 sysctl',
    }),
    operands: ['text'],
    values: { '-f': 'path' },
  },
  hdiutil: {
    facts: fact('Works with disk images, files that hold the contents of a whole disk.', {
      network: 'none', privilege: 'none', touchesCredentials: true,
      effect: ['read', 'write', 'create', 'terminate', 'configure'],
      reversible: 'no',
      repeatSafe: false,
      docs: 'man 1 hdiutil',
    }),
    sub: {
      attach: DISK_IMAGE_OPEN,
      mount: DISK_IMAGE_OPEN,
      detach: DISK_IMAGE_CLOSE,
      eject: DISK_IMAGE_CLOSE,
      create: {
        facts: fact('Makes a new disk image file.', {
          ...LOCAL, repeatSafe: true,
          effect: ['create', 'write'],
          reversible: 'no',
          note: 'A file already in that place with the same name is replaced.',
          docs: 'man 1 hdiutil',
        }),
        operands: ['path'],
        values: { '-srcfolder': 'path', '-srcdevice': 'device', ...valuesOf('text', ['-size', '-fs', '-volname', '-type', '-format', '-layout']) },
        flags: [{ flags: ['-passphrase', '-stdinpass'], facts: { touchesCredentials: true } }],
      },
      convert: {
        facts: fact('Makes a copy of a disk image in a different format.', {
          ...LOCAL, repeatSafe: true,
          effect: ['read', 'create', 'write'],
          reversible: 'no',
          docs: 'man 1 hdiutil',
        }),
        operands: ['path'],
        values: { '-o': 'path', '-format': 'text' },
      },
      info: { facts: fact('Lists the disk images that are open on this computer.', { ...LOOKS, docs: 'man 1 hdiutil' }) },
      imageinfo: { facts: fact('Shows the details of a disk image file.', { ...LOOKS, docs: 'man 1 hdiutil' }), operands: ['path'] },
      verify: { facts: fact('Checks a disk image file for damage without changing it.', { ...LOOKS, docs: 'man 1 hdiutil' }), operands: ['path'] },
    },
    flagStyle: 'words',
  },
  codesign: {
    facts: fact('Checks the signature that shows who made an app and that it has not been changed since.', {
      ...LOOKS,
      tell: ['Checks the signature on ', { role: 'path', which: 'all', from: 'operands' }, '.'],
      docs: 'man 1 codesign',
    }),
    operands: ['path'],
    values: {
      ...valuesOf('path', ['--entitlements', '--keychain', '-D', '--detached', '--file-list', '--resource-rules']),
      ...valuesOf('text', [
        '-r', '--requirements', '-i', '--identifier', '-o', '--options', '--prefix', '--timestamp', '-a', '--architecture',
        '--bundle-version', '-P', '--pagesize', '-R', '--test-requirement',
      ]),
    },
    flags: [
      {
        flags: ['-s', '--sign'],
        takesValue: true,
        role: 'text',
        facts: {
          effect: ['write'],
          reversible: 'unknown',
          touchesCredentials: true,
          says: 'Adds a signature to an app that shows who made it, using a signing key kept on this computer.',
          tell: ['Signs ', { role: 'path', which: 'all', from: 'operands' }, ' with a signing key kept on this computer.'],
        },
      },
      // Each takes its value only after `=`, and on its own falls back to a default.
      { flags: ['--preserve-metadata'], attached: true, role: 'text', facts: {} },
      {
        flags: ['--extract-certificates'],
        attached: true,
        role: 'path',
        facts: { effect: ['create', 'write'], note: 'It also saves the certificates behind the signature into files in this folder.' },
      },
      {
        flags: ['--remove-signature'],
        facts: { effect: ['write'], reversible: 'unknown', says: 'Removes the signature from an app.' },
      },
    ],
  },
  plutil: {
    facts: fact('Checks or shows a settings file in the format apps on macOS use for their settings.', {
      ...LOOKS,
      docs: 'man 1 plutil',
    }),
    flagStyle: 'words',
    operands: ['path'],
    values: { '-o': 'path', '-e': 'text', '-extract': 'text', '-type': 'text' },
    flags: [
      {
        flags: ['-convert'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['write'], reversible: 'no', says: 'Rewrites a settings file in another format, in place.' },
      },
      {
        flags: ['-insert', '-replace', '-remove'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['write'], reversible: 'no', says: 'Changes one entry in a settings file, in place.' },
      },
    ],
  },
  mdfind: {
    facts: fact('Searches this computer by name and contents, using the index macOS keeps for searching.', {
      ...LOOKS,
      docs: 'man 1 mdfind',
    }),
    operands: ['text'],
    values: { '-onlyin': 'path', '-name': 'text', '-attr': 'text', '-s': 'text' },
  },
  mdutil: {
    facts: fact('Shows or changes whether macOS keeps a search index for a disk.', {
      network: 'none', touchesCredentials: false, repeatSafe: true,
      effect: ['read', 'configure'],
      reversible: 'unknown',
      privilege: 'admin',
      docs: 'man 1 mdutil',
    }),
    operands: ['path'],
    values: { '-i': 'text' },
    flags: [{ flags: ['-E'], facts: { effect: ['delete'], says: 'Removes the search index macOS keeps for a disk, so it is built again.' } }],
  },
  tmutil: {
    facts: fact('Works with the backups macOS makes of this computer.', {
      network: 'none', touchesCredentials: false,
      effect: ['read', 'write', 'create', 'delete', 'terminate', 'configure'],
      reversible: 'no',
      privilege: 'admin',
      repeatSafe: false,
      docs: 'man 8 tmutil',
    }),
    sub: {
      startbackup: {
        facts: fact('Starts a backup of this computer now.', { ...LOCAL, reversible: 'yes', effect: ['read', 'create'], repeatSafe: false, docs: 'man 8 tmutil' }),
        values: { '-d': 'text', '--destination': 'text' },
      },
      stopbackup: {
        facts: fact('Stops a backup that is running.', { ...LOCAL, reversible: 'yes', repeatSafe: true, effect: ['terminate'], docs: 'man 8 tmutil' }),
      },
      status: { facts: fact('Shows whether a backup is running, and how far along it is.', { ...LOOKS, docs: 'man 8 tmutil' }) },
      listbackups: { facts: fact('Lists the backups made of this computer.', { ...LOOKS, docs: 'man 8 tmutil' }) },
      latestbackup: { facts: fact('Shows where the most recent backup of this computer is kept.', { ...LOOKS, docs: 'man 8 tmutil' }) },
      destinationinfo: { facts: fact('Shows which disks backups of this computer are saved to.', { ...LOOKS, docs: 'man 8 tmutil' }) },
      enable: {
        facts: fact('Turns on regular backups of this computer.', { reversible: 'yes', network: 'none', touchesCredentials: false, repeatSafe: true, effect: ['configure'], privilege: 'admin', docs: 'man 8 tmutil' }),
      },
      disable: {
        facts: fact('Turns off regular backups of this computer.', { reversible: 'yes', network: 'none', touchesCredentials: false, repeatSafe: true, effect: ['configure'], privilege: 'admin', docs: 'man 8 tmutil' }),
      },
      delete: {
        facts: fact('Removes a backup of this computer.', {
          network: 'none', touchesCredentials: false, repeatSafe: true,
          effect: ['delete'],
          reversible: 'no',
          privilege: 'admin',
          note: 'Files kept only in that backup cannot be brought back from it.',
          docs: 'man 8 tmutil',
        }),
        operands: ['path'],
        values: { '-d': 'path', '-t': 'text', '-p': 'path' },
      },
      deletelocalsnapshots: {
        facts: fact('Removes the snapshots of this computer that backups keep on its own disk.', {
          network: 'none', touchesCredentials: false, repeatSafe: true,
          effect: ['delete'],
          reversible: 'no',
          privilege: 'admin',
          docs: 'man 8 tmutil',
        }),
        operands: ['text'],
      },
      restore: {
        facts: fact('Puts files back from a backup, in place of what is there now.', {
          ...LOCAL, repeatSafe: true,
          effect: ['read', 'create', 'write'],
          reversible: 'no',
          tell: ['Puts ', { role: 'path', which: 'all-but-last' }, ' back from a backup into ', { role: 'path', which: 'last' }, '.'],
          docs: 'man 8 tmutil',
        }),
        operands: ['path'],
      },
    },
  },
  // With no command given it opens a prompt that takes changes as they are typed, which the line does not show.
  dscl: {
    facts: opaqueFact(
      'Looks at or changes the accounts and groups on this computer.',
      'the changes typed into it, if it is opened without a command to run',
      { ...LOCAL, effect: ['read'], docs: 'man 1 dscl' },
    ),
    plain: ['-read', '-readall', '-readpl', '-readpli', '-list', '-search', '-diff', '-raw', '-plist', '-url', '-q'],
    flagStyle: 'words',
    operands: ['text'],
    values: { '-u': 'user', '-f': 'path' },
    flags: [
      { flags: ['-P'], takesValue: true, role: 'text', facts: { touchesCredentials: true } },
      {
        flags: ['-create', '-append', '-merge', '-change'],
        facts: { effect: ['create', 'configure'], reversible: 'unknown', privilege: 'admin', says: 'Adds or changes an account, a group, or a detail of one.' },
      },
      {
        flags: ['-delete'],
        facts: { effect: ['delete', 'configure'], reversible: 'no', privilege: 'admin', says: 'Removes an account, a group, or a detail of one.' },
      },
      {
        flags: ['-passwd'],
        facts: {
          effect: ['configure'],
          reversible: 'no',
          privilege: 'admin',
          touchesCredentials: true,
          says: 'Sets a new password for an account on this computer.',
        },
      },
    ],
  },
  sysadminctl: {
    facts: fact('Looks at or changes the accounts on this computer and some of the settings that protect it.', {
      effect: ['read'], reversible: 'yes', network: 'none', touchesCredentials: false, repeatSafe: true,
      privilege: 'admin',
      docs: 'man 8 sysadminctl',
    }),
    flagStyle: 'words',
    values: { '-fullName': 'text', '-UID': 'text', '-GID': 'text', '-shell': 'path', '-home': 'path', '-hint': 'text', '-picture': 'path' },
    flags: [
      {
        flags: ['-addUser'],
        takesValue: true,
        role: 'user',
        facts: { effect: ['create', 'configure'], reversible: 'unknown', says: 'Adds a new account to this computer.' },
      },
      {
        flags: ['-deleteUser'],
        takesValue: true,
        role: 'user',
        facts: {
          effect: ['delete', 'configure'],
          reversible: 'no',
          says: 'Removes an account from this computer.',
          note: 'Unless told to keep it, what was kept in that account is removed with it.',
        },
      },
      {
        flags: ['-resetPasswordFor', '-secureTokenOn', '-secureTokenOff'],
        takesValue: true,
        role: 'user',
        facts: { effect: ['configure'], reversible: 'no', touchesCredentials: true, says: 'Changes how an account on this computer signs in.' },
      },
      { flags: ['-password', '-adminPassword', '-newPassword', '-oldPassword'], takesValue: true, role: 'text', facts: { touchesCredentials: true } },
      { flags: ['-adminUser'], takesValue: true, role: 'user', facts: { touchesCredentials: true } },
      {
        flags: ['-admin'],
        facts: { note: 'The new account can change anything on this computer.' },
      },
      {
        flags: ['-guestAccount', '-screenLock', '-automaticTime', '-afpGuestAccess', '-smbGuestAccess'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['configure'], reversible: 'yes', says: 'Changes a setting that controls who can use this computer.' },
      },
    ],
  },
}
