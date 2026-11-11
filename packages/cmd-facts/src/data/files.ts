import { fact, opaqueFact, valuesOf, LOCAL, LOOKS } from '../entry.ts'
import type { Entry, FlagRule } from '../entry.ts'
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

const LOG: FlagRule = {
  flags: ['-o', '--log-file', '-O', '--LOG-FILE'],
  takesValue: true,
  role: 'path',
  facts: {
    effect: ['create', 'write'],
    reversible: 'no',
    says: 'Shows what is written inside a file, a screenful at a time, and saves a copy into another file.',
    tell: ['Shows what is written inside ', { role: 'path', from: 'operands' }, ' and saves a copy into ', { role: 'path', from: '-o' }, '.'],
  },
}

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
    // Every option only changes how the list is shown. `-D`, `-I`, `-T` and `-w` are left out: each takes a value on
    // one of macOS and Linux and nothing on the other.
    plain: [
      '-@', '-1', '-A', '-a', '-B', '-b', '-C', '-c', '-d', '-e', '-F', '-f', '-G', '-g', '-H', '-h', '-i', '-k', '-L', '-l',
      '-m', '-n', '-O', '-o', '-P', '-p', '-q', '-R', '-r', '-S', '-s', '-t', '-U', '-u', '-v', '-W', '-X', '-x', '-%', '-,',
      '--all', '--almost-all', '--classify', '--color', '--dereference', '--directory', '--full-time', '--group-directories-first',
      '--human-readable', '--inode', '--recursive', '--reverse', '--si', '--size',
    ],
    values: valuesOf('text', ['--sort', '--time', '--time-style', '--format', '--block-size', '--indicator-style', '--quoting-style']),
  },
  cat: {
    facts: fact('Shows everything written inside a file.', {
      ...LOOKS,
      tell: ['Shows everything written inside ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 cat',
    }),
    operands: ['path'],
    plain: [
      '-A', '-b', '-E', '-e', '-l', '-n', '-s', '-T', '-t', '-u', '-v',
      '--number', '--number-nonblank', '--show-all', '--show-ends', '--show-nonprinting', '--show-tabs', '--squeeze-blank',
    ],
  },
  head: {
    facts: fact('Shows the first few lines of a file.', {
      ...LOOKS,
      tell: ['Shows the first few lines of ', { role: 'path' }, '.'],
      docs: 'man 1 head',
    }),
    operands: ['path'],
    plain: ['-q', '--quiet', '--silent', '-v', '--verbose'],
    values: valuesOf('text', ['-n', '--lines', '-c', '--bytes']),
  },
  tail: {
    facts: fact('Shows the last few lines of a file.', {
      ...LOOKS,
      tell: ['Shows the last few lines of ', { role: 'path' }, '.'],
      docs: 'man 1 tail',
    }),
    operands: ['path'],
    // `-s` is left out: it takes the time to wait on Linux, and macOS has no such option.
    plain: ['-r', '-q', '--quiet', '--silent', '-v', '--verbose'],
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
    plain: ['-c', '--bytes', '-L', '--max-line-length', '-l', '--lines', '-m', '--chars', '-w', '--words'],
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
    // `--color` takes a value only after `=`, so it is a switch to the line. `-X` is left out: it chooses a matcher by
    // name on Linux, and takes nothing on macOS, where it reads packed files.
    plain: [
      '-a', '--text', '-b', '--byte-offset', '-c', '--count', '--color', '--colour', '-E', '--extended-regexp', '-F',
      '--fixed-strings', '-G', '--basic-regexp', '-H', '--with-filename', '-h', '--no-filename', '-I', '-i', '-y',
      '--ignore-case', '--no-ignore-case', '-J', '--bz2decompress', '-L', '--files-without-match', '-l',
      '--files-with-matches', '--line-buffered', '-M', '--lzma', '-n', '--line-number', '--null', '-o', '--only-matching',
      '-P', '--perl-regexp', '-q', '--quiet', '--silent', '-s', '--no-messages', '-T', '--initial-tab', '-U', '--binary',
      '-u', '-V', '--version', '--help', '-v', '--invert-match', '-w', '--word-regexp', '-x', '--line-regexp', '-Z',
      '-z', '--null-data', '--no-group-separator',
    ],
    values: {
      ...valuesOf('pattern', ['--include', '--exclude', '--exclude-dir', '--include-dir']),
      '--exclude-from': 'path',
      '--group-separator': 'text',
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
        flags: ['-r', '-R', '--recursive', '--dereference-recursive'],
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
    // The tests and the ways to join them only choose which files are found. `-depth` is left out: macOS also takes a
    // depth after it, as an optional value, and Linux takes nothing.
    plain: [
      '-E', '-H', '-L', '-P', '-X', '-d', '-s', '-x',
      '-a', '-and', '-o', '-or', '-not', '-true', '-false', '-print', '-print0', '-ls', '-prune', '-quit', '-empty',
      '-nouser', '-nogroup', '-xdev', '-mount', '-follow', '-noleaf', '-daystart', '-readable', '-writable', '-executable',
      '-sparse', '-xattr', '-acl', '-ignore_readdir_race', '-noignore_readdir_race', '-warn', '-nowarn',
    ],
    values: {
      '-f': 'path',
      ...valuesOf('path', ['-newer', '-anewer', '-cnewer', '-mnewer', '-Bnewer', '-samefile']),
      '-user': 'user',
      ...valuesOf('pattern', [
        '-name', '-iname', '-path', '-ipath', '-regex', '-iregex', '-wholename', '-iwholename', '-lname', '-ilname',
      ]),
      ...valuesOf('text', [
        '-type', '-xtype', '-size', '-perm', '-mtime', '-atime', '-ctime', '-Btime', '-mmin', '-amin', '-cmin', '-Bmin',
        '-maxdepth', '-mindepth', '-group', '-gid', '-uid', '-links', '-inum', '-fstype', '-used', '-regextype', '-flags',
        '-xattrname', '-printf',
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
        flags: ['-exec', '-execdir', '-ok', '-okdir'],
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
  // `-T` and `-t` are left out: each takes a kind of disk on one of macOS and Linux and nothing on the other.
  df: {
    facts: fact('Shows how much room is left on each disk.', { ...LOOKS, docs: 'man 1 df' }),
    operands: ['path'],
    plain: [
      '-a', '--all', '-b', '-c', '-g', '-H', '--si', '-h', '--human-readable', '-I', '-i', '--inodes', '-k', '-l', '--local',
      '-m', '-n', '-P', '--portability', '-Y', '--total',
    ],
  },
  du: {
    facts: fact('Shows how much room files and folders take up.', { ...LOOKS, docs: 'man 1 du' }),
    operands: ['path'],
    plain: [
      '-A', '--apparent-size', '-a', '--all', '-c', '--total', '-g', '-H', '-h', '--human-readable', '-k', '-L',
      '--dereference', '-l', '--count-links', '-m', '-n', '-P', '--no-dereference', '-r', '-s', '--summarize', '--si', '-x',
      '--one-file-system',
    ],
    values: { ...valuesOf('text', ['-d', '--max-depth', '-B', '--block-size', '-t', '--threshold']), '-I': 'pattern', '--exclude': 'pattern' },
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
    // `-S` is left out: it takes a backup ending on Linux, and takes nothing on macOS. `-t` names the destination
    // ahead of the sources, which the sentence cannot follow, so it is left out too.
    plain: [
      '-c', '-f', '--force', '-H', '-i', '--interactive', '-L', '--dereference', '-l', '--link', '-N', '-n', '--no-clobber',
      '-P', '--no-dereference', '-p', '--preserve', '-s', '--symbolic-link', '-v', '--verbose', '-X', '-x', '--one-file-system',
    ],
    flags: [
      {
        flags: ['-r', '-R', '--recursive', '-a', '--archive'],
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
    plain: ['-f', '--force', '-h', '-i', '--interactive', '-n', '--no-clobber', '-v', '--verbose'],
  },
  mkdir: {
    facts: fact('Makes a new, empty folder.', {
      ...LOCAL, reversible: 'yes', repeatSafe: true,
      effect: ['create'],
      tell: ['Makes a new, empty folder at ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 mkdir',
    }),
    operands: ['path'],
    plain: ['-p', '--parents', '-v', '--verbose'],
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
    plain: ['-f', '--silent', '--quiet', '-H', '-h', '-L', '-P', '-v', '--verbose'],
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
    plain: [
      '-z', '--gzip', '--gunzip', '-j', '--bzip2', '-J', '--xz', '-v', '--verbose', '-t', '--list',
      '--acls', '--no-acls', '--xattrs', '--no-xattrs', '--selinux', '--no-selinux', '--numeric-owner', '-S', '--sparse',
      '-G', '--incremental', '--null', '--no-null', '--recursion', '--no-recursion', '--unquote', '--no-unquote',
      '--verbatim-files-from', '--no-verbatim-files-from', '-R', '--block-number', '--show-transformed-names',
      '--show-stored-names', '--totals', '-w', '--interactive', '--confirmation', '--ignore-command-error',
      '--no-ignore-command-error',
    ],
    operands: ['path'],
    bareFlagsFirst: true,
    values: {
      ...valuesOf('path', [
        '-C', '--directory', '-T', '--files-from', '-X', '--exclude-from', '-g', '--listed-incremental', '--index-file',
      ]),
      '--exclude': 'pattern',
      ...valuesOf('text', [
        '--newer-mtime', '--suffix', '--quoting-style', '--quote-chars', '--no-quote-chars', '--sparse-version',
        '--xattrs-include', '--xattrs-exclude', '--hole-detection',
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
    // `-l`, `-c`, `-t`, `-v` and `-Z` are left out: each only shows what the zip file holds and unpacks nothing, which
    // the row cannot narrow to.
    plain: ['-a', '-f', '-j', '-n', '-o', '-q', '-qq', '-u'],
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
  which: { facts: fact('Shows where a program is kept on this computer.', { ...LOOKS, docs: 'man 1 which' }), operands: ['text'], plain: ['-a', '-s'] },
  touch: {
    facts: fact('Marks a file as changed at this moment, and makes an empty file where none is there yet.', {
      ...LOCAL, repeatSafe: true,
      effect: ['create', 'write'],
      reversible: 'unknown',
      tell: ['Marks ', { role: 'path', which: 'all', from: 'operands' }, ' as changed at this moment, making an empty file where none is there yet.'],
      docs: 'man 1 touch',
    }),
    operands: ['path'],
    plain: ['-a', '-c', '--no-create', '-f', '-h', '--no-dereference', '-m'],
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
    values: { '-S': 'text', '--suffix': 'text' },
    flags: [
      {
        flags: ['-f', '--force'],
        facts: { effect: ['delete'], reversible: 'no', note: 'A file already at the new name is replaced, and is not kept.' },
      },
      {
        // On macOS this also removes a folder in the way; on Linux it asks to join folders, which reaches no further.
        flags: ['-F'],
        facts: { effect: ['delete'], reversible: 'no', note: 'A file or folder already at the new name is removed, and is not kept.' },
      },
      {
        // Linux only: the folder the new names go into comes first, and every operand is something they lead to.
        flags: ['-t', '--target-directory'],
        takesValue: true,
        role: 'path',
        facts: {
          says: 'Puts a second name for a file or folder inside another folder.',
          tell: ['Puts a second name for ', { role: 'path', which: 'all', from: 'operands' }, ' inside ', { role: 'path', from: '-t' }, '.'],
        },
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
    // `-l` is left out: it takes a line length on Linux, and takes nothing on macOS.
    plain: [
      '-a', '--debug', '-E', '-r', '--regexp-extended', '--follow-symlinks', '-H', '-n', '--quiet', '--silent', '--posix',
      '-s', '--separate', '--sandbox', '-u', '--unbuffered', '-z', '--null-data',
    ],
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
    plain: [
      '-b', '--ignore-leading-blanks', '-C', '-c', '--check', '-d', '--dictionary-order', '-f', '--ignore-case', '-g',
      '--general-numeric-sort', '-h', '--human-numeric-sort', '-i', '--ignore-nonprinting', '-M', '--month-sort', '-m',
      '--merge', '-n', '--numeric-sort', '-R', '--random-sort', '-r', '--reverse', '-s', '--stable', '-u', '--unique', '-V',
      '--version-sort', '-z', '--zero-terminated', '--debug', '--radixsort', '--mergesort', '--qsort', '--heapsort', '--mmap',
    ],
    values: {
      ...valuesOf('path', ['-T', '--temporary-directory', '--random-source', '--files0-from']),
      ...valuesOf('text', ['-k', '--key', '-t', '--field-separator', '-S', '--buffer-size', '--batch-size', '--sort', '--parallel']),
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
    values: valuesOf('text', ['-b', '-c', '-d', '-f', '--bytes', '--characters', '--delimiter', '--fields', '--output-delimiter']),
  },
  tr: {
    facts: fact('Swaps or removes letters in text as it passes through.', { ...LOOKS, docs: 'man 1 tr' }),
    operands: ['text'],
    plain: ['-C', '-c', '--complement', '-d', '--delete', '-s', '--squeeze-repeats', '-u'],
  },
  diff: {
    facts: fact('Shows the differences between two files.', {
      ...LOOKS,
      tell: ['Shows how ', { role: 'path', which: 0, from: 'operands' }, ' and ', { role: 'path', which: 1, from: 'operands' }, ' differ.'],
      docs: 'man 1 diff',
    }),
    operands: ['path'],
    // `-l` is left out: it passes what it shows through another program.
    plain: [
      '-a', '--text', '-B', '--ignore-blank-lines', '-b', '--ignore-space-change', '-c', '--context', '-d', '--minimal', '-E',
      '--ignore-tab-expansion', '-e', '--ed', '-i', '--ignore-case', '--ignore-file-name-case', '--no-ignore-file-name-case',
      '-N', '--new-file', '-n', '--rcs', '--normal', '-p', '--show-c-function', '-q', '--brief', '-r', '--recursive', '-s',
      '--report-identical-files', '--speed-large-files', '--strip-trailing-cr', '-T', '--initial-tab', '-t', '--expand-tabs',
      '-u', '--unified', '--unidirectional-new-file', '-w', '--ignore-all-space', '-y', '--side-by-side', '--left-column',
      '--suppress-common-lines', '-v', '--version', '--help',
    ],
    values: {
      ...valuesOf('pattern', ['-x', '--exclude', '-I', '--ignore-matching-lines']),
      ...valuesOf('path', ['-X', '--exclude-from', '--from-file', '--to-file']),
      ...valuesOf('text', [
        '-U', '-C', '-L', '--label', '-F', '--show-function-line', '-W', '--width', '-D', '--ifdef', '-S', '--starting-file',
        '-A', '--algorithm', '--tabsize',
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
    plain: [
      '-?', '--help', '-a', '--search-skip-screen', '-A', '--SEARCH-SKIP-SCREEN', '-B', '--auto-buffers', '-c',
      '--clear-screen', '-C', '--CLEAR-SCREEN', '-d', '--dumb', '-e', '--quit-at-eof', '-E', '--QUIT-AT-EOF', '-f', '--force',
      '-F', '--quit-if-one-screen', '-g', '--hilite-search', '-G', '--HILITE-SEARCH', '-i', '--ignore-case', '-I',
      '--IGNORE-CASE', '-J', '--status-column', '-K', '--quit-on-intr', '-L', '--no-lessopen', '-m', '--long-prompt', '-M',
      '--LONG-PROMPT', '-n', '--line-numbers', '-N', '--LINE-NUMBERS', '-q', '--quiet', '--silent', '-Q', '--QUIET',
      '--SILENT', '-r', '--raw-control-chars', '-R', '--RAW-CONTROL-CHARS', '-s', '--squeeze-blank-lines', '-S',
      '--chop-long-lines', '-u', '--underline-special', '-U', '--UNDERLINE-SPECIAL', '-V', '--version', '-w',
      '--hilite-unread', '-W', '--HILITE-UNREAD', '-X', '--no-init', '-~', '--tilde', '--follow-name', '--incsearch',
      '--mouse', '--MOUSE', '--no-keypad', '--no-histdups', '--save-marks', '--use-backslash', '--use-color',
    ],
    values: {
      '-p': 'pattern',
      '--pattern': 'pattern',
      ...valuesOf('path', ['-k', '--lesskey-file', '-T', '--tag-file']),
      ...valuesOf('text', [
        '-b', '--buffers', '-D', '--color', '-h', '--max-back-scroll', '-j', '--jump-target', '-P', '--prompt', '-t', '--tag',
        '-x', '--tabs', '-y', '--max-forw-scroll', '-z', '--window', '--wheel-lines', '-#', '--shift',
      ]),
    },
    flags: [LOG],
  },
  more: {
    facts: opaqueFact(
      'Shows what is written inside a file, a screenful at a time.',
      'whatever is typed into it while it is open, since it can start other commands',
      { ...LOCAL, effect: ['read'], tell: ['Shows what is written inside ', { role: 'path', from: 'operands' }, ', a screenful at a time.'], docs: 'man 1 more' },
    ),
    operands: ['path'],
    values: { '-n': 'text', '--lines': 'text' },
    // On macOS this is the same program as less, and takes the same log file.
    flags: [LOG],
  },
  file: {
    facts: fact('Shows what kind of contents something on this computer holds, such as a picture or plain text.', {
      ...LOOKS,
      tell: ['Shows what kind of contents are in ', { role: 'path', which: 'all', from: 'operands' }, '.'],
      docs: 'man 1 file',
    }),
    operands: ['path'],
    // `-p` is left out: it puts back the time each file was last opened, which is a change of its own.
    plain: [
      '--apple', '-b', '--brief', '-c', '--checking-printout', '-D', '-d', '-E', '--exclude-quiet', '--extension', '-h',
      '--no-dereference', '-I', '-i', '--mime', '--mime-type', '--mime-encoding', '-k', '--keep-going', '-L',
      '--dereference', '-l', '--list', '-N', '--no-pad', '-n', '--no-buffer', '-r', '--raw', '-s', '--special-files', '-v',
      '--version', '-Z', '--uncompress-noreport', '-z', '--uncompress', '-0', '--print0', '--help',
    ],
    values: { ...valuesOf('path', ['-m', '-M', '-f']), ...valuesOf('text', ['-e', '--exclude', '-F', '--separator', '-P', '--parameter']) },
    flags: [
      {
        flags: ['-C', '--compile'],
        facts: {
          effect: ['create', 'write'],
          reversible: 'no',
          says: 'Turns its list of known kinds of contents into a ready-to-use copy, saved in the current folder.',
          note: 'A copy already there with the same name is replaced.',
        },
      },
    ],
  },
  stat: {
    facts: fact('Shows the details of a file, such as its size, its owner and when it last changed.', {
      ...LOOKS,
      tell: ['Shows the size, owner and dates of ', { role: 'path', which: 'all' }, '.'],
      docs: 'man 1 stat',
    }),
    operands: ['path'],
    plain: ['-F', '-L', '--dereference', '-l', '-n', '-q', '-r', '-s', '-x'],
    // `-f` and `-t` are left out: on macOS each takes a format, on Linux each takes nothing and changes what is shown.
    values: valuesOf('text', ['-c', '--format', '--printf']),
  },
  realpath: {
    facts: fact('Shows the full location of a file on this computer.', { ...LOOKS, docs: 'man 1 realpath' }),
    operands: ['path'],
    values: { '--relative-to': 'path', '--relative-base': 'path' },
  },
  readlink: {
    facts: fact('Shows where a second name for a file leads.', { ...LOOKS, docs: 'man 1 readlink' }),
    operands: ['path'],
    plain: [
      '-e', '--canonicalize-existing', '-f', '--canonicalize', '-m', '--canonicalize-missing', '-n', '--no-newline', '-q',
      '--quiet', '-s', '--silent', '-v', '--verbose', '-z', '--zero',
    ],
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
    // `-i` is left out: it takes the file to read on macOS, and takes nothing on Linux, where it skips stray letters.
    values: { '--input': 'path', '-b': 'text', '--break': 'text', '-w': 'text', '--wrap': 'text' },
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
  md5: {
    ...FINGERPRINT('man 1 md5'),
    values: valuesOf('text', ['-c', '--check']),
    flags: [
      {
        flags: ['-s', '--string'],
        takesValue: true,
        role: 'text',
        facts: { says: 'Works out a short fingerprint of a piece of text, which comes out different if anything in it changes.' },
      },
    ],
  },
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
    // `-T` is left out: it runs another program to test the finished file.
    plain: [
      '-0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8', '-9', '-D', '--no-dir-entries', '-f', '--freshen', '-j',
      '--junk-paths', '-q', '--quiet', '-r', '--recurse-paths', '-u', '--update', '-v', '--verbose', '-X', '--no-extra', '-y',
      '--symlinks',
    ],
    values: {
      ...valuesOf('path', ['-b', '-O', '--output-file']),
      ...valuesOf('text', [
        '-n', '--suffixes', '-s', '--split-size', '-t', '--from-date', '-tt', '--before-date', '-Z', '--compression-method',
        '-ds', '--dot-size',
      ]),
    },
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
      { flags: ['-e', '--encrypt'], facts: { touchesCredentials: true } },
      { flags: ['-lf', '--logfile-path'], takesValue: true, role: 'path', facts: { reversible: 'no' } },
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
    plain: ['-l', '-s', '-v', '-x'],
    // `-p`, `-d` and `-w` choose what to do, and take nothing: the label's name is the first operand, so other
    // options can sit between them and it, as in `-dr name folder`.
    flags: [
      {
        flags: ['-p'],
        operands: ['text', 'path'],
        facts: {
          says: 'Shows what one of the hidden labels macOS keeps on a file holds.',
          tell: ['Shows what the hidden label ', { role: 'text', from: 'operands' }, ' holds on ', { role: 'path', which: 'all' }, '.'],
        },
      },
      { flags: ['-d'], operands: ['text', 'path'], facts: XATTR_REMOVES },
      { flags: ['-c'], facts: XATTR_REMOVES },
      {
        flags: ['-w'],
        operands: ['text', 'text', 'path'],
        facts: {
          effect: ['configure', 'write'],
          reversible: 'unknown',
          says: 'Puts a hidden label on a file, or changes one already there.',
          tell: ['Puts a hidden label on ', { role: 'path', which: 'all' }, ', or changes one already there.'],
        },
      },
      // A note rather than a sentence, so the sentence still says what is done to the labels.
      { flags: ['-r'], facts: { note: 'Given a folder, it does the same to every file kept inside it.' } },
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
