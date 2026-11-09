import { fact, opaqueFact } from '../entry.ts'
import type { Entry } from '../entry.ts'

export const SYSTEM: Record<string, Entry> = {
  // `echo` and `printf` are given no slotted sentence: the words they are handed are one message, and listing them
  // with commas would read as though each were a separate thing.
  echo: {
    facts: fact('Shows a line of text.', { docs: 'man 1 echo' }),
    operands: ['text'],
  },
  printf: {
    facts: fact('Shows text, laid out to a pattern.', { docs: 'man 1 printf' }),
    operands: ['pattern', 'text'],
  },
  pwd: {
    facts: fact('Shows which folder this is working in.', { docs: 'man 1 pwd' }),
  },
  whoami: {
    facts: fact('Shows which account on this computer is being used.', { docs: 'man 1 whoami' }),
  },
  date: {
    facts: fact('Shows what day and time it is now.', { docs: 'man 1 date' }),
  },
  ps: { facts: fact('Lists the programs running on this computer.', { docs: 'man 1 ps' }) },
  top: {
    facts: fact('Shows the programs running right now, and how much of the computer each one is using.', {
      docs: 'man 1 top',
    }),
  },
  kill: {
    facts: fact('Stops a running program.', {
      effect: ['terminate'],
      reversible: 'no',
      tell: ['Stops the program running as ', { role: 'pid', which: 'all' }, '.'],
      note: 'Anything the program had not saved is lost.',
      docs: 'man 1 kill',
    }),
    operands: ['pid'],
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
      note: 'The list also shows which programs are connected to the network, and where.',
      docs: 'man 1 lsof',
    }),
  },
  env: {
    facts: opaqueFact(
      'Shows the hidden settings that programs on this computer are started with, or starts a program with different ones.',
      'the command it was given, if it was given one',
      {
        effect: ['read', 'execute'],
        touchesCredentials: true,
        note: 'These hidden settings often hold passwords and access keys for other services.',
        docs: 'man 1 env',
      },
    ),
    operands: ['command'],
    nestedHere: true,
    assignmentsFirst: true,
  },
  sw_vers: { facts: fact('Shows which version of macOS this computer is running.', { docs: 'man 1 sw_vers' }) },
  system_profiler: {
    facts: fact('Puts together a report about this computer, covering its parts and the software on it.', {
      note: 'The report can include the serial number of this computer and the names of networks it has joined.',
      docs: 'man 8 system_profiler',
    }),
    flagStyle: 'words',
  },
  log: {
    facts: fact('Reads or clears the record macOS keeps of what programs on this computer have been doing.', {
      effect: ['read', 'delete'],
      reversible: 'unknown',
      privilege: 'admin',
      repeatSafe: false,
      docs: 'man 1 log',
    }),
    flagStyle: 'words',
    sub: {
      show: {
        facts: fact('Shows past entries from the record macOS keeps of what programs have been doing.', {
          docs: 'man 1 log',
        }),
        flagStyle: 'words',
      },
      stream: {
        facts: fact('Shows what programs are doing as macOS records it, and keeps going until it is stopped.', {
          docs: 'man 1 log',
        }),
        flagStyle: 'words',
      },
      collect: {
        facts: fact('Saves a copy of the computer activity record into a file.', {
          effect: ['read', 'create'],
          note: 'That record can mention the names of files, apps and networks this computer has used.',
          docs: 'man 1 log',
        }),
        flagStyle: 'words',
        values: { '--output': 'path' },
      },
      erase: {
        facts: fact('Removes the record macOS keeps of what programs have been doing.', {
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
      effect: ['read', 'configure'],
      reversible: 'unknown',
      repeatSafe: false,
      docs: 'man 1 defaults',
    }),
    flagStyle: 'words',
    sub: {
      read: {
        facts: fact('Shows the settings an app or macOS has saved.', {
          note: 'With no app named, it shows every saved setting on this computer, and some apps keep account details there.',
          docs: 'man 1 defaults',
        }),
        operands: ['domain', 'text'],
      },
      'read-type': { facts: fact('Shows what kind of value a saved setting holds.', { docs: 'man 1 defaults' }), operands: ['domain', 'text'] },
      write: {
        facts: fact('Changes a saved setting for an app or for macOS.', {
          effect: ['configure'],
          reversible: 'unknown',
          docs: 'man 1 defaults',
        }),
        operands: ['domain', 'text'],
      },
      delete: {
        facts: fact('Removes a setting an app or macOS had saved, so it goes back to its starting value.', {
          effect: ['configure', 'delete'],
          reversible: 'no',
          docs: 'man 1 defaults',
        }),
        operands: ['domain', 'text'],
      },
      domains: { facts: fact('Lists the apps and parts of macOS that have saved settings.', { docs: 'man 1 defaults' }) },
      export: {
        facts: fact('Writes the saved settings of an app into a file.', { effect: ['read', 'create'], docs: 'man 1 defaults' }),
        operands: ['domain', 'path'],
      },
      import: {
        facts: fact('Replaces the saved settings of an app with the ones held in a file.', {
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
      effect: ['read', 'configure'],
      reversible: 'unknown',
      repeatSafe: false,
      docs: 'man 1 launchctl',
    }),
    sub: {
      list: { facts: fact('Lists the background programs macOS is keeping running.', { docs: 'man 1 launchctl' }) },
      print: { facts: fact('Shows how one background program is set up and whether it is running.', { docs: 'man 1 launchctl' }) },
      load: {
        facts: fact('Tells macOS to run a background program, and to keep starting it from now on.', {
          effect: ['configure', 'execute'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['path'],
      },
      unload: {
        facts: fact('Tells macOS to stop a background program and to stop starting it.', {
          effect: ['terminate', 'configure'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['path'],
      },
      bootstrap: {
        facts: fact('Starts a background program and sets macOS up to keep it running.', {
          effect: ['configure', 'execute'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['text', 'path'],
      },
      bootout: {
        facts: fact('Stops a background program and takes it off the list macOS keeps running.', {
          effect: ['terminate', 'configure'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['text', 'path'],
      },
      start: {
        facts: fact('Starts one of the background programs macOS knows about.', {
          effect: ['execute'],
          docs: 'man 1 launchctl',
        }),
        operands: ['service'],
      },
      stop: {
        facts: fact('Stops one of the background programs macOS is running.', {
          effect: ['terminate'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['service'],
      },
      kickstart: {
        facts: fact('Starts a background program again straight away, whether or not it was running.', {
          effect: ['terminate', 'execute'],
          docs: 'man 1 launchctl',
        }),
        operands: ['service'],
      },
      enable: {
        facts: fact('Allows a background program to be started on this computer.', {
          effect: ['configure'],
          reversible: 'yes',
          docs: 'man 1 launchctl',
        }),
        operands: ['service'],
      },
      disable: {
        facts: fact('Stops a background program from being started on this computer.', {
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
      effect: ['read', 'configure'],
      reversible: 'unknown',
      repeatSafe: false,
      docs: 'man 8 networksetup',
    }),
    flagStyle: 'words',
    flags: [
      {
        flags: ['-setdnsservers'],
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
        facts: { effect: ['configure'], reversible: 'yes', says: 'Changes whether and how this computer connects to a network.' },
      },
    ],
  },
  softwareupdate: {
    facts: fact('Asks Apple which updates are available for macOS.', { network: 'known-host', docs: 'man 8 softwareupdate' }),
    flags: [
      {
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
      effect: ['read', 'configure'],
      reversible: 'unknown',
      privilege: 'admin',
      repeatSafe: false,
      docs: 'man 8 diskutil',
    }),
    sub: {
      list: { facts: fact('Lists the disks and storage attached to this computer.', { docs: 'man 8 diskutil' }), operands: ['device'] },
      info: { facts: fact('Shows the details of one disk attached to this computer.', { docs: 'man 8 diskutil' }), operands: ['device'] },
      mount: {
        facts: fact('Makes a disk available so its files can be opened.', { effect: ['configure'], docs: 'man 8 diskutil' }),
        operands: ['device'],
      },
      unmount: {
        facts: fact('Disconnects a disk so that it can be unplugged.', {
          effect: ['terminate', 'configure'],
          docs: 'man 8 diskutil',
        }),
        operands: ['device'],
      },
      verifyVolume: {
        facts: fact('Checks a disk for faults without changing anything on it.', { docs: 'man 8 diskutil' }),
        operands: ['device'],
      },
      repairVolume: {
        facts: fact('Tries to put right faults found on a disk.', {
          effect: ['write'],
          reversible: 'unknown',
          privilege: 'admin',
          docs: 'man 8 diskutil',
        }),
        operands: ['device'],
      },
      eraseDisk: {
        facts: fact('Wipes a whole disk and sets it up again as empty.', {
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
}
