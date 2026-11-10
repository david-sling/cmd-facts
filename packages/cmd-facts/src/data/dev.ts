import { fact, opaqueFact, valuesOf, LOCAL, LOOKS } from '../entry.ts'
import type { Entry, FlagRule, Role, Rule } from '../entry.ts'
import type { Effect } from '../facts.ts'
import { globalsOf } from './shared.ts'

const GIT = 'man 1 git'
const SETUP_STEPS = 'the set-up steps the downloaded packages bring with them'

const FETCH_VALUES = valuesOf('text', [
  '--depth', '--deepen', '--shallow-since', '--shallow-exclude', '--negotiation-tip', '--refmap', '-j', '--jobs',
  '--submodule-prefix', '-o', '--server-option',
])

// `-f` and `-p` change only this computer's copy of the server's lines of work, which collecting rewrites anyway. `-P` is
// left out: it removes tags made here. So is `--recurse-submodules`: the projects it also collects can be on any server.
const FETCH_PLAIN = [
  '-v', '--verbose', '-q', '--quiet', '--progress', '--all', '-a', '--append', '--atomic', '-f', '--force',
  '-t', '--tags', '--no-tags', '-p', '--prune', '--dry-run', '-k', '--keep', '--unshallow',
  '--update-shallow', '--show-forced-updates', '--no-show-forced-updates', '-4', '--ipv4', '-6', '--ipv6',
  '--no-recurse-submodules',
]

// Writes which server branch this one follows into the project's settings.
const SET_UPSTREAM = (flags: string[]): FlagRule => ({ flags, facts: { effect: ['configure'] } })

const FORCED = {
  effect: ['delete'] as Effect[],
  note: 'Save points already on the server that the ones sent do not build on are thrown away there.',
}

// The program that serves the other end of a transfer. Where the other end is a folder on this computer, it runs here.
const TRANSFER_PROGRAM = (flags: string[]): FlagRule => ({
  flags,
  takesValue: true,
  role: 'text',
  facts: { effect: ['execute'], opaque: true, handsOverTo: 'the program named to serve the other end, which can run on this computer' },
})

export const GIT_ENTRY: Entry = {
  // A word git has no command of its own for can still be an alias the settings define, or a `git-<word>` program
  // installed beside it, so a subcommand this table does not hold can run anything.
  facts: opaqueFact(
    'Works with the saved history of a project kept on this computer.',
    'the aliases and add-on commands set up for it, which can run any program',
    {
      privilege: 'none',
      touchesCredentials: false,
      effect: ['read', 'write', 'create', 'delete', 'configure', 'transmit', 'execute'],
      network: 'arbitrary',
      reversible: 'no',
      docs: GIT,
    },
  ),
  globals: [
    { flags: ['-C'], takesValue: true, role: 'path', facts: {} },
    {
      flags: ['-c', '--config-env'],
      takesValue: true,
      role: 'text',
      facts: {
        effect: ['execute'],
        opaque: true,
        handsOverTo: 'the programs the changed settings tell it to run',
      },
    },
    { flags: ['--git-dir', '--work-tree'], takesValue: true, role: 'path', facts: {} },
    { flags: ['--namespace'], takesValue: true, role: 'text', facts: {} },
    {
      flags: ['--exec-path'],
      facts: {
        effect: ['execute'],
        opaque: true,
        handsOverTo: 'the helper programs found in the named folder',
      },
    },
    {
      flags: ['-p', '--paginate'],
      facts: { effect: ['execute'], opaque: true, handsOverTo: 'the pager the settings name' },
    },
    {
      flags: [
        '-P', '--no-pager', '--bare', '--no-optional-locks', '--literal-pathspecs', '--no-replace-objects', '--version',
        '--html-path', '--man-path', '--info-path',
      ],
      facts: {},
    },
  ],
  sub: {
    status: {
      facts: fact('Shows which files in a project have changed since its last save point.', { ...LOOKS, docs: GIT }),
      operands: ['path'],
      // Each optional value is taken only after `=`.
      plain: [
        '-s', '--short', '-b', '--branch', '-v', '--verbose', '--show-stash', '--porcelain', '--long', '--ahead-behind',
        '--no-ahead-behind', '-z', '--null', '-u', '--untracked-files', '--ignored', '--ignore-submodules', '--column',
        '--no-column', '--renames', '--no-renames', '-M', '--find-renames',
      ],
    },
    log: {
      facts: fact('Shows the list of save points a project has, newest first.', { ...LOOKS, docs: GIT }),
      operands: ['text'],
      // `--show-signature` is left out: it runs the signing program the settings name. `-<n>` limits how many are shown:
      // `-5`, and `-10` read a digit at a time.
      plain: [
        '--oneline', '--graph', '--all', '--decorate', '--no-decorate', '--abbrev-commit', '--pretty', '--reverse', '--follow',
        '-q', '--quiet', '--source', '-p', '-u', '--patch', '-s', '--no-patch', '--stat', '--shortstat',
        '--numstat', '--name-only', '--name-status', '--merges', '--no-merges', '--first-parent', '--no-color', '--color',
        '-0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8', '-9',
      ],
      values: {
        '--grep': 'pattern',
        ...valuesOf('text', ['--author', '-n', '--max-count', '--since', '--after', '--until', '--before', '--date']),
      },
      // The layout is taken only after `=`: `--format %h` reads `%h` as a save point.
      flags: [{ flags: ['--format'], attached: true, role: 'text', facts: {} }],
    },
    diff: {
      facts: fact('Shows exactly what changed in the files of a project since its last save point.', { ...LOOKS, docs: GIT }),
      operands: ['text'],
      plain: [
        '--staged', '--cached', '--stat', '--numstat', '--shortstat', '--name-only', '--name-status', '--summary', '-w',
        '--ignore-all-space', '-b', '--ignore-space-change', '--word-diff', '--color-words', '--color', '--no-color', '-R',
        '--check', '--exit-code', '--quiet', '--minimal', '--no-index',
      ],
    },
    show: {
      facts: fact('Shows what one save point in a project changed.', { ...LOOKS, docs: GIT }),
      operands: ['text'],
      plain: [
        '--oneline', '--stat', '--shortstat', '--numstat', '--name-only', '--name-status', '-s', '--no-patch', '-q', '--quiet',
        '--pretty', '--abbrev-commit', '--color', '--no-color',
      ],
      values: valuesOf('text', ['--date']),
      flags: [{ flags: ['--format'], attached: true, role: 'text', facts: {} }],
    },
    branch: {
      facts: fact('Lists or sets up the separate lines of work a project keeps.', { ...LOCAL, reversible: 'yes', repeatSafe: true, effect: ['read', 'write'], docs: GIT }),
      operands: ['text'],
      // `--merged`, `--track` and `--abbrev` are left out: each takes its value only after `=`, if at all. So are the
      // options that remove, rename or copy a line of work, which the row was not written to say.
      plain: [
        '-a', '--all', '-r', '--remotes', '-l', '--list', '-v', '--verbose', '-q', '--quiet', '--show-current', '--column',
        '--no-column', '-i', '--ignore-case', '--color', '--no-color', '--no-abbrev', '--create-reflog', '--omit-empty',
      ],
      values: valuesOf('text', ['--sort', '--format', '--points-at', '-u', '--set-upstream-to', '--contains', '--no-contains']),
    },
    clone: {
      facts: fact('Copies a project from a server onto this computer.', {
        reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true,
        effect: ['read', 'create'],
        network: 'known-host',
        docs: GIT,
      }),
      operands: ['url', 'path'],
      // `--recurse-submodules` is left out: the projects it also copies can be on any server.
      plain: [
        '-q', '--quiet', '-v', '--verbose', '--progress', '-n', '--no-checkout', '--checkout', '--bare', '--mirror', '-l',
        '--local', '--no-hardlinks', '--hardlinks', '-s', '--shared', '--dissociate', '--single-branch', '--no-single-branch',
        '--tags', '--no-tags', '--shallow-submodules', '--no-shallow-submodules', '--sparse', '-4', '--ipv4', '-6', '--ipv6',
      ],
      values: {
        ...valuesOf('text', [
          '-b', '--branch', '-o', '--origin', '--depth', '--shallow-since', '--shallow-exclude', '--filter', '--server-option',
          '-j', '--jobs', '--revision',
        ]),
        ...valuesOf('path', ['--reference', '--reference-if-able', '--separate-git-dir']),
      },
      flags: [
        TRANSFER_PROGRAM(['-u', '--upload-pack']),
        {
          // Settings written into the new copy are in force while it is first filled in, so one can name a program.
          flags: ['-c', '--config'],
          takesValue: true,
          role: 'text',
          facts: { effect: ['execute'], opaque: true, handsOverTo: 'the programs the given settings tell it to run' },
        },
        {
          flags: ['--template'],
          takesValue: true,
          role: 'path',
          facts: { effect: ['execute'], opaque: true, handsOverTo: 'the steps kept in the named folder, which run as the copy is set up' },
        },
      ],
    },
    fetch: {
      facts: fact('Collects the latest changes from the server without touching the files you see.', {
        reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true,
        effect: ['read', 'write'],
        network: 'known-host',
        docs: GIT,
      }),
      operands: ['text'],
      plain: FETCH_PLAIN,
      values: FETCH_VALUES,
      flags: [TRANSFER_PROGRAM(['--upload-pack']), SET_UPSTREAM(['--set-upstream'])],
    },
    pull: {
      facts: fact('Collects the latest changes from the server and puts them into the files you see.', {
        privilege: 'none', touchesCredentials: false, repeatSafe: true,
        effect: ['read', 'write'],
        network: 'known-host',
        reversible: 'unknown',
        note: 'Changes made here that were never saved to a save point can be lost.',
        docs: GIT,
      }),
      operands: ['text'],
      // `-e` and `--edit` are left out: they open an editor. So are `-S` and `--gpg-sign`, which sign with a key, and
      // `--verify-signatures`, which runs the signing program the settings name.
      plain: [
        ...FETCH_PLAIN, '-r', '--rebase', '--no-rebase', '--ff', '--no-ff', '--ff-only', '--commit', '--no-commit', '--no-edit',
        '-n', '--stat', '--no-stat', '--squash', '--no-squash', '--log', '--no-log', '--signoff', '--no-signoff', '--verify',
        '--no-verify', '--no-verify-signatures', '--summary', '--no-summary', '--autostash',
        '--no-autostash', '--allow-unrelated-histories', '--no-gpg-sign',
      ],
      values: { ...FETCH_VALUES, ...valuesOf('text', ['--cleanup', '-s', '--strategy', '-X', '--strategy-option']) },
      flags: [TRANSFER_PROGRAM(['--upload-pack']), SET_UPSTREAM(['--set-upstream'])],
    },
    push: {
      facts: fact('Sends the save points made here up to the server, where other people can see them.', {
        privilege: 'none', touchesCredentials: false, repeatSafe: true,
        effect: ['read', 'transmit'],
        network: 'known-host',
        reversible: 'no',
        docs: GIT,
      }),
      operands: ['text'],
      // `-d`, `--delete`, `--prune` and `--mirror` are left out: each removes things from the server. So is `--signed`,
      // which signs with a key.
      plain: [
        '-v', '--verbose', '-q', '--quiet', '--all', '--branches', '--tags', '--follow-tags', '--no-follow-tags', '-n',
        '--dry-run', '--porcelain', '--progress', '--no-progress', '--thin', '--no-thin', '--verify',
        '--no-verify', '--atomic', '--no-atomic', '--no-force-with-lease', '-4', '--ipv4', '-6', '--ipv6',
      ],
      values: valuesOf('text', ['--repo', '-o', '--push-option', '--recurse-submodules']),
      flags: [
        TRANSFER_PROGRAM(['--receive-pack', '--exec']),
        SET_UPSTREAM(['-u', '--set-upstream']),
        { flags: ['-f', '--force'], facts: FORCED },
        // The ref and what it is expected to hold are given only after `=`.
        { flags: ['--force-with-lease', '--force-if-includes'], attached: true, role: 'text', facts: FORCED },
      ],
    },
    add: {
      facts: fact('Marks changed files to be included in the next save point.', { ...LOCAL, reversible: 'yes', repeatSafe: true, effect: ['write'], docs: GIT }),
      operands: ['path'],
      // `-e` and `--edit` are left out: they open an editor.
      plain: [
        '-A', '--all', '--no-ignore-removal', '--no-all', '--ignore-removal', '-u', '--update', '-n', '--dry-run', '-v',
        '--verbose', '-f', '--force', '-p', '--patch', '-i', '--interactive', '-N', '--intent-to-add', '--refresh',
        '--ignore-errors', '--ignore-missing', '--renormalize', '--sparse', '--pathspec-file-nul', '--no-warn-embedded-repo',
      ],
      values: { '--chmod': 'text', '--pathspec-from-file': 'path' },
    },
    commit: {
      facts: fact('Makes a new save point from the changes that were marked.', {
        ...LOCAL, reversible: 'yes',
        effect: ['create'],
        repeatSafe: false,
        docs: GIT,
      }),
      operands: ['path'],
      // `--amend` is left out: it replaces the last save point rather than making a new one. `-e` and `--edit` open an
      // editor, and `-S` and `--gpg-sign` sign with a key.
      plain: [
        '-a', '--all', '-q', '--quiet', '-v', '--verbose', '-s', '--signoff', '--no-signoff', '-n', '--no-verify', '--verify',
        '--allow-empty', '--allow-empty-message', '--no-edit', '--reset-author', '--short', '--branch', '--porcelain',
        '--long', '-z', '--null', '-i', '--include', '-o', '--only', '-p', '--patch', '--interactive', '-u',
        '--untracked-files', '--dry-run', '--status', '--no-status', '--no-gpg-sign', '--no-post-rewrite',
        '--pathspec-file-nul',
      ],
      values: {
        ...valuesOf('text', [
          '-m', '--message', '-C', '--reuse-message', '-c', '--reedit-message', '--fixup', '--squash', '--author',
          '--date', '--cleanup',
        ]),
        ...valuesOf('path', ['-F', '--file', '-t', '--template', '--pathspec-from-file']),
      },
    },
    checkout: {
      facts: fact('Switches the files you see to another version of the project.', {
        ...LOCAL, repeatSafe: true,
        effect: ['write'],
        reversible: 'unknown',
        note: 'Changes that were never saved to a save point can be lost.',
        docs: GIT,
      }),
      operands: ['text'],
      plain: [
        '-q', '--quiet', '--progress', '--no-progress', '--no-track', '--guess', '--no-guess', '-l', '-d',
        '--detach', '-m', '--merge', '-p', '--patch', '-2', '--ours', '-3', '--theirs', '--overlay', '--no-overlay',
        '--overwrite-ignore', '--no-overwrite-ignore', '--ignore-other-worktrees', '--ignore-skip-worktree-bits',
        '--recurse-submodules', '--no-recurse-submodules', '--pathspec-file-nul',
      ],
      values: { ...valuesOf('text', ['-b', '-B', '--orphan', '--conflict']), '--pathspec-from-file': 'path' },
      flags: [{ flags: ['-f', '--force'], facts: { reversible: 'no', note: 'Changes that were never saved to a save point are thrown away.' } }],
    },
    restore: {
      facts: fact('Puts files back to the way they were at the last save point.', {
        ...LOCAL, repeatSafe: true,
        effect: ['write'],
        reversible: 'no',
        note: 'Changes made to those files since then are lost.',
        docs: GIT,
      }),
      operands: ['path'],
      // `--no-overlay` is left out: it also removes files the source does not have.
      plain: [
        '-p', '--patch', '-W', '--worktree', '-S', '--staged', '-q', '--quiet', '--progress', '--no-progress', '-2', '--ours',
        '-3', '--theirs', '-m', '--merge', '--ignore-unmerged', '--ignore-skip-worktree-bits', '--recurse-submodules',
        '--no-recurse-submodules', '--overlay', '--pathspec-file-nul',
      ],
      values: { ...valuesOf('text', ['-s', '--source', '--conflict']), '--pathspec-from-file': 'path' },
    },
    reset: {
      facts: fact('Moves a project back to an earlier save point.', {
        ...LOCAL, repeatSafe: true,
        effect: ['write', 'delete'],
        reversible: 'no',
        note: 'Work that was never saved to a save point cannot be put back.',
        docs: GIT,
      }),
      operands: ['text'],
      plain: [
        '--soft', '--mixed', '--hard', '--merge', '--keep', '-N', '--intent-to-add', '-q', '--quiet', '--no-quiet', '-p',
        '--patch', '--refresh', '--no-refresh', '--recurse-submodules', '--no-recurse-submodules', '--pathspec-file-nul',
      ],
      values: { '--pathspec-from-file': 'path' },
    },
    clean: {
      facts: fact('Removes files sitting in the project folder that were never added to its history.', {
        ...LOCAL, repeatSafe: true,
        effect: ['delete'],
        reversible: 'no',
        note: 'Those files do not go to the Bin and cannot be put back.',
        docs: GIT,
      }),
      plain: ['-d', '-f', '--force', '-i', '--interactive', '-n', '--dry-run', '-q', '--quiet', '-X'],
      values: { '-e': 'pattern', '--exclude': 'pattern' },
      flags: [
        {
          flags: ['-x'],
          facts: {
            says: 'Removes files sitting in the project folder that were never added to its history, including the ones it was set up to leave alone.',
          },
        },
      ],
    },
    stash: {
      facts: fact('Puts the changes made here to one side, so the files go back to the last save point.', {
        ...LOCAL, reversible: 'yes',
        effect: ['write'],
        repeatSafe: false,
        docs: GIT,
      }),
    },
    remote: {
      facts: fact('Shows or changes which servers a project sends its work to.', { ...LOCAL, reversible: 'yes', repeatSafe: true, effect: ['read', 'configure'], docs: GIT }),
      plain: ['-v', '--verbose'],
    },
    config: {
      facts: fact('Shows or changes the settings a project uses, or the ones used across this computer.', {
        ...LOCAL, repeatSafe: true,
        effect: ['read', 'configure'],
        reversible: 'unknown',
        docs: GIT,
      }),
      values: { '-f': 'path', '--file': 'path', '--blob': 'text', '--type': 'text' },
    },
  },
}

const packagerRows = (docs: string): Entry => ({
  facts: opaqueFact(
    'Works with the ready-made code packages a project is built on.',
    'the steps written inside the project and inside the packages it uses',
    { privilege: 'none', touchesCredentials: true, effect: ['read', 'write', 'execute'], network: 'arbitrary', repeatSafe: false, docs },
  ),
  sub: {
    install: {
      facts: opaqueFact(
        'Downloads ready-made code packages from the internet and puts them into the project.',
        SETUP_STEPS,
        { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'write', 'install'], network: 'arbitrary', docs },
      ),
      operands: ['package'],
    },
    i: {
      facts: opaqueFact(
        'Downloads ready-made code packages from the internet and puts them into the project.',
        SETUP_STEPS,
        { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'write', 'install'], network: 'arbitrary', docs },
      ),
      operands: ['package'],
    },
    add: {
      facts: opaqueFact('Adds a ready-made code package from the internet to the project.', SETUP_STEPS, {
        privilege: 'none', touchesCredentials: false,
        effect: ['read', 'create', 'write', 'install'],
        network: 'arbitrary',
        docs,
      }),
      operands: ['package'],
    },
    ci: {
      facts: opaqueFact(
        'Removes the packages the project has and downloads them all again, exactly as the project lists them.',
        SETUP_STEPS,
        { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'write', 'delete', 'install'], network: 'arbitrary', docs },
      ),
    },
    update: {
      facts: opaqueFact('Downloads newer versions of the packages the project uses.', SETUP_STEPS, {
        privilege: 'none', touchesCredentials: false,
        effect: ['read', 'write', 'install'],
        network: 'arbitrary',
        docs,
      }),
      operands: ['package'],
    },
    uninstall: {
      facts: fact('Takes a ready-made code package out of the project.', {
        ...LOCAL, repeatSafe: true,
        effect: ['delete', 'write'],
        reversible: 'unknown',
        docs,
      }),
      operands: ['package'],
    },
    remove: {
      facts: fact('Takes a ready-made code package out of the project.', {
        ...LOCAL, repeatSafe: true,
        effect: ['delete', 'write'],
        reversible: 'unknown',
        docs,
      }),
      operands: ['package'],
    },
    run: {
      facts: opaqueFact(
        'Runs one of the commands the project has saved under a short name.',
        'the command the project has saved under that name',
        { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs },
      ),
      operands: ['text'],
    },
    test: {
      facts: opaqueFact(
        'Runs the checks the project has written for itself.',
        'the command the project has saved for its checks',
        { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs },
      ),
    },
    start: {
      facts: opaqueFact(
        'Starts the project the way the project itself says to start it.',
        'the command the project has saved for starting itself',
        { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs },
      ),
    },
    publish: {
      // It signs in to the package service with the access key saved on this computer, whether or not a code is given.
      facts: opaqueFact(
        'Sends the code in this folder to a public package service, where anyone can download it.',
        'the steps the project runs for itself before sending',
        { privilege: 'none', touchesCredentials: true, effect: ['read', 'transmit'], network: 'arbitrary', docs },
      ),
    },
    list: { facts: fact('Lists the ready-made code packages the project uses.', { ...LOOKS, docs }) },
    ls: { facts: fact('Lists the ready-made code packages the project uses.', { ...LOOKS, docs }) },
    audit: {
      facts: fact('Asks the package service whether any package the project uses has a known fault.', {
        effect: ['read'], reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true,
        network: 'arbitrary',
        docs,
      }),
    },
  },
})

// A one-time code from a second-step sign-in, handed over on the line.
const OTP: FlagRule = { flags: ['--otp'], takesValue: true, role: 'text', facts: { touchesCredentials: true } }

/**
 * npm and pnpm share their rows but not their flags: `-w` names a workspace in npm and is a bare switch in pnpm.
 * Both read their flags anywhere on the line, so every subcommand takes them, and the ones written before the
 * subcommand are stepped over to reach it. `plain` adds the switches each subcommand takes of its own.
 */
const nodePackager = (docs: string, values: Record<string, Role>, bare: string[], plain: Record<string, string[]> = {}): Entry => {
  const rows = packagerRows(docs)
  const flags = [OTP]
  const globals: FlagRule[] = [
    ...Object.entries(values).map(([flag, role]) => ({ flags: [flag], takesValue: true, role, facts: {} })),
    { flags: bare, facts: {} },
    ...flags,
  ]
  const sub = Object.fromEntries(
    Object.entries(rows.sub!).map(([word, rule]) => [
      word,
      { ...rule, ...(plain[word] && { plain: plain[word] }), values: { ...values, ...rule.values }, flags: [...(rule.flags ?? []), ...flags] },
    ]),
  )
  return { ...rows, values, globals, flags, sub }
}

// npm reads these on every command, so they are read after the subcommand too.
const NPM_ANYWHERE = ['-g', '--global', '--workspaces', '-s', '--silent', '-y', '--yes']
// Which list in package.json a package is written to, and how. `-ws` is one shorthand for `--workspaces`, not a bundle.
const NPM_SAVE = [
  '-S', '--save', '--no-save', '-P', '--save-prod', '-D', '--save-dev', '-O', '--save-optional', '--save-peer', '-B',
  '--save-bundle', '-E', '--save-exact',
]
const NPM_WORKSPACES = [...NPM_ANYWHERE, '-ws', '--include-workspace-root', '--install-links']
// How the packages are laid out and checked. `--ignore-scripts` and `--no-audit` only leave something out. `-f` and
// `--force` are left out: they turn off several of npm's own protections at once.
const NPM_INSTALLING = [
  ...NPM_WORKSPACES, '--legacy-bundling', '--global-style', '--legacy-peer-deps', '--strict-peer-deps', '--prefer-dedupe',
  '--foreground-scripts', '--ignore-scripts', '--audit', '--no-audit', '--bin-links', '--no-bin-links', '--fund', '--no-fund',
  '--dry-run', '--verbose',
]
const NPM_LOCKFILE = ['--package-lock', '--no-package-lock', '--package-lock-only']
const NPM_INSTALL = [...NPM_SAVE, ...NPM_INSTALLING, ...NPM_LOCKFILE]
const NPM_REMOVE = [...NPM_SAVE, ...NPM_WORKSPACES]
const NPM_LIST = [
  ...NPM_WORKSPACES, '-a', '--all', '--json', '-l', '--long', '-p', '--parseable', '--link', '--package-lock-only', '--unicode',
  '--no-unicode',
]
const NPM_SCRIPT = ['--ignore-scripts', '--foreground-scripts']
const NPM_PLAIN: Record<string, string[]> = {
  install: NPM_INSTALL,
  i: NPM_INSTALL,
  add: NPM_INSTALL,
  ci: NPM_INSTALLING,
  update: NPM_INSTALL,
  uninstall: NPM_REMOVE,
  remove: NPM_REMOVE,
  run: [...NPM_WORKSPACES, ...NPM_SCRIPT, '--if-present'],
  test: [...NPM_ANYWHERE, ...NPM_SCRIPT],
  start: [...NPM_ANYWHERE, ...NPM_SCRIPT],
  publish: [...NPM_WORKSPACES, '--dry-run'],
  list: NPM_LIST,
  ls: NPM_LIST,
  audit: [...NPM_WORKSPACES, ...NPM_SCRIPT, ...NPM_LOCKFILE, '--dry-run', '--json', '--include-attestations'],
}

const NPM_VALUES: Record<string, Role> = {
  '--registry': 'url',
  ...valuesOf('path', ['--prefix', '--cache', '--userconfig', '--script-shell']),
  ...valuesOf('text', ['-w', '--workspace', '--omit', '--include', '--tag', '--access', '--depth', '--audit-level', '--loglevel']),
}

const PNPM_VALUES: Record<string, Role> = {
  '--registry': 'url',
  ...valuesOf('path', ['-C', '--dir']),
  ...valuesOf('text', ['-F', '--filter', '--reporter', '--tag', '--access', '--depth', '--audit-level']),
}

// Where an app being installed is put, one flag for each kind of thing an app can bring with it.
const BREW_INSTALL_VALUES: Record<string, Role> = {
  '--cc': 'text',
  ...valuesOf('path', [
    '--appdir', '--colorpickerdir', '--prefpanedir', '--qlplugindir', '--mdimporterdir', '--dictionarydir', '--fontdir',
    '--servicedir', '--input-methoddir', '--internet-plugindir', '--audio-unit-plugindir', '--vst-plugindir',
    '--vst3-plugindir', '--screen-saverdir',
  ]),
}

// What `docker create` takes, which is everything `docker run` does but waiting on it and passing signals to it.
const DOCKER_CREATE_VALUES: Record<string, Role> = {
  ...valuesOf('path', ['--cidfile', '--label-file']),
  ...valuesOf('text', [
    '--add-host', '-a', '--attach', '--blkio-weight', '--blkio-weight-device', '--cap-drop', '--cgroup-parent',
    '--cpu-period', '--cpu-quota', '--cpu-rt-period', '--cpu-rt-runtime', '-c', '--cpu-shares', '--cpus',
    '--cpuset-cpus', '--cpuset-mems', '--device-read-bps',
    '--device-read-iops', '--device-write-bps', '--device-write-iops', '--dns', '--dns-option', '--dns-search',
    '--domainname', '--entrypoint', '-e', '--env', '--expose', '--gpus', '--group-add', '--health-cmd',
    '--health-interval', '--health-retries', '--health-start-period', '--health-timeout', '-h', '--hostname', '--ip',
    '--ip6', '--isolation', '--kernel-memory', '-l', '--label', '--link', '--link-local-ip', '--log-driver',
    '--log-opt', '--mac-address', '-m', '--memory', '--memory-reservation', '--memory-swap', '--memory-swappiness',
    '--name', '--network-alias', '--oom-score-adj', '--pids-limit', '--platform', '-p',
    '--publish', '--pull', '--restart', '--runtime', '--shm-size', '--stop-signal', '--stop-timeout',
    '--storage-opt', '--sysctl', '--tmpfs', '--ulimit', '-u', '--user', '--volume-driver', '-w', '--workdir',
  ]),
}
const DOCKER_RUN_VALUES: Record<string, Role> = { ...DOCKER_CREATE_VALUES, '--detach-keys': 'text' }

// A file of hidden settings, the kind that usually holds passwords and access keys for other services.
const ENV_FILE: FlagRule = { flags: ['--env-file'], takesValue: true, role: 'path', facts: { touchesCredentials: true } }

// The text cannot say whether a folder of this computer or a store of the packaged program's own is meant, so both are
// read as the wider one. A packaged program usually runs as the system's administrator inside its copy, so a folder of
// this computer it is given, `/` or the one that controls Docker itself among them, is in its full control.
const VOLUME: FlagRule = {
  flags: ['-v', '--volume'],
  takesValue: true,
  role: 'text',
  facts: {
    effect: ['read', 'write', 'elevate'],
    privilege: 'root',
    note: 'Folders on this computer that it is pointed at can be read and changed from inside it, with full control.',
  },
}
const MOUNT: FlagRule = { ...VOLUME, flags: ['--mount'] }
const VOLUMES_FROM: FlagRule = {
  ...VOLUME,
  flags: ['--volumes-from'],
  facts: { ...VOLUME.facts, note: 'It is given the folders another packaged program was given, which can be folders of this computer.' },
}

const PRIVILEGED: FlagRule = {
  flags: ['--privileged'],
  facts: {
    effect: ['elevate'],
    privilege: 'root',
    note: 'It is given full control of the system it runs on, so it is no longer sealed off from this computer.',
  },
}
const PRIVILEGED_EXEC: FlagRule = {
  ...PRIVILEGED,
  facts: { ...PRIVILEGED.facts, note: 'The command is given full control of the system the packaged program runs on.' },
}

// Each of these can name `host`, so the packaged program shares that part of this computer instead of having its own,
// and does so as the administrator it usually runs as inside.
const SHARES_HOST = (flags: string[], effect: Effect[], note: string): FlagRule => ({
  flags,
  takesValue: true,
  role: 'text',
  facts: { effect: [...effect, 'elevate'], privilege: 'root', note },
})
const HOST_PARTS: FlagRule[] = [
  SHARES_HOST(['--pid'], ['read', 'terminate'], 'Set to share them, it can see and stop the programs running on this computer.'),
  SHARES_HOST(['--ipc'], ['read', 'write'], "Set to share it, it can read and change the memory this computer's programs pass data through."),
  SHARES_HOST(['--uts'], ['configure'], 'Set to share it, it can change the name this computer goes by.'),
  SHARES_HOST(['--userns'], [], 'Set to share it, the administrator inside it is the administrator of this computer.'),
  SHARES_HOST(['--network'], ['read'], "Set to share them, it uses this computer's own network connections and can listen in on them."),
  {
    flags: ['--cgroupns'],
    takesValue: true,
    role: 'text',
    facts: { effect: ['read'], note: "Set to share it, it can see how this computer's programs are grouped and held to limits." },
  },
  // `seccomp=unconfined`, `apparmor=unconfined` and `label=disable` each take one of them away.
  SHARES_HOST(['--security-opt'], [], 'Some settings take down the walls that keep it sealed off from this computer.'),
]
// The powers are named in the value, and one name (`ALL`, `SYS_ADMIN`) is as wide as `--privileged`, so the flag is
// read as the widest of them.
const CAP_ADD: FlagRule = {
  flags: ['--cap-add'],
  takesValue: true,
  role: 'text',
  facts: {
    effect: ['elevate'],
    privilege: 'root',
    note: 'It is given extra powers over the system it runs on, and some of them reach past its sealed-off copy.',
  },
}
const DEVICE: FlagRule = {
  flags: ['--device'],
  takesValue: true,
  role: 'text',
  facts: {
    effect: ['read', 'write', 'elevate'],
    privilege: 'root',
    note: 'A device of this computer, such as a disk, can be read and written from inside it, with full control.',
  },
}
const DEVICE_RULE: FlagRule = {
  ...DEVICE,
  flags: ['--device-cgroup-rule'],
  facts: { ...DEVICE.facts, note: 'A rule can let it read and write devices of this computer, such as disks, with full control.' },
}

// What `docker run` and `docker create` give the packaged program they set up.
const DOCKER_RUN_FLAGS: FlagRule[] = [ENV_FILE, PRIVILEGED, CAP_ADD, DEVICE, DEVICE_RULE, VOLUME, MOUNT, VOLUMES_FROM, ...HOST_PARTS]

const DOCKER = 'https://docs.docker.com/reference/cli/docker/'
// Switches `docker run` and `docker create` share. `--disable-content-trust` is already the default, and `-P` publishes
// ports, which the row's network reach already covers.
const DOCKER_CREATE_PLAIN = [
  '-i', '--interactive', '-t', '--tty', '--rm', '--init', '--read-only', '--no-healthcheck', '--oom-kill-disable', '-P',
  '--publish-all', '--disable-content-trust', '-q', '--quiet', '--help',
]
const DOCKER_RUN: Rule = {
  facts: opaqueFact(
    'Starts a packaged program in its own sealed-off copy of a system.',
    'the packaged program, whose contents were decided by whoever built it',
    { privilege: 'none', touchesCredentials: false, effect: ['create', 'execute'], network: 'arbitrary', docs: DOCKER },
  ),
  operands: ['package', 'command'],
  plain: [...DOCKER_CREATE_PLAIN, '-d', '--detach', '--sig-proxy'],
  values: DOCKER_RUN_VALUES,
  flags: DOCKER_RUN_FLAGS,
}
// It downloads the packaged program if it is not here yet, and sets it up without starting it.
const DOCKER_CREATE: Rule = {
  facts: fact('Sets up a packaged program in its own sealed-off copy of a system, ready to start later.', {
    reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: false,
    effect: ['read', 'create', 'install'],
    network: 'arbitrary',
    docs: DOCKER,
  }),
  // The command it is set up with does not run here, so it is not looked up.
  operands: ['package', 'text'],
  plain: DOCKER_CREATE_PLAIN,
  values: DOCKER_CREATE_VALUES,
  flags: DOCKER_RUN_FLAGS,
}
const DOCKER_EXEC: Rule = {
  facts: opaqueFact(
    'Runs another command inside a packaged program that is already running.',
    'the command it was given, which runs inside the packaged program',
    { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs: DOCKER },
  ),
  operands: ['text', 'command'],
  plain: ['-d', '--detach', '-i', '--interactive', '-t', '--tty'],
  values: valuesOf('text', ['--detach-keys', '-e', '--env', '-u', '--user', '-w', '--workdir']),
  flags: [ENV_FILE, PRIVILEGED_EXEC],
}

// Options Docker reads before the command, for where it finds the service that runs the packaged programs. That
// service can be on another computer, reached over the network with keys kept on this one.
const DOCKER_GLOBALS: FlagRule[] = [
  ...globalsOf({ ...valuesOf('path', ['--config', '--tlscacert', '--tlscert']), ...valuesOf('text', ['-l', '--log-level']) }),
  { flags: ['-H', '--host'], takesValue: true, role: 'url', facts: { network: 'arbitrary', touchesCredentials: true } },
  { flags: ['-c', '--context'], takesValue: true, role: 'text', facts: { network: 'arbitrary', touchesCredentials: true } },
  { flags: ['--tlskey'], takesValue: true, role: 'path', facts: { touchesCredentials: true } },
  { flags: ['-D', '--debug', '--tls', '--tlsverify'], facts: {} },
]

const COMPOSE = 'https://docs.docker.com/reference/cli/docker/compose/'
const COMPOSED = 'the packaged programs the file names, whose contents were decided by whoever built them'
const COMPOSE_VALUES: Record<string, Role> = {
  ...valuesOf('path', ['-f', '--file', '--project-directory']),
  ...valuesOf('text', ['-p', '--project-name', '--profile', '--ansi', '--progress', '--parallel']),
}
const COMPOSE_INSIDE = valuesOf('text', ['-e', '--env', '-u', '--user', '-w', '--workdir', '--index'])
const COMPOSE_GONE: FlagRule = { flags: ['-v', '--volumes'], facts: { note: 'The stores of data they kept are removed as well.' } }

/** What `docker compose` and the older `docker-compose` do, word for word. */
const COMPOSE_SUBS: Record<string, Rule> = {
  up: {
    facts: opaqueFact('Starts the packaged programs described together in one file, building or downloading them first if needed.', COMPOSED, {
      privilege: 'none', touchesCredentials: false,
      effect: ['create', 'execute', 'install'],
      network: 'arbitrary',
      docs: COMPOSE,
    }),
    operands: ['text'],
    values: valuesOf('text', ['--scale', '-t', '--timeout', '--wait-timeout', '--exit-code-from', '--pull', '--attach', '--no-attach']),
  },
  down: {
    facts: fact('Stops and removes the packaged programs described together in one file.', {
      ...LOCAL, repeatSafe: true,
      effect: ['terminate', 'delete'],
      reversible: 'no',
      docs: COMPOSE,
    }),
    operands: ['text'],
    values: valuesOf('text', ['-t', '--timeout', '--rmi']),
    flags: [COMPOSE_GONE],
  },
  ps: { facts: fact('Lists the packaged programs from one file, and whether each is running.', { ...LOOKS, docs: COMPOSE }), operands: ['text'], values: valuesOf('text', ['--format', '-f', '--filter', '--status']) },
  logs: { facts: fact('Shows what the packaged programs from one file have written as they ran.', { ...LOOKS, docs: COMPOSE }), operands: ['text'], plain: ['--dry-run', '-f', '--follow', '--no-color', '--no-log-prefix', '-t', '--timestamps'], values: valuesOf('text', ['--since', '--until', '-n', '--tail', '--index']) },
  config: {
    facts: fact('Shows the file the packaged programs are started from, with its settings filled in.', {
      effect: ['read'], reversible: 'yes', network: 'none', privilege: 'none', repeatSafe: true,
      touchesCredentials: true,
      note: 'Secrets set in the environment or in settings files are filled in, in readable form.',
      docs: COMPOSE,
    }),
    operands: ['text'],
    values: { ...valuesOf('text', ['--format', '--hash']), '-o': 'path', '--output': 'path' },
  },
  build: {
    facts: opaqueFact('Builds the packaged programs one file describes, from the steps written in their folders.', 'the steps written in those folders, which are not shown here', {
      privilege: 'none', touchesCredentials: false,
      effect: ['read', 'create', 'write', 'execute'],
      network: 'arbitrary',
      docs: COMPOSE,
    }),
    operands: ['text'],
    values: valuesOf('text', ['--build-arg', '--ssh', '--builder', '-m', '--memory', '--progress']),
  },
  pull: {
    facts: fact('Downloads the packaged programs one file names onto this computer.', { reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true, effect: ['read', 'create', 'install'], network: 'arbitrary', docs: COMPOSE }),
    operands: ['text'],
    values: valuesOf('text', ['--policy']),
  },
  push: {
    facts: fact('Sends the packaged programs one file names up to a service other people can reach.', {
      privilege: 'none', touchesCredentials: false, repeatSafe: true,
      effect: ['read', 'transmit'],
      network: 'arbitrary',
      reversible: 'no',
      docs: COMPOSE,
    }),
    operands: ['text'],
  },
  exec: {
    facts: opaqueFact('Runs another command inside one of the packaged programs from one file that is already running.', 'the command it was given, which runs inside the packaged program', {
      privilege: 'none', touchesCredentials: false,
      effect: ['execute'],
      network: 'arbitrary',
      docs: COMPOSE,
    }),
    operands: ['text', 'command'],
    values: COMPOSE_INSIDE,
    flags: [PRIVILEGED_EXEC],
  },
  run: {
    facts: opaqueFact('Starts one of the packaged programs from one file to run a single command.', COMPOSED, {
      privilege: 'none', touchesCredentials: false,
      effect: ['create', 'execute'],
      network: 'arbitrary',
      docs: COMPOSE,
    }),
    operands: ['text', 'command'],
    values: { ...COMPOSE_INSIDE, ...valuesOf('text', ['-p', '--publish', '--name', '--entrypoint', '-l', '--label', '--cap-drop']) },
    flags: [VOLUME, ENV_FILE, { ...ENV_FILE, flags: ['--env-from-file'] }, CAP_ADD],
  },
  start: {
    facts: opaqueFact('Starts the stopped packaged programs from one file again.', COMPOSED, { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs: COMPOSE }),
    operands: ['text'],
  },
  restart: {
    facts: opaqueFact('Stops and starts again the packaged programs from one file.', COMPOSED, { privilege: 'none', touchesCredentials: false, effect: ['terminate', 'execute'], network: 'arbitrary', docs: COMPOSE }),
    operands: ['text'],
    values: valuesOf('text', ['-t', '--timeout']),
  },
  stop: {
    facts: fact('Stops the packaged programs from one file, keeping them to start again.', { ...LOCAL, reversible: 'yes', repeatSafe: true, effect: ['terminate'], docs: COMPOSE }),
    operands: ['text'],
    values: valuesOf('text', ['-t', '--timeout']),
  },
  kill: {
    facts: fact('Stops the packaged programs from one file at once, without letting them finish.', { ...LOCAL, reversible: 'yes', repeatSafe: true, effect: ['terminate'], docs: COMPOSE }),
    operands: ['text'],
    values: { '-s': 'signal', '--signal': 'signal' },
  },
  rm: {
    facts: fact('Removes the stopped packaged programs from one file.', { ...LOCAL, repeatSafe: true, effect: ['delete'], reversible: 'no', docs: COMPOSE }),
    operands: ['text'],
    flags: [COMPOSE_GONE],
  },
  images: { facts: fact('Lists the packaged programs one file has stored on this computer.', { ...LOOKS, docs: COMPOSE }), operands: ['text'], values: valuesOf('text', ['--format']) },
  top: { facts: fact('Shows what is running inside the packaged programs from one file.', { ...LOOKS, docs: COMPOSE }), operands: ['text'] },
  ls: { facts: fact('Lists the sets of packaged programs running from files on this computer.', { ...LOOKS, docs: COMPOSE }), values: valuesOf('text', ['--format', '--filter']) },
  version: { facts: fact('Shows which version of the tool for files of packaged programs is installed.', { ...LOOKS, docs: COMPOSE }), values: valuesOf('text', ['-f', '--format']) },
}

const PY = 'https://pip.pypa.io/en/stable/cli/'

// Where pip looks for packages. A link page given to `-f` can be a folder here as well as an address, so it is text.
const PIP_INDEX_VALUES: Record<string, Role> = valuesOf('text', ['-i', '--index-url', '--extra-index-url', '-f', '--find-links'])

export const DEV: Record<string, Entry> = {
  git: GIT_ENTRY,
  npm: nodePackager('https://docs.npmjs.com/cli/commands', NPM_VALUES, NPM_ANYWHERE, NPM_PLAIN),
  pnpm: nodePackager('https://pnpm.io/cli/add', PNPM_VALUES, ['-r', '--recursive', '-w', '--workspace-root', '-s', '--silent', '-g', '--global']),
  brew: {
    facts: opaqueFact(
      'Works with the programs installed on this computer through Homebrew.',
      'the set-up steps each program brings with it',
      { privilege: 'none', touchesCredentials: false, effect: ['read', 'write', 'execute'], network: 'arbitrary', repeatSafe: false, docs: 'man 1 brew' },
    ),
    sub: {
      install: {
        facts: opaqueFact(
          'Downloads a program from the internet and installs it on this computer.',
          'the set-up steps that program brings with it',
          { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'write', 'install'], network: 'arbitrary', docs: 'man 1 brew' },
        ),
        operands: ['package'],
        values: BREW_INSTALL_VALUES,
      },
      reinstall: {
        facts: opaqueFact(
          'Removes an installed program and installs it again from the internet.',
          'the set-up steps that program brings with it',
          { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'write', 'delete', 'install'], network: 'arbitrary', docs: 'man 1 brew' },
        ),
        operands: ['package'],
        values: BREW_INSTALL_VALUES,
      },
      uninstall: {
        facts: fact('Removes a program that was installed through Homebrew.', {
          ...LOCAL, repeatSafe: true,
          effect: ['delete'],
          reversible: 'no',
          docs: 'man 1 brew',
        }),
        operands: ['package'],
      },
      update: {
        facts: fact('Refreshes the list of programs that can be installed, without installing anything.', {
          reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true,
          effect: ['read', 'write'],
          network: 'arbitrary',
          docs: 'man 1 brew',
        }),
      },
      upgrade: {
        facts: opaqueFact(
          'Downloads and installs newer versions of the programs installed through Homebrew.',
          'the set-up steps each program brings with it',
          { privilege: 'none', touchesCredentials: false, effect: ['read', 'write', 'install'], network: 'arbitrary', docs: 'man 1 brew' },
        ),
        operands: ['package'],
        values: BREW_INSTALL_VALUES,
      },
      list: { facts: fact('Lists the programs installed through Homebrew.', { ...LOOKS, docs: 'man 1 brew' }) },
      info: {
        facts: fact('Shows what a program is and whether it is installed.', { effect: ['read'], reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true, network: 'arbitrary', docs: 'man 1 brew' }),
        values: valuesOf('text', ['--days', '--category']),
      },
      search: { facts: fact('Looks for a program by name among the ones that can be installed.', { effect: ['read'], reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true, network: 'arbitrary', docs: 'man 1 brew' }) },
      doctor: { facts: fact('Checks whether Homebrew itself is set up properly on this computer.', { ...LOOKS, docs: 'man 1 brew' }) },
      cleanup: {
        facts: fact('Removes older versions of installed programs to free up room.', {
          ...LOCAL, repeatSafe: true,
          effect: ['delete'],
          reversible: 'no',
          docs: 'man 1 brew',
        }),
        values: { '--prune': 'text' },
      },
      services: {
        facts: opaqueFact(
          'Starts or stops the programs Homebrew keeps running in the background.',
          'the program being started, and the set-up it brings with it',
          { ...LOCAL, effect: ['configure', 'execute', 'terminate'], docs: 'man 1 brew' },
        ),
        operands: ['text', 'service'],
      },
    },
  },
  pip: {
    versioned: true,
    facts: opaqueFact(
      'Works with the ready-made Python code packages installed on this computer.',
      'the set-up steps the packages bring with them',
      { privilege: 'none', touchesCredentials: false, effect: ['read', 'write', 'execute'], network: 'arbitrary', repeatSafe: false, docs: PY },
    ),
    sub: {
      install: {
        facts: opaqueFact('Downloads ready-made Python code from the internet and installs it.', SETUP_STEPS, {
          privilege: 'none', touchesCredentials: false,
          effect: ['read', 'create', 'write', 'install'],
          network: 'arbitrary',
          docs: PY,
        }),
        operands: ['package'],
        values: {
          ...PIP_INDEX_VALUES,
          ...valuesOf('path', ['-r', '--requirement', '-c', '--constraint', '-e', '--editable', '-t', '--target', '--prefix', '--root', '--src']),
          ...valuesOf('text', ['--upgrade-strategy', '--platform', '--python-version', '--implementation', '--abi', '--only-binary', '--no-binary', '--progress-bar']),
        },
      },
      uninstall: {
        facts: fact('Removes a ready-made Python code package from this computer.', {
          ...LOCAL, repeatSafe: true,
          effect: ['delete'],
          reversible: 'no',
          docs: PY,
        }),
        operands: ['package'],
      },
      download: {
        facts: fact('Downloads ready-made Python code from the internet without installing it.', {
          reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true,
          effect: ['read', 'create'],
          network: 'arbitrary',
          docs: PY,
        }),
        operands: ['package'],
        values: {
          ...PIP_INDEX_VALUES,
          ...valuesOf('path', ['-d', '--dest', '-r', '--requirement', '-c', '--constraint', '--src']),
          ...valuesOf('text', ['--platform', '--python-version', '--implementation', '--abi', '--only-binary', '--no-binary', '--progress-bar']),
        },
      },
      list: {
        facts: fact('Lists the ready-made Python code packages installed here.', { ...LOOKS, docs: PY }),
        values: { ...PIP_INDEX_VALUES, '--path': 'path', '--exclude': 'package', '--format': 'text' },
      },
      show: { facts: fact('Shows the details of one installed Python code package.', { ...LOOKS, docs: PY }), operands: ['package'] },
      freeze: {
        facts: fact('Lists the installed Python code packages and their exact versions.', { ...LOOKS, docs: PY }),
        values: { '--path': 'path', '-r': 'path', '--requirement': 'path', '--exclude': 'package' },
      },
    },
  },
  node: {
    facts: opaqueFact(
      'Runs a program written in JavaScript.',
      'the JavaScript file it was given, whose contents are not shown here',
      { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs: 'man 1 node' },
    ),
    operands: ['path'],
    values: {
      '-e': 'command',
      '--eval': 'command',
      '-p': 'command',
      '-r': 'package',
      '--require': 'package',
      '--import': 'package',
      '--watch-path': 'path',
    },
    flags: [ENV_FILE],
  },
  python: {
    versioned: true,
    facts: opaqueFact(
      'Runs a program written in Python.',
      'the Python file it was given, whose contents are not shown here',
      { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs: 'man 1 python3' },
    ),
    operands: ['path'],
    flags: [
      {
        flags: ['-c'],
        takesValue: true,
        role: 'command',
        facts: { says: 'Runs the Python instructions written straight into this command.' },
      },
      { flags: ['-m'], takesValue: true, role: 'package', facts: { says: 'Runs an installed Python package as if it were a program.' } },
    ],
    values: valuesOf('text', ['-W', '-X', '--check-hash-based-pycs']),
  },
  sh: {
    facts: opaqueFact(
      'Runs a list of commands, one after another.',
      'the commands it was given, which are not shown here',
      { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs: 'man 1 sh' },
    ),
    operands: ['path'],
    flags: [
      {
        flags: ['-c'],
        takesValue: true,
        role: 'command',
        facts: { says: 'Runs the commands written straight into this one, one after another.' },
      },
    ],
  },
  sudo: {
    facts: opaqueFact(
      'Runs another command with full control over this computer.',
      'the command it was given, which then has control over everything on this computer',
      {
        touchesCredentials: false,
        effect: ['elevate', 'execute'],
        privilege: 'root',
        network: 'arbitrary',
        note: 'Whatever it runs can change anything here, including parts of macOS itself.',
        docs: 'man 8 sudo',
      },
    ),
    operands: ['command'],
    // `-h` and `--host` are left out. `-h` asks for help on its own and takes the next word as the computer to run on
    // when that word is not an option, which a value cannot say; that command would run on that other computer.
    values: {
      ...valuesOf('user', ['-u', '--user', '-U', '--other-user']),
      ...valuesOf('path', ['-D', '--chdir', '-R', '--chroot']),
      ...valuesOf('text', ['-g', '--group', '-p', '--prompt', '-C', '--close-from', '-r', '--role', '-t', '--type', '-T', '--command-timeout']),
    },
    nestedHere: true,
  },
  xargs: {
    facts: opaqueFact(
      'Runs another command once for each line of text it is handed.',
      'the command it was given, which it runs once per line',
      { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs: 'man 1 xargs' },
    ),
    operands: ['command'],
    // `-d` and `-a` are GNU's; the macOS one has neither and stops at them. `-p` asks before each run, and `-o` lets the
    // command it runs read from the keyboard.
    plain: [
      '-0', '--null', '-o', '--open-tty', '-p', '--interactive', '-r', '--no-run-if-empty', '-t', '--verbose', '-x', '--exit',
    ],
    values: valuesOf('text', ['-E', '-I', '-J', '-L', '-n', '-P', '-R', '-S', '-s', '-d', '--delimiter']),
    flags: [{ flags: ['-a', '--arg-file'], takesValue: true, role: 'path', facts: { effect: ['read'] } }],
    nestedHere: true,
  },
  make: {
    facts: opaqueFact(
      'Carries out the build steps a project has written down for itself.',
      'the steps written in the project, which are not shown here',
      { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'write', 'execute'], network: 'arbitrary', docs: 'man 1 make' },
    ),
    operands: ['text'],
    // The number of jobs is optional, so it counts only written onto the flag: `make -j build` names a target.
    flags: [{ flags: ['-j', '--jobs'], attached: true, role: 'text', facts: {} }],
    values: valuesOf('path', [
      '-C', '--directory', '-f', '--file', '--makefile', '-I', '--include-dir', '-o', '--old-file', '--assume-old',
      '-W', '--what-if', '--new-file', '--assume-new',
    ]),
  },
  sqlite3: {
    facts: opaqueFact(
      'Opens a stored collection of records and carries out instructions against it.',
      'the instructions it was given, which are not shown here',
      {
        ...LOCAL,
        effect: ['read', 'write', 'execute'],
        note: 'Those instructions can change or remove records in the file, with no copy kept.',
        docs: 'man 1 sqlite3',
      },
    ),
    operands: ['path', 'command'],
    values: {
      '-init': 'path',
      // `-lookaside` and `-pagecache` are left out: each takes two words, a size and a count, and a value is one.
      ...valuesOf('text', ['-cmd', '-separator', '-nullvalue', '-newline', '-vfs', '-mmap']),
    },
  },
  docker: {
    facts: opaqueFact(
      'Works with programs that run in their own sealed-off copy of a system.',
      'the packaged program, whose contents were decided by whoever built it',
      { privilege: 'root', effect: ['read', 'write', 'execute', 'elevate'], network: 'arbitrary', repeatSafe: false, touchesCredentials: true, docs: 'https://docs.docker.com/reference/cli/docker/' },
    ),
    globals: DOCKER_GLOBALS,
    sub: {
      ps: {
        facts: fact('Lists the packaged programs running right now.', { ...LOOKS, docs: 'https://docs.docker.com/reference/cli/docker/' }),
        plain: ['-a', '--all', '-l', '--latest', '--no-trunc', '-q', '--quiet', '-s', '--size'],
        values: valuesOf('text', ['-f', '--filter', '--format', '-n', '--last']),
      },
      images: {
        facts: fact('Lists the packaged programs stored on this computer.', { ...LOOKS, docs: 'https://docs.docker.com/reference/cli/docker/' }),
        plain: ['-a', '--all', '--digests', '--no-trunc', '-q', '--quiet', '--tree'],
        values: valuesOf('text', ['-f', '--filter', '--format']),
      },
      logs: {
        facts: fact('Shows what a packaged program has written as it ran.', { ...LOOKS, docs: 'https://docs.docker.com/reference/cli/docker/' }),
        operands: ['text'],
        plain: ['-f', '--follow', '-t', '--timestamps', '--details'],
        values: valuesOf('text', ['--since', '-n', '--tail', '--until']),
      },
      run: DOCKER_RUN,
      'container run': DOCKER_RUN,
      create: DOCKER_CREATE,
      'container create': DOCKER_CREATE,
      exec: DOCKER_EXEC,
      'container exec': DOCKER_EXEC,
      build: {
        facts: opaqueFact(
          'Builds a packaged program from the steps written in a folder.',
          'the steps written in that folder, which are not shown here',
          { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'write', 'execute'], network: 'arbitrary', docs: 'https://docs.docker.com/reference/cli/docker/' },
        ),
        operands: ['path'],
        plain: ['--no-cache', '--pull', '-q', '--quiet', '--squash', '--disable-content-trust'],
        values: {
          ...valuesOf('path', ['-f', '--file', '--iidfile']),
          ...valuesOf('text', [
            '-t', '--tag', '--add-host', '--build-arg', '--cache-from', '--isolation', '--label', '--network', '-o', '--output',
            '--platform', '--progress', '--secret', '--ssh', '--target',
          ]),
        },
      },
      pull: {
        facts: fact('Downloads a packaged program from the internet onto this computer.', {
          reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true,
          effect: ['read', 'create', 'install'],
          network: 'arbitrary',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['package'],
        plain: ['-a', '--all-tags', '-q', '--quiet', '--disable-content-trust'],
        values: { '--platform': 'text' },
      },
      push: {
        facts: fact('Sends a packaged program from this computer up to a service other people can reach.', {
          privilege: 'none', touchesCredentials: false, repeatSafe: true,
          effect: ['read', 'transmit'],
          network: 'arbitrary',
          reversible: 'no',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['package'],
        plain: ['-a', '--all-tags', '-q', '--quiet', '--disable-content-trust'],
        values: { '--platform': 'text' },
      },
      stop: {
        facts: fact('Stops a packaged program that is running.', {
          ...LOCAL, repeatSafe: true,
          effect: ['terminate'],
          reversible: 'yes',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['text'],
        values: valuesOf('text', ['-t', '--time', '--timeout', '-s', '--signal']),
      },
      rm: {
        facts: fact('Removes a stopped packaged program and anything it had kept.', {
          ...LOCAL, repeatSafe: true,
          effect: ['delete'],
          reversible: 'no',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['text'],
        plain: ['-l', '--link', '-v', '--volumes'],
        flags: [
          {
            flags: ['-f', '--force'],
            facts: { effect: ['terminate'], says: 'Stops a packaged program if it is running, and removes it and anything it had kept.' },
          },
        ],
      },
      rmi: {
        facts: fact('Removes a stored packaged program from this computer.', {
          ...LOCAL, repeatSafe: true,
          effect: ['delete'],
          reversible: 'no',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['package'],
        plain: ['-f', '--force', '--no-prune'],
        values: { '--platform': 'text' },
      },
      compose: {
        facts: opaqueFact(
          'Starts or stops a set of packaged programs described together in one file.',
          'the packaged programs that file names, whose contents were decided by whoever built them',
          { privilege: 'root', effect: ['create', 'execute', 'terminate', 'elevate'], network: 'arbitrary', touchesCredentials: true, docs: 'https://docs.docker.com/reference/cli/docker/' },
        ),
        operands: ['text'],
        values: COMPOSE_VALUES,
        flags: [ENV_FILE],
      },
      // Its own options (`-f`, `-p`) come before the subcommand: `docker compose logs -f` follows the log.
      ...Object.fromEntries(Object.entries(COMPOSE_SUBS).map(([word, rule]) => [`compose ${word}`, rule])),
    },
  },
  // The file and project options come before the subcommand; after it, `logs -f` follows and `rm -f` does not ask.
  'docker-compose': {
    facts: opaqueFact('Starts or stops a set of packaged programs described together in one file.', COMPOSED, {
      privilege: 'root',
      effect: ['read', 'create', 'write', 'delete', 'execute', 'terminate', 'install', 'transmit', 'elevate'],
      network: 'arbitrary',
      reversible: 'no',
      touchesCredentials: true,
      docs: COMPOSE,
    }),
    globals: globalsOf(COMPOSE_VALUES, [ENV_FILE]),
    values: COMPOSE_VALUES,
    flags: [ENV_FILE],
    sub: COMPOSE_SUBS,
  },
}
