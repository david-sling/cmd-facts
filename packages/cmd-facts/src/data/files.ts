import { fact, opaqueFact, valuesOf } from '../entry.ts'
import type { Entry } from '../entry.ts'

const GONE = 'Files removed this way do not go to the Bin and cannot be put back.'
const REPLACED = 'A file already in that place with the same name is replaced by this one.'

export const FILES: Record<string, Entry> = {
  ls: {
    facts: fact('Lists the names of the files and folders kept in one place on this computer.', {
      tell: ['Lists the names of the files and folders kept in ', { role: 'path' }, '.'],
      docs: 'man 1 ls',
    }),
    operands: ['path'],
  },
  cat: {
    facts: fact('Shows everything written inside a file.', {
      tell: ['Shows everything written inside ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 cat',
    }),
    operands: ['path'],
  },
  head: {
    facts: fact('Shows the first few lines of a file.', {
      tell: ['Shows the first few lines of ', { role: 'path' }, '.'],
      docs: 'man 1 head',
    }),
    operands: ['path'],
    values: valuesOf('text', ['-n', '--lines', '-c', '--bytes']),
  },
  tail: {
    facts: fact('Shows the last few lines of a file.', {
      tell: ['Shows the last few lines of ', { role: 'path' }, '.'],
      docs: 'man 1 tail',
    }),
    operands: ['path'],
    values: valuesOf('text', ['-n', '--lines', '-c', '--bytes', '-b']),
    flags: [
      {
        flags: ['-f', '-F', '--follow'],
        facts: {
          says: 'Shows the end of a file and keeps showing new lines as they are written, until it is stopped.',
          tell: ['Shows the end of ', { role: 'path' }, ' and keeps showing new lines as they are written, until it is stopped.'],
        },
      },
    ],
  },
  wc: {
    facts: fact('Counts the lines, words and letters in a file.', {
      tell: ['Counts the lines, words and letters in ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 wc',
    }),
    operands: ['path'],
  },
  tee: {
    facts: fact('Saves what it is given into a file, and shows it as well.', {
      effect: ['read', 'create', 'write'],
      reversible: 'no',
      tell: ['Saves what it is given into ', { role: 'path', which: 'all' }, ', and shows it as well.'],
      note: REPLACED,
      docs: 'man 1 tee',
    }),
    operands: ['path'],
    flags: [
      {
        flags: ['-a', '--append'],
        facts: {
          repeatSafe: false,
          says: 'Adds what it is given to the end of a file, and shows it as well.',
          tell: ['Adds what it is given to the end of ', { role: 'path', which: 'all' }, ', and shows it as well.'],
        },
      },
    ],
  },
  grep: {
    facts: fact('Searches files for the lines that contain a piece of text.', {
      tell: ['Searches ', { role: 'path', which: 'all' }, ' for the lines that contain ', { role: 'pattern' }, '.'],
      docs: 'man 1 grep',
    }),
    operands: ['pattern', 'path'],
    // `--color` is left out because its value is optional.
    values: {
      ...valuesOf('pattern', ['--include', '--exclude', '--exclude-dir']),
      ...valuesOf('text', [
        '-m', '--max-count', '--label', '-A', '--after-context', '-B', '--before-context', '-C', '--context',
        '--binary-files', '-D', '--devices', '-d', '--directories',
      ]),
    },
    flags: [
      // Given a pattern this way, the line's first operand is a file like the rest of them.
      { flags: ['-e', '--regexp'], takesValue: true, role: 'pattern', operands: ['path'], facts: {} },
      { flags: ['-f', '--file'], takesValue: true, role: 'path', operands: ['path'], facts: {} },
      {
        flags: ['-r', '-R', '--recursive'],
        facts: {
          says: 'Searches every file kept in one place, and in everything inside it, for a piece of text.',
          tell: ['Searches everything kept inside ', { role: 'path', which: 'all' }, ' for the lines that contain ', { role: 'pattern' }, '.'],
        },
      },
    ],
  },
  find: {
    facts: fact('Looks for files by name, size or age, in one place and in everything inside it.', { docs: 'man 1 find' }),
    flagStyle: 'words',
    operands: ['path'],
    nestedHere: true,
    values: {
      '-f': 'path',
      '-newer': 'path',
      '-user': 'user',
      ...valuesOf('pattern', ['-name', '-iname', '-path', '-ipath', '-regex', '-iregex', '-wholename', '-iwholename']),
      ...valuesOf('text', [
        '-type', '-size', '-perm', '-mtime', '-atime', '-ctime', '-mmin', '-amin', '-cmin', '-maxdepth', '-mindepth',
        '-group', '-links', '-inum', '-fstype',
      ]),
    },
    flags: [
      {
        flags: ['-delete'],
        facts: {
          effect: ['delete'],
          reversible: 'no',
          says: 'Looks for files that match what it was asked for, and removes every one it finds.',
          note: GONE,
        },
      },
      {
        flags: ['-exec', '-execdir', '-ok'],
        takesValue: true,
        role: 'command',
        facts: {
          opaque: true,
          handsOverTo: 'the command it was given, which it runs once for every file it finds',
          effect: ['execute'],
          says: 'Looks for files that match what it was asked for, and runs another command on every one it finds.',
        },
      },
    ],
  },
  df: { facts: fact('Shows how much room is left on each disk.', { docs: 'man 1 df' }), values: { '-T': 'text' } },
  du: {
    facts: fact('Shows how much room files and folders take up.', { docs: 'man 1 du' }),
    operands: ['path'],
    values: { '-d': 'text', '-I': 'pattern' },
  },
  rm: {
    facts: fact('Removes files from this computer.', {
      effect: ['delete'],
      reversible: 'no',
      tell: ['Removes ', { role: 'path', which: 'all' }, ' from this computer.'],
      note: GONE,
      docs: 'man 1 rm',
    }),
    operands: ['path'],
    flags: [
      {
        flags: ['-r', '-R', '--recursive'],
        facts: {
          says: 'Removes a whole folder from this computer, along with everything inside it.',
          tell: ['Removes ', { role: 'path', which: 'all' }, ' from this computer, along with everything inside.'],
        },
      },
    ],
  },
  cp: {
    facts: fact('Copies files to another place on this computer.', {
      effect: ['read', 'create', 'write'],
      reversible: 'no',
      tell: ['Copies ', { role: 'path', which: 'all-but-last' }, ' to ', { role: 'path', which: 'last' }, '.'],
      note: REPLACED,
      docs: 'man 1 cp',
    }),
    operands: ['path'],
    flags: [
      {
        flags: ['-r', '-R', '--recursive'],
        facts: {
          says: 'Copies a whole folder, and everything inside it, to another place.',
          tell: [
            'Copies ',
            { role: 'path', which: 'all-but-last' },
            ', and everything inside, to ',
            { role: 'path', which: 'last' },
            '.',
          ],
        },
      },
    ],
  },
  mv: {
    facts: fact('Moves files to another place on this computer, or gives them a new name.', {
      effect: ['create', 'delete'],
      reversible: 'unknown',
      tell: ['Moves ', { role: 'path', which: 'all-but-last' }, ' to ', { role: 'path', which: 'last' }, '.'],
      note: REPLACED,
      docs: 'man 1 mv',
    }),
    operands: ['path'],
  },
  mkdir: {
    facts: fact('Makes a new, empty folder.', {
      effect: ['create'],
      tell: ['Makes a new, empty folder at ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 mkdir',
    }),
    operands: ['path'],
    values: { '-m': 'mode', '--mode': 'mode' },
  },
  chmod: {
    facts: fact('Changes who is allowed to open or change a file.', {
      effect: ['configure'],
      reversible: 'unknown',
      tell: ['Changes who is allowed to open or change ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 chmod',
    }),
    operands: ['mode', 'path'],
    flags: [
      {
        flags: ['-R', '--recursive'],
        facts: {
          says: 'Changes who is allowed to open or change everything kept inside a folder.',
          tell: ['Changes who is allowed to open or change everything kept inside ', { role: 'path', which: 'all' }, '.'],
        },
      },
    ],
  },
  chown: {
    facts: fact('Changes which account on this computer owns a file.', {
      effect: ['configure'],
      reversible: 'unknown',
      tell: ['Makes ', { role: 'user' }, ' the owner of ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 chown',
    }),
    operands: ['user', 'path'],
    flags: [
      {
        flags: ['-R', '--recursive'],
        facts: {
          says: 'Changes which account owns everything kept inside a folder.',
          tell: ['Makes ', { role: 'user' }, ' the owner of everything kept inside ', { role: 'path', which: 'all' }, '.'],
        },
      },
    ],
  },
  tar: {
    facts: fact('Packs files into one single file, or unpacks a file that was made that way.', { docs: 'man 1 tar' }),
    operands: ['path'],
    bareFlagsFirst: true,
    values: {
      ...valuesOf('path', [
        '-C', '--directory', '-T', '--files-from', '-X', '--exclude-from', '-g', '--listed-incremental', '--index-file',
      ]),
      '--exclude': 'pattern',
      ...valuesOf('text', [
        '--newer-mtime', '--suffix', '--quoting-style', '--quote-chars', '--no-quote-chars', '--sparse-version',
        '--xattrs-include', '--xattrs-exclude',
      ]),
    },
    flags: [
      {
        flags: ['-c', '--create'],
        facts: { effect: ['read', 'create'], says: 'Packs files and folders into one single file.' },
      },
      {
        flags: ['-x', '--extract'],
        facts: {
          effect: ['create', 'write'],
          reversible: 'no',
          says: 'Unpacks a packed file, putting everything it holds onto this computer.',
          note: 'The packed file decides where its contents are put, and can replace files already there.',
        },
      },
      { flags: ['-f', '--file'], takesValue: true, role: 'path', facts: {} },
      {
        flags: ['--to-command'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['execute'], opaque: true, handsOverTo: 'the program each unpacked file is handed to' },
      },
      {
        flags: ['-I', '--use-compress-program'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['execute'], opaque: true, handsOverTo: 'the program named to pack or unpack the data' },
      },
      {
        flags: ['--checkpoint-action'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['execute'], opaque: true, handsOverTo: 'the action it was told to carry out as it goes' },
      },
    ],
  },
  dd: {
    facts: fact('Copies raw data from one place to another exactly as it is, replacing whatever is at the destination.', {
      effect: ['read', 'write', 'create'],
      reversible: 'no',
      repeatSafe: false,
      note: 'Pointed at a disk, it writes over the disk itself rather than files on it, and what was there does not come back.',
      docs: 'man 1 dd',
    }),
  },
  unzip: {
    facts: fact('Unpacks a zip file, putting everything it holds onto this computer.', {
      effect: ['create', 'write'],
      reversible: 'no',
      note: 'The zip file decides where its contents are put, and can replace files already there.',
      docs: 'man 1 unzip',
    }),
    operands: ['path'],
    values: { '-d': 'path' },
    flags: [{ flags: ['-P'], takesValue: true, role: 'text', facts: { touchesCredentials: true } }],
  },
  open: {
    facts: opaqueFact(
      'Opens a file, a folder or a web address the way double-clicking it would.',
      'the app macOS picks to handle what it was given',
      { effect: ['read', 'execute'], docs: 'man 1 open' },
    ),
    operands: ['path'],
    // `--args` is left out: it hands every word after it to the app, which a single value cannot say.
    values: {
      '-u': 'url',
      '--url': 'url',
      ...valuesOf('path', ['-i', '--stdin', '-o', '--stdout', '--stderr']),
      ...valuesOf('text', ['-a', '--application', '-b', '-s', '--env']),
    },
  },
  which: { facts: fact('Shows where a program is kept on this computer.', { docs: 'man 1 which' }), operands: ['text'] },
}
