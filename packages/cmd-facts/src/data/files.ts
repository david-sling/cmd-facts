import { fact, opaqueFact, valuesOf, LOCAL, LOOKS } from '../entry.ts'
import type { Entry } from '../entry.ts'
import type { Overlay } from '../facts.ts'

const GONE = 'Files removed this way do not go to the Bin and cannot be put back.'
const REPLACED = 'A file already in that place with the same name is replaced by this one.'

const FINGERPRINT = (docs: string): Entry => ({
  facts: fact('Works out a short fingerprint of a file, which comes out different if anything in the file changes.', {
    ...LOOKS,
    tell: ['Works out a short fingerprint of ', { role: 'path', which: 'all' }, '.'],
    docs,
  }),
  operands: ['path'],
})

const XATTR_REMOVES: Overlay = {
  effect: ['configure', 'delete'],
  reversible: 'no',
  says: 'Removes hidden labels from a file, including the one macOS reads before a downloaded app first opens.',
  tell: ['Removes hidden labels from ', { role: 'path', which: 'all' }, '.'],
}

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
    values: valuesOf('text', ['-n', '--lines', '-c', '--bytes']),
  },
  tail: {
    facts: fact('Shows the last few lines of a file.', {
      ...LOOKS,
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
      tell: ['Searches ', { role: 'path', which: 'all', from: 'operands' }, ' for the lines that contain ', { role: 'pattern' }, '.'],
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
          tell: ['Searches everything kept inside ', { role: 'path', which: 'all', from: 'operands' }, ' for the lines that contain ', { role: 'pattern' }, '.'],
        },
      },
    ],
  },
  find: {
    facts: fact('Looks for files by name, size or age, in one place and in everything inside it.', { ...LOOKS, docs: 'man 1 find' }),
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
  df: { facts: fact('Shows how much room is left on each disk.', { ...LOOKS, docs: 'man 1 df' }), values: { '-T': 'text' } },
  du: {
    facts: fact('Shows how much room files and folders take up.', { ...LOOKS, docs: 'man 1 du' }),
    operands: ['path'],
    values: { '-d': 'text', '-I': 'pattern' },
  },
  rm: {
    facts: fact('Removes files from this computer.', {
      ...LOCAL, repeatSafe: true,
      effect: ['delete'],
      reversible: 'no',
      tell: ['Removes ', { role: 'path', which: 'all' }, ' from this computer.'],
      note: GONE,
      docs: 'man 1 rm',
    }),
    plain: ['-f', '--force', '-i', '-I', '-v', '--verbose', '-d', '--dir', '-P', '-x', '--one-file-system'],
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
    values: { '-m': 'mode', '--mode': 'mode' },
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
    plain: ['-z', '--gzip', '--gunzip', '-j', '--bzip2', '-J', '--xz', '-v', '--verbose', '-t', '--list'],
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
    values: { '-d': 'path' },
    flags: [{ flags: ['-P'], takesValue: true, role: 'text', facts: { touchesCredentials: true } }],
  },
  open: {
    facts: opaqueFact(
      'Opens a file, a folder or a web address the way double-clicking it would.',
      'the app macOS picks to handle what it was given',
      { ...LOCAL, effect: ['read', 'execute'], docs: 'man 1 open' },
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
  which: { facts: fact('Shows where a program is kept on this computer.', { ...LOOKS, docs: 'man 1 which' }), operands: ['text'] },
  touch: {
    facts: fact('Marks a file as changed at this moment, and makes an empty file where none is there yet.', {
      ...LOCAL, repeatSafe: true,
      effect: ['create', 'write'],
      reversible: 'unknown',
      tell: ['Marks ', { role: 'path', which: 'all', from: 'operands' }, ' as changed at this moment, making an empty file where none is there yet.'],
      docs: 'man 1 touch',
    }),
    operands: ['path'],
    values: { '-r': 'path', '-t': 'text', '-d': 'text', '-A': 'text' },
  },
  ln: {
    facts: fact('Makes a second name that leads to a file or folder already on this computer.', {
      ...LOCAL, reversible: 'yes', repeatSafe: true,
      effect: ['create'],
      tell: ['Makes ', { role: 'path', which: 'last' }, ' lead to ', { role: 'path', which: 'all-but-last' }, '.'],
      docs: 'man 1 ln',
    }),
    plain: ['-s', '--symbolic', '-v', '--verbose', '-i', '--interactive', '-n', '-h', '--no-dereference', '-w', '-L', '-P'],
    operands: ['path'],
    flags: [
      {
        flags: ['-f', '--force'],
        facts: { effect: ['delete'], reversible: 'no', note: 'A file already at the new name is replaced, and is not kept.' },
      },
    ],
  },
  rmdir: {
    facts: fact('Removes a folder that has nothing inside it.', {
      ...LOCAL, repeatSafe: true,
      effect: ['delete'],
      reversible: 'unknown',
      tell: ['Removes ', { role: 'path', which: 'all' }, ' from this computer, as long as nothing is inside.'],
      docs: 'man 1 rmdir',
    }),
    operands: ['path'],
    flags: [
      {
        flags: ['-p', '--parents'],
        facts: { says: 'Removes a folder that has nothing inside it, then each folder above it that is left empty.' },
      },
    ],
  },
  // The list of edits is a small program of its own: it can save to files, and on some systems run other commands.
  sed: {
    facts: opaqueFact(
      'Changes text as it passes through, following a list of edits it was given.',
      'the list of edits it was given, which can also save to files and on some systems run other commands',
      { ...LOCAL, effect: ['read'], docs: 'man 1 sed' },
    ),
    operands: ['text', 'path'],
    flags: [
      { flags: ['-e', '--expression'], takesValue: true, role: 'text', operands: ['path'], facts: {} },
      { flags: ['-f', '--file'], takesValue: true, role: 'path', operands: ['path'], facts: {} },
      {
        // GNU sed takes a backup ending only attached (`-i.bak`); BSD sed also takes one as the next word, often empty
        // (`-i ''`). Reading it as attached reports the change in place either way, and leaves a BSD ending as an operand.
        flags: ['-i', '-I', '--in-place'],
        attached: true,
        role: 'text',
        facts: {
          effect: ['write'],
          reversible: 'no',
          says: 'Changes the text inside files, following a list of edits, and saves them in place.',
        },
      },
    ],
  },
  awk: {
    facts: opaqueFact(
      'Reads text line by line and does with each line what a small program written into the command says.',
      'the small program it was given, which can change files and run other commands',
      { ...LOCAL, effect: ['read', 'execute'], docs: 'man 1 awk' },
    ),
    operands: ['text', 'path'],
    values: { '-F': 'text', '-v': 'text' },
    flags: [{ flags: ['-f'], takesValue: true, role: 'path', operands: ['path'], facts: {} }],
  },
  sort: {
    facts: fact('Puts lines of text in order.', {
      ...LOOKS,
      tell: ['Puts the lines of ', { role: 'path', which: 'all', from: 'operands' }, ' in order.'],
      docs: 'man 1 sort',
    }),
    operands: ['path'],
    values: {
      ...valuesOf('path', ['-T', '--temporary-directory', '--random-source', '--files0-from']),
      ...valuesOf('text', ['-k', '--key', '-t', '--field-separator', '-S', '--buffer-size', '--batch-size', '--sort']),
    },
    flags: [
      {
        flags: ['--compress-program'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['execute'], opaque: true, handsOverTo: 'the program named to squeeze the files it sets aside while sorting' },
      },
      {
        flags: ['-o', '--output'],
        takesValue: true,
        role: 'path',
        facts: {
          effect: ['create', 'write'],
          reversible: 'no',
          says: 'Puts lines of text in order and saves them into a file, replacing what that file held.',
          tell: ['Puts the lines of ', { role: 'path', which: 'all', from: 'operands' }, ' in order and saves them into ', { role: 'path', from: '-o' }, '.'],
        },
      },
    ],
  },
  cut: {
    facts: fact('Shows only some columns or letters from each line of text.', { ...LOOKS, docs: 'man 1 cut' }),
    operands: ['path'],
    values: valuesOf('text', ['-b', '-c', '-d', '-f', '--bytes', '--characters', '--delimiter', '--fields']),
  },
  tr: {
    facts: fact('Swaps or removes letters in text as it passes through.', { ...LOOKS, docs: 'man 1 tr' }),
    operands: ['text'],
  },
  diff: {
    facts: fact('Shows the differences between two files.', {
      ...LOOKS,
      tell: ['Shows how ', { role: 'path', which: 0, from: 'operands' }, ' and ', { role: 'path', which: 1, from: 'operands' }, ' differ.'],
      docs: 'man 1 diff',
    }),
    operands: ['path'],
    values: {
      ...valuesOf('pattern', ['-x', '--exclude', '-I', '--ignore-matching-lines']),
      ...valuesOf('path', ['-X', '--exclude-from', '--from-file', '--to-file']),
      ...valuesOf('text', [
        '-U', '-C', '-L', '--label', '-F', '--show-function-line', '-W', '--width', '-D', '--ifdef', '-S', '--starting-file',
        '--horizon-lines', '--old-group-format', '--new-group-format', '--unchanged-group-format', '--changed-group-format',
        '--line-format', '--old-line-format', '--new-line-format', '--unchanged-line-format',
      ]),
    },
  },
  // Both can start another command from inside while they are open, which the line does not show.
  less: {
    facts: opaqueFact(
      'Shows what is written inside a file, a screenful at a time.',
      'whatever is typed into it while it is open, since it can start other commands',
      { ...LOCAL, effect: ['read'], tell: ['Shows what is written inside ', { role: 'path', from: 'operands' }, ', a screenful at a time.'], docs: 'man 1 less' },
    ),
    operands: ['path'],
    values: {
      '-p': 'pattern',
      '--pattern': 'pattern',
      ...valuesOf('path', ['-k', '--lesskey-file', '-T', '--tag-file']),
      ...valuesOf('text', [
        '-b', '--buffers', '-D', '--color', '-h', '--max-back-scroll', '-j', '--jump-target', '-P', '--prompt', '-t', '--tag',
        '-x', '--tabs', '-y', '--max-forw-scroll', '-z', '--window', '--wheel-lines',
      ]),
    },
    flags: [
      {
        flags: ['-o', '--log-file', '-O', '--LOG-FILE'],
        takesValue: true,
        role: 'path',
        facts: {
          effect: ['create', 'write'],
          reversible: 'no',
          says: 'Shows what is written inside a file, a screenful at a time, and saves a copy into another file.',
          tell: ['Shows what is written inside ', { role: 'path', from: 'operands' }, ' and saves a copy into ', { role: 'path', from: '-o' }, '.'],
        },
      },
    ],
  },
  more: {
    facts: opaqueFact(
      'Shows what is written inside a file, a screenful at a time.',
      'whatever is typed into it while it is open, since it can start other commands',
      { ...LOCAL, effect: ['read'], tell: ['Shows what is written inside ', { role: 'path' }, ', a screenful at a time.'], docs: 'man 1 more' },
    ),
    operands: ['path'],
    values: { '-n': 'text', '--lines': 'text' },
  },
  file: {
    facts: fact('Shows what kind of contents something on this computer holds, such as a picture or plain text.', {
      ...LOOKS,
      tell: ['Shows what kind of contents are in ', { role: 'path', which: 'all', from: 'operands' }, '.'],
      docs: 'man 1 file',
    }),
    operands: ['path'],
    values: { ...valuesOf('path', ['-m', '-M', '-f']), ...valuesOf('text', ['-e', '--exclude', '-F', '--separator', '-P', '--parameter']) },
  },
  stat: {
    facts: fact('Shows the details of a file, such as its size, its owner and when it last changed.', {
      ...LOOKS,
      tell: ['Shows the size, owner and dates of ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 stat',
    }),
    operands: ['path'],
    values: valuesOf('text', ['-f', '-t', '-c', '--format', '--printf']),
  },
  realpath: {
    facts: fact('Shows the full location of a file on this computer.', { ...LOOKS, docs: 'man 1 realpath' }),
    operands: ['path'],
  },
  readlink: {
    facts: fact('Shows where a second name for a file leads.', { ...LOOKS, docs: 'man 1 readlink' }),
    operands: ['path'],
  },
  basename: {
    facts: fact('Shows the last part of a file location, without the folders before it.', { ...LOOKS, docs: 'man 1 basename' }),
    operands: ['text'],
    values: { '-s': 'text', '--suffix': 'text' },
  },
  dirname: {
    facts: fact('Shows the folders part of a file location, without the file name at the end.', { ...LOOKS, docs: 'man 1 dirname' }),
    operands: ['text'],
  },
  base64: {
    facts: fact('Turns data into plain letters and numbers that can be sent as text, or turns it back.', {
      ...LOOKS,
      docs: 'man 1 base64',
    }),
    operands: ['path'],
    values: { '-i': 'path', '--input': 'path', '-b': 'text', '--break': 'text', '-w': 'text', '--wrap': 'text' },
    flags: [
      {
        flags: ['-o', '--output'],
        takesValue: true,
        role: 'path',
        facts: { effect: ['create', 'write'], reversible: 'no', note: 'What the named file held before is replaced.' },
      },
    ],
  },
  shasum: { ...FINGERPRINT('man 1 shasum'), values: { '-a': 'text', '--algorithm': 'text' } },
  md5: FINGERPRINT('man 1 md5'),
  md5sum: FINGERPRINT('man 1 md5sum'),
  sha256sum: FINGERPRINT('man 1 sha256sum'),
  sha1sum: FINGERPRINT('man 1 sha1sum'),
  zip: {
    facts: fact('Packs files together into one smaller file that can be unpacked later.', {
      ...LOCAL, repeatSafe: true,
      effect: ['read', 'create', 'write'],
      reversible: 'unknown',
      tell: ['Packs files into ', { role: 'path', from: 'operands' }, '.'],
      note: 'A packed file already in that place has the new files added to it, replacing any with the same name.',
      docs: 'man 1 zip',
    }),
    operands: ['path'],
    values: { '-b': 'path', '-O': 'path', '--output-file': 'path', '-n': 'text', '--suffixes': 'text', '-s': 'text', '--split-size': 'text' },
    flags: [
      {
        flags: ['-d', '--delete'],
        facts: {
          effect: ['delete'],
          reversible: 'no',
          says: 'Removes files from inside a packed file.',
          tell: ['Removes files from inside ', { role: 'path', from: 'operands' }, '.'],
        },
      },
      {
        flags: ['-m', '--move'],
        facts: {
          effect: ['delete'],
          reversible: 'no',
          says: 'Packs files together into one smaller file and removes the originals.',
          tell: ['Packs files into ', { role: 'path', from: 'operands' }, ' and removes the originals.'],
        },
      },
      { flags: ['-P', '--password'], takesValue: true, role: 'text', facts: { touchesCredentials: true } },
      {
        flags: ['-TT', '--unzip-command'],
        takesValue: true,
        role: 'text',
        facts: { effect: ['execute'], opaque: true, handsOverTo: 'the program named to test the finished packed file' },
      },
    ],
  },
  gzip: {
    facts: fact('Squeezes a file so it takes less room, and puts the squeezed copy in its place.', {
      ...LOCAL, repeatSafe: true,
      effect: ['read', 'create', 'delete'],
      reversible: 'unknown',
      tell: ['Squeezes ', { role: 'path', which: 'all' }, ' so it takes less room, and puts the squeezed copy in its place.'],
      docs: 'man 1 gzip',
    }),
    operands: ['path'],
    values: { '-S': 'text', '--suffix': 'text' },
    flags: [
      {
        flags: ['-d', '--decompress', '--uncompress'],
        facts: { says: 'Unpacks a squeezed file and puts the full-size copy in its place.' },
      },
      { flags: ['-f', '--force'], facts: { reversible: 'no', note: 'A file already in that place with the same name is replaced.' } },
    ],
  },
  gunzip: {
    facts: fact('Unpacks a squeezed file and puts the full-size copy in its place.', {
      ...LOCAL, repeatSafe: true,
      effect: ['read', 'create', 'delete'],
      reversible: 'unknown',
      tell: ['Unpacks ', { role: 'path', which: 'all' }, ' and puts the full-size copy in its place.'],
      docs: 'man 1 gunzip',
    }),
    operands: ['path'],
    values: { '-S': 'text', '--suffix': 'text' },
    flags: [{ flags: ['-f', '--force'], facts: { reversible: 'no', note: 'A file already in that place with the same name is replaced.' } }],
  },
  ditto: {
    facts: fact('Copies files and folders to another place, keeping their details as they were.', {
      ...LOCAL, repeatSafe: true,
      effect: ['read', 'create', 'write'],
      reversible: 'no',
      tell: [
        'Copies ',
        { role: 'path', which: 'all-but-last', from: 'operands' },
        ' to ',
        { role: 'path', which: 'last', from: 'operands' },
        ', keeping their details as they were.',
      ],
      note: REPLACED,
      docs: 'man 1 ditto',
    }),
    operands: ['path'],
    values: { '--arch': 'text', '--bom': 'path', '--zlibCompressionLevel': 'text' },
  },
  xattr: {
    facts: fact('Shows the hidden labels macOS keeps on a file, such as where it was downloaded from.', {
      ...LOOKS,
      tell: ['Shows the hidden labels macOS keeps on ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 xattr',
    }),
    operands: ['path'],
    values: { '-p': 'text' },
    flags: [
      { flags: ['-d'], takesValue: true, role: 'text', facts: XATTR_REMOVES },
      { flags: ['-c'], facts: XATTR_REMOVES },
      {
        // `-w name value file`: the value written is the first operand, and the files come after it.
        flags: ['-w'],
        takesValue: true,
        role: 'text',
        operands: ['text', 'path'],
        facts: { effect: ['configure', 'write'], reversible: 'unknown', says: 'Puts a hidden label on a file, or changes one already there.' },
      },
      { flags: ['-r'], facts: { says: 'Works on the hidden labels of everything kept inside a folder.' } },
    ],
  },
  chflags: {
    facts: fact('Changes special settings on a file, such as whether it can be changed or is hidden.', {
      ...LOCAL, repeatSafe: true,
      effect: ['configure'],
      reversible: 'unknown',
      tell: ['Changes special settings on ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 chflags',
    }),
    operands: ['text', 'path'],
    flags: [
      {
        flags: ['-R'],
        facts: {
          says: 'Changes special settings on everything kept inside a folder.',
          tell: ['Changes special settings on everything kept inside ', { role: 'path', which: 'all' }, '.'],
        },
      },
    ],
  },
}
