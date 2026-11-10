import { fact, opaqueFact, LOCAL, LOOKS } from '../entry.ts'
import type { Entry } from '../entry.ts'

const GONE = 'Files removed this way do not go to the Bin and cannot be put back.'
const REPLACED = 'A file already in that place with the same name is replaced by this one.'

export const FILES: Record<string, Entry> = {
  ls: {
    facts: fact('Lists the names of the files and folders kept in one place on this computer.', {
      ...LOOKS,
      tell: ['Lists the names of the files and folders kept in ', { role: 'path' }, '.'],
      docs: 'man 1 ls',
    }),
    operands: ['path'],
  },
  cat: {
    facts: fact('Shows everything written inside a file.', {
      ...LOOKS,
      tell: ['Shows everything written inside ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 cat',
    }),
    operands: ['path'],
  },
  head: {
    facts: fact('Shows the first few lines of a file.', {
      ...LOOKS,
      tell: ['Shows the first few lines of ', { role: 'path' }, '.'],
      docs: 'man 1 head',
    }),
    operands: ['path'],
  },
  tail: {
    facts: fact('Shows the last few lines of a file.', {
      ...LOOKS,
      tell: ['Shows the last few lines of ', { role: 'path' }, '.'],
      docs: 'man 1 tail',
    }),
    operands: ['path'],
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
      ...LOOKS,
      tell: ['Counts the lines, words and letters in ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 wc',
    }),
    operands: ['path'],
  },
  tee: {
    facts: fact('Saves what it is given into a file, and shows it as well.', {
      ...LOCAL, repeatSafe: true,
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
      ...LOOKS,
      tell: ['Searches ', { role: 'path', which: 'all' }, ' for the lines that contain ', { role: 'pattern' }, '.'],
      docs: 'man 1 grep',
    }),
    operands: ['pattern', 'path'],
    flags: [
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
    facts: fact('Looks for files by name, size or age, in one place and in everything inside it.', { ...LOOKS, docs: 'man 1 find' }),
    flagStyle: 'words',
    operands: ['path'],
    nestedHere: true,
    values: { '-name': 'pattern', '-path': 'pattern', '-newer': 'path' },
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
  df: { facts: fact('Shows how much room is left on each disk.', { ...LOOKS, docs: 'man 1 df' }) },
  du: { facts: fact('Shows how much room files and folders take up.', { ...LOOKS, docs: 'man 1 du' }), operands: ['path'] },
  rm: {
    facts: fact('Removes files from this computer.', {
      ...LOCAL, repeatSafe: true,
      effect: ['delete'],
      reversible: 'no',
      tell: ['Removes ', { role: 'path', which: 'all' }, ' from this computer.'],
      note: GONE,
      docs: 'man 1 rm',
    }),
    operands: ['path'],
    plain: ['-f', '--force', '-i', '-I', '-v', '--verbose', '-d', '--dir', '-P', '-x', '--one-file-system'],
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
      ...LOCAL, repeatSafe: true,
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
      ...LOCAL, repeatSafe: true,
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
      ...LOCAL, reversible: 'yes', repeatSafe: true,
      effect: ['create'],
      tell: ['Makes a new, empty folder at ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 mkdir',
    }),
    operands: ['path'],
  },
  chmod: {
    facts: fact('Changes who is allowed to open or change a file.', {
      ...LOCAL, repeatSafe: true,
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
      ...LOCAL, repeatSafe: true,
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
    facts: fact('Packs files into one single file, or unpacks a file that was made that way.', { ...LOOKS, docs: 'man 1 tar' }),
    operands: ['path'],
    bareFlagsFirst: true,
    plain: ['-z', '--gzip', '--gunzip', '-j', '--bzip2', '-J', '--xz', '-v', '--verbose', '-t', '--list'],
    values: { '-C': 'path', '--cd': 'path', '--directory': 'path' },
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
      ...LOCAL,
      effect: ['read', 'write', 'create'],
      reversible: 'no',
      repeatSafe: false,
      note: 'Pointed at a disk, it writes over the disk itself rather than files on it, and what was there does not come back.',
      docs: 'man 1 dd',
    }),
  },
  unzip: {
    facts: fact('Unpacks a zip file, putting everything it holds onto this computer.', {
      ...LOCAL, repeatSafe: true,
      effect: ['create', 'write'],
      reversible: 'no',
      note: 'The zip file decides where its contents are put, and can replace files already there.',
      docs: 'man 1 unzip',
    }),
    operands: ['path'],
  },
  open: {
    facts: opaqueFact(
      'Opens a file, a folder or a web address the way double-clicking it would.',
      'the app macOS picks to handle what it was given',
      { ...LOCAL, effect: ['read', 'execute'], docs: 'man 1 open' },
    ),
    operands: ['path'],
    values: { '-a': 'text', '--application': 'text' },
  },
  which: { facts: fact('Shows where a program is kept on this computer.', { ...LOOKS, docs: 'man 1 which' }), operands: ['text'] },
}
