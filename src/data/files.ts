import { fact, opaqueFact } from '../entry.ts'
import type { Entry } from '../entry.ts'

const GONE = 'Files removed this way do not go to the Bin and cannot be put back.'
const REPLACED = 'A file already in that place with the same name is replaced by this one.'

export const FILES: Record<string, Entry> = {
  ls: {
    facts: fact('Lists the names of the files and folders kept in one place on this computer.', { docs: 'man 1 ls' }),
    operands: ['path'],
  },
  cat: {
    facts: fact('Shows everything written inside a file.', { docs: 'man 1 cat' }),
    operands: ['path'],
  },
  head: {
    facts: fact('Shows the first few lines of a file.', { docs: 'man 1 head' }),
    operands: ['path'],
  },
  tail: {
    facts: fact('Shows the last few lines of a file.', { docs: 'man 1 tail' }),
    operands: ['path'],
    flags: [
      {
        flags: ['-f', '-F', '--follow'],
        facts: { says: 'Shows the end of a file and keeps showing new lines as they are written, until it is stopped.' },
      },
    ],
  },
  grep: {
    facts: fact('Searches files for the lines that contain a piece of text.', { docs: 'man 1 grep' }),
    operands: ['pattern', 'path'],
    flags: [
      {
        flags: ['-r', '-R', '--recursive'],
        facts: { says: 'Searches every file kept in one place, and in everything inside it, for a piece of text.' },
      },
    ],
  },
  find: {
    facts: fact('Looks for files by name, size or age, in one place and in everything inside it.', { docs: 'man 1 find' }),
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
  df: { facts: fact('Shows how much room is left on each disk.', { docs: 'man 1 df' }) },
  du: { facts: fact('Shows how much room files and folders take up.', { docs: 'man 1 du' }), operands: ['path'] },
  rm: {
    facts: fact('Removes files from this computer.', { effect: ['delete'], reversible: 'no', note: GONE, docs: 'man 1 rm' }),
    operands: ['path'],
    flags: [
      {
        flags: ['-r', '-R', '--recursive'],
        facts: { says: 'Removes a whole folder from this computer, along with everything inside it.' },
      },
    ],
  },
  cp: {
    facts: fact('Copies files to another place on this computer.', {
      effect: ['read', 'create', 'write'],
      reversible: 'no',
      note: REPLACED,
      docs: 'man 1 cp',
    }),
    operands: ['path'],
    flags: [{ flags: ['-r', '-R', '--recursive'], facts: { says: 'Copies a whole folder, and everything inside it, to another place.' } }],
  },
  mv: {
    facts: fact('Moves files to another place on this computer, or gives them a new name.', {
      effect: ['create', 'delete'],
      reversible: 'unknown',
      note: REPLACED,
      docs: 'man 1 mv',
    }),
    operands: ['path'],
  },
  mkdir: {
    facts: fact('Makes a new, empty folder.', { effect: ['create'], docs: 'man 1 mkdir' }),
    operands: ['path'],
  },
  chmod: {
    facts: fact('Changes who is allowed to open or change a file.', {
      effect: ['configure'],
      reversible: 'unknown',
      docs: 'man 1 chmod',
    }),
    operands: ['mode', 'path'],
    flags: [
      {
        flags: ['-R', '--recursive'],
        facts: { says: 'Changes who is allowed to open or change everything kept inside a folder.' },
      },
    ],
  },
  chown: {
    facts: fact('Changes which account on this computer owns a file.', {
      effect: ['configure'],
      reversible: 'unknown',
      docs: 'man 1 chown',
    }),
    operands: ['user', 'path'],
    flags: [{ flags: ['-R', '--recursive'], facts: { says: 'Changes which account owns everything kept inside a folder.' } }],
  },
  tar: {
    facts: fact('Packs files into one single file, or unpacks a file that was made that way.', { docs: 'man 1 tar' }),
    operands: ['path'],
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
    ],
  },
  unzip: {
    facts: fact('Unpacks a zip file, putting everything it holds onto this computer.', {
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
      { effect: ['read', 'execute'], docs: 'man 1 open' },
    ),
    operands: ['path'],
    values: { '-a': 'text', '--application': 'text' },
  },
  which: { facts: fact('Shows where a program is kept on this computer.', { docs: 'man 1 which' }), operands: ['text'] },
}
