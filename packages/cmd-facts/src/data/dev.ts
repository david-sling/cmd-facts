import { fact, opaqueFact, valuesOf } from '../entry.ts'
import type { Entry, FlagRule, Role, Rule } from '../entry.ts'
import { globalsOf } from './shared.ts'

const GIT = 'man 1 git'
const SETUP_STEPS = 'the set-up steps the downloaded packages bring with them'

const FETCH_VALUES = valuesOf('text', [
  '--depth', '--deepen', '--shallow-since', '--shallow-exclude', '--negotiation-tip', '--refmap', '-j', '--jobs',
  '--submodule-prefix', '-o', '--server-option',
])

// The program that serves the other end of a transfer. Where the other end is a folder on this computer, it runs here.
const TRANSFER_PROGRAM = (flags: string[]): FlagRule => ({
  flags,
  takesValue: true,
  role: 'text',
  facts: { effect: ['execute'], opaque: true, handsOverTo: 'the program named to serve the other end, which can run on this computer' },
})

export const GIT_ENTRY: Entry = {
  facts: fact('Works with the saved history of a project kept on this computer.', {
    effect: ['read', 'write'],
    network: 'known-host',
    reversible: 'unknown',
    repeatSafe: false,
    docs: GIT,
  }),
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
    { flags: ['-P', '--no-pager', '--bare', '--no-optional-locks', '--literal-pathspecs', '--no-replace-objects'], facts: {} },
  ],
  sub: {
    status: { facts: fact('Shows which files in a project have changed since its last save point.', { docs: GIT }) },
    log: {
      facts: fact('Shows the list of save points a project has, newest first.', { docs: GIT }),
      values: { '--grep': 'pattern', ...valuesOf('text', ['--author', '-n', '--max-count']) },
    },
    diff: { facts: fact('Shows exactly what changed in the files of a project since its last save point.', { docs: GIT }) },
    show: { facts: fact('Shows what one save point in a project changed.', { docs: GIT }) },
    branch: {
      facts: fact('Lists or sets up the separate lines of work a project keeps.', { effect: ['read', 'write'], docs: GIT }),
      // `--merged`, `--track` and `--abbrev` are left out: each takes its value only after `=`, if at all.
      values: valuesOf('text', ['--sort', '--format', '--points-at', '-u', '--set-upstream-to']),
    },
    clone: {
      facts: fact('Copies a project from a server onto this computer.', {
        effect: ['read', 'create'],
        network: 'known-host',
        docs: GIT,
      }),
      operands: ['url', 'path'],
      values: {
        ...valuesOf('text', [
          '-b', '--branch', '-o', '--origin', '--depth', '--shallow-since', '--shallow-exclude', '--filter', '--server-option',
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
        effect: ['read', 'write'],
        network: 'known-host',
        docs: GIT,
      }),
      values: FETCH_VALUES,
      flags: [TRANSFER_PROGRAM(['--upload-pack'])],
    },
    pull: {
      facts: fact('Collects the latest changes from the server and puts them into the files you see.', {
        effect: ['read', 'write'],
        network: 'known-host',
        reversible: 'unknown',
        note: 'Changes made here that were never saved to a save point can be lost.',
        docs: GIT,
      }),
      values: { ...FETCH_VALUES, ...valuesOf('text', ['--cleanup', '-s', '--strategy', '-X', '--strategy-option']) },
      flags: [TRANSFER_PROGRAM(['--upload-pack'])],
    },
    push: {
      facts: fact('Sends the save points made here up to the server, where other people can see them.', {
        effect: ['read', 'transmit'],
        network: 'known-host',
        reversible: 'no',
        docs: GIT,
      }),
      values: valuesOf('text', ['--repo', '-o', '--push-option', '--recurse-submodules']),
      flags: [TRANSFER_PROGRAM(['--receive-pack', '--exec'])],
    },
    add: {
      facts: fact('Marks changed files to be included in the next save point.', { effect: ['write'], docs: GIT }),
      operands: ['path'],
      values: { '--chmod': 'text', '--pathspec-from-file': 'path' },
    },
    commit: {
      facts: fact('Makes a new save point from the changes that were marked.', {
        effect: ['create'],
        repeatSafe: false,
        docs: GIT,
      }),
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
        effect: ['write'],
        reversible: 'unknown',
        note: 'Changes that were never saved to a save point can be lost.',
        docs: GIT,
      }),
      values: { ...valuesOf('text', ['-b', '-B', '--orphan']), '--pathspec-from-file': 'path' },
    },
    restore: {
      facts: fact('Puts files back to the way they were at the last save point.', {
        effect: ['write'],
        reversible: 'no',
        note: 'Changes made to those files since then are lost.',
        docs: GIT,
      }),
      operands: ['path'],
      values: { ...valuesOf('text', ['-s', '--source', '--conflict']), '--pathspec-from-file': 'path' },
    },
    reset: {
      facts: fact('Moves a project back to an earlier save point.', {
        effect: ['write', 'delete'],
        reversible: 'no',
        note: 'Work that was never saved to a save point cannot be put back.',
        docs: GIT,
      }),
      values: { '--pathspec-from-file': 'path' },
    },
    clean: {
      facts: fact('Removes files sitting in the project folder that were never added to its history.', {
        effect: ['delete'],
        reversible: 'no',
        note: 'Those files do not go to the Bin and cannot be put back.',
        docs: GIT,
      }),
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
        effect: ['write'],
        repeatSafe: false,
        docs: GIT,
      }),
    },
    remote: {
      facts: fact('Shows or changes which servers a project sends its work to.', { effect: ['read', 'configure'], docs: GIT }),
    },
    config: {
      facts: fact('Shows or changes the settings a project uses, or the ones used across this computer.', {
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
    { effect: ['read', 'write', 'execute'], network: 'arbitrary', repeatSafe: false, docs },
  ),
  sub: {
    install: {
      facts: opaqueFact(
        'Downloads ready-made code packages from the internet and puts them into the project.',
        SETUP_STEPS,
        { effect: ['read', 'create', 'write', 'install'], network: 'arbitrary', docs },
      ),
      operands: ['package'],
    },
    i: {
      facts: opaqueFact(
        'Downloads ready-made code packages from the internet and puts them into the project.',
        SETUP_STEPS,
        { effect: ['read', 'create', 'write', 'install'], network: 'arbitrary', docs },
      ),
      operands: ['package'],
    },
    add: {
      facts: opaqueFact('Adds a ready-made code package from the internet to the project.', SETUP_STEPS, {
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
        { effect: ['read', 'create', 'write', 'delete', 'install'], network: 'arbitrary', docs },
      ),
    },
    update: {
      facts: opaqueFact('Downloads newer versions of the packages the project uses.', SETUP_STEPS, {
        effect: ['read', 'write', 'install'],
        network: 'arbitrary',
        docs,
      }),
      operands: ['package'],
    },
    uninstall: {
      facts: fact('Takes a ready-made code package out of the project.', {
        effect: ['delete', 'write'],
        reversible: 'unknown',
        docs,
      }),
      operands: ['package'],
    },
    remove: {
      facts: fact('Takes a ready-made code package out of the project.', {
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
        { effect: ['execute'], network: 'arbitrary', docs },
      ),
      operands: ['text'],
    },
    test: {
      facts: opaqueFact(
        'Runs the checks the project has written for itself.',
        'the command the project has saved for its checks',
        { effect: ['execute'], network: 'arbitrary', docs },
      ),
    },
    start: {
      facts: opaqueFact(
        'Starts the project the way the project itself says to start it.',
        'the command the project has saved for starting itself',
        { effect: ['execute'], network: 'arbitrary', docs },
      ),
    },
    publish: {
      facts: opaqueFact(
        'Sends the code in this folder to a public package service, where anyone can download it.',
        'the steps the project runs for itself before sending',
        { effect: ['read', 'transmit'], network: 'arbitrary', docs },
      ),
      flags: [{ flags: ['--otp'], takesValue: true, role: 'text', facts: { touchesCredentials: true } }],
    },
    list: { facts: fact('Lists the ready-made code packages the project uses.', { docs }) },
    ls: { facts: fact('Lists the ready-made code packages the project uses.', { docs }) },
    audit: {
      facts: fact('Asks the package service whether any package the project uses has a known fault.', {
        network: 'arbitrary',
        docs,
      }),
    },
  },
})

/**
 * npm and pnpm share their rows but not their flags: `-w` names a workspace in npm and is a bare switch in pnpm.
 * Both read their flags anywhere on the line, so every subcommand takes them, and the ones written before the
 * subcommand are stepped over to reach it.
 */
const nodePackager = (docs: string, values: Record<string, Role>, bare: string[]): Entry => {
  const rows = packagerRows(docs)
  const globals: FlagRule[] = [
    ...Object.entries(values).map(([flag, role]) => ({ flags: [flag], takesValue: true, role, facts: {} })),
    { flags: bare, facts: {} },
  ]
  const sub = Object.fromEntries(Object.entries(rows.sub!).map(([word, rule]) => [word, { ...rule, values: { ...values, ...rule.values } }]))
  return { ...rows, values, globals, sub }
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

// The paths `-v` and `--mount` name are inside the packaged program as well as on this computer, so they stay text.
const DOCKER_RUN_VALUES: Record<string, Role> = {
  ...valuesOf('path', ['--cidfile', '--label-file']),
  ...valuesOf('text', [
    '--add-host', '-a', '--attach', '--blkio-weight', '--blkio-weight-device', '--cap-add', '--cap-drop', '--cgroup-parent',
    '--cgroupns', '--cpu-period', '--cpu-quota', '--cpu-rt-period', '--cpu-rt-runtime', '-c', '--cpu-shares', '--cpus',
    '--cpuset-cpus', '--cpuset-mems', '--detach-keys', '--device', '--device-cgroup-rule', '--device-read-bps',
    '--device-read-iops', '--device-write-bps', '--device-write-iops', '--dns', '--dns-option', '--dns-search',
    '--domainname', '--entrypoint', '-e', '--env', '--expose', '--gpus', '--group-add', '--health-cmd',
    '--health-interval', '--health-retries', '--health-start-period', '--health-timeout', '-h', '--hostname', '--ip',
    '--ip6', '--ipc', '--isolation', '--kernel-memory', '-l', '--label', '--link', '--link-local-ip', '--log-driver',
    '--log-opt', '--mac-address', '-m', '--memory', '--memory-reservation', '--memory-swap', '--memory-swappiness',
    '--mount', '--name', '--network', '--network-alias', '--oom-score-adj', '--pid', '--pids-limit', '--platform', '-p',
    '--publish', '--pull', '--restart', '--runtime', '--security-opt', '--shm-size', '--stop-signal', '--stop-timeout',
    '--storage-opt', '--sysctl', '--tmpfs', '--ulimit', '-u', '--user', '--userns', '--uts', '--volume-driver',
    '--volumes-from', '-w', '--workdir',
  ]),
}

// A file of hidden settings, the kind that usually holds passwords and access keys for other services.
const ENV_FILE: FlagRule = { flags: ['--env-file'], takesValue: true, role: 'path', facts: { touchesCredentials: true } }

// The text cannot say whether a folder of this computer or a store of the packaged program's own is meant, so both are
// read as the wider one.
const VOLUME: FlagRule = {
  flags: ['-v', '--volume', '--mount'],
  takesValue: true,
  role: 'text',
  facts: {
    effect: ['read', 'write'],
    note: 'Folders on this computer that it is pointed at can be read and changed from inside it.',
  },
}

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
      effect: ['create', 'execute', 'install'],
      network: 'arbitrary',
      docs: COMPOSE,
    }),
    operands: ['text'],
    values: valuesOf('text', ['--scale', '-t', '--timeout', '--wait-timeout', '--exit-code-from', '--pull', '--attach', '--no-attach']),
  },
  down: {
    facts: fact('Stops and removes the packaged programs described together in one file.', {
      effect: ['terminate', 'delete'],
      reversible: 'no',
      docs: COMPOSE,
    }),
    operands: ['text'],
    values: valuesOf('text', ['-t', '--timeout', '--rmi']),
    flags: [COMPOSE_GONE],
  },
  ps: { facts: fact('Lists the packaged programs from one file, and whether each is running.', { docs: COMPOSE }), operands: ['text'], values: valuesOf('text', ['--format', '-f', '--filter', '--status']) },
  logs: { facts: fact('Shows what the packaged programs from one file have written as they ran.', { docs: COMPOSE }), operands: ['text'], values: valuesOf('text', ['--since', '--until', '-n', '--tail', '--index']) },
  config: {
    facts: fact('Shows the file the packaged programs are started from, with its settings filled in.', {
      touchesCredentials: true,
      note: 'Secrets set in the environment or in settings files are filled in, in readable form.',
      docs: COMPOSE,
    }),
    operands: ['text'],
    values: { ...valuesOf('text', ['--format', '--hash']), '-o': 'path', '--output': 'path' },
  },
  build: {
    facts: opaqueFact('Builds the packaged programs one file describes, from the steps written in their folders.', 'the steps written in those folders, which are not shown here', {
      effect: ['read', 'create', 'write', 'execute'],
      network: 'arbitrary',
      docs: COMPOSE,
    }),
    operands: ['text'],
    values: valuesOf('text', ['--build-arg', '--ssh', '--builder', '-m', '--memory', '--progress']),
  },
  pull: {
    facts: fact('Downloads the packaged programs one file names onto this computer.', { effect: ['read', 'create', 'install'], network: 'arbitrary', docs: COMPOSE }),
    operands: ['text'],
    values: valuesOf('text', ['--policy']),
  },
  push: {
    facts: fact('Sends the packaged programs one file names up to a service other people can reach.', {
      effect: ['read', 'transmit'],
      network: 'arbitrary',
      reversible: 'no',
      docs: COMPOSE,
    }),
    operands: ['text'],
  },
  exec: {
    facts: opaqueFact('Runs another command inside one of the packaged programs from one file that is already running.', 'the command it was given, which runs inside the packaged program', {
      effect: ['execute'],
      network: 'arbitrary',
      docs: COMPOSE,
    }),
    operands: ['text', 'command'],
    values: COMPOSE_INSIDE,
  },
  run: {
    facts: opaqueFact('Starts one of the packaged programs from one file to run a single command.', COMPOSED, {
      effect: ['create', 'execute'],
      network: 'arbitrary',
      docs: COMPOSE,
    }),
    operands: ['text', 'command'],
    values: { ...COMPOSE_INSIDE, ...valuesOf('text', ['-p', '--publish', '--name', '--entrypoint', '-l', '--label', '--cap-add', '--cap-drop']) },
    flags: [VOLUME, ENV_FILE],
  },
  start: {
    facts: opaqueFact('Starts the stopped packaged programs from one file again.', COMPOSED, { effect: ['execute'], network: 'arbitrary', docs: COMPOSE }),
    operands: ['text'],
  },
  restart: {
    facts: opaqueFact('Stops and starts again the packaged programs from one file.', COMPOSED, { effect: ['terminate', 'execute'], network: 'arbitrary', docs: COMPOSE }),
    operands: ['text'],
    values: valuesOf('text', ['-t', '--timeout']),
  },
  stop: {
    facts: fact('Stops the packaged programs from one file, keeping them to start again.', { effect: ['terminate'], docs: COMPOSE }),
    operands: ['text'],
    values: valuesOf('text', ['-t', '--timeout']),
  },
  kill: {
    facts: fact('Stops the packaged programs from one file at once, without letting them finish.', { effect: ['terminate'], docs: COMPOSE }),
    operands: ['text'],
    values: { '-s': 'signal', '--signal': 'signal' },
  },
  rm: {
    facts: fact('Removes the stopped packaged programs from one file.', { effect: ['delete'], reversible: 'no', docs: COMPOSE }),
    operands: ['text'],
    flags: [COMPOSE_GONE],
  },
  images: { facts: fact('Lists the packaged programs one file has stored on this computer.', { docs: COMPOSE }), operands: ['text'], values: valuesOf('text', ['--format']) },
  top: { facts: fact('Shows what is running inside the packaged programs from one file.', { docs: COMPOSE }), operands: ['text'] },
  ls: { facts: fact('Lists the sets of packaged programs running from files on this computer.', { docs: COMPOSE }), values: valuesOf('text', ['--format', '--filter']) },
  version: { facts: fact('Shows which version of the tool for files of packaged programs is installed.', { docs: COMPOSE }), values: valuesOf('text', ['-f', '--format']) },
}

const PY = 'https://pip.pypa.io/en/stable/cli/'

// Where pip looks for packages. A link page given to `-f` can be a folder here as well as an address, so it is text.
const PIP_INDEX_VALUES: Record<string, Role> = valuesOf('text', ['-i', '--index-url', '--extra-index-url', '-f', '--find-links'])

export const DEV: Record<string, Entry> = {
  git: GIT_ENTRY,
  npm: nodePackager('https://docs.npmjs.com/cli/commands', NPM_VALUES, ['-g', '--global', '--workspaces', '-s', '--silent', '-y', '--yes']),
  pnpm: nodePackager('https://pnpm.io/cli/add', PNPM_VALUES, ['-r', '--recursive', '-w', '--workspace-root', '-s', '--silent', '-g', '--global']),
  brew: {
    facts: opaqueFact(
      'Works with the programs installed on this computer through Homebrew.',
      'the set-up steps each program brings with it',
      { effect: ['read', 'write', 'execute'], network: 'arbitrary', repeatSafe: false, docs: 'man 1 brew' },
    ),
    sub: {
      install: {
        facts: opaqueFact(
          'Downloads a program from the internet and installs it on this computer.',
          'the set-up steps that program brings with it',
          { effect: ['read', 'create', 'write', 'install'], network: 'arbitrary', docs: 'man 1 brew' },
        ),
        operands: ['package'],
        values: BREW_INSTALL_VALUES,
      },
      reinstall: {
        facts: opaqueFact(
          'Removes an installed program and installs it again from the internet.',
          'the set-up steps that program brings with it',
          { effect: ['read', 'create', 'write', 'delete', 'install'], network: 'arbitrary', docs: 'man 1 brew' },
        ),
        operands: ['package'],
        values: BREW_INSTALL_VALUES,
      },
      uninstall: {
        facts: fact('Removes a program that was installed through Homebrew.', {
          effect: ['delete'],
          reversible: 'no',
          docs: 'man 1 brew',
        }),
        operands: ['package'],
      },
      update: {
        facts: fact('Refreshes the list of programs that can be installed, without installing anything.', {
          effect: ['read', 'write'],
          network: 'arbitrary',
          docs: 'man 1 brew',
        }),
      },
      upgrade: {
        facts: opaqueFact(
          'Downloads and installs newer versions of the programs installed through Homebrew.',
          'the set-up steps each program brings with it',
          { effect: ['read', 'write', 'install'], network: 'arbitrary', docs: 'man 1 brew' },
        ),
        operands: ['package'],
        values: BREW_INSTALL_VALUES,
      },
      list: { facts: fact('Lists the programs installed through Homebrew.', { docs: 'man 1 brew' }) },
      info: {
        facts: fact('Shows what a program is and whether it is installed.', { network: 'arbitrary', docs: 'man 1 brew' }),
        values: valuesOf('text', ['--days', '--category']),
      },
      search: { facts: fact('Looks for a program by name among the ones that can be installed.', { network: 'arbitrary', docs: 'man 1 brew' }) },
      doctor: { facts: fact('Checks whether Homebrew itself is set up properly on this computer.', { docs: 'man 1 brew' }) },
      cleanup: {
        facts: fact('Removes older versions of installed programs to free up room.', {
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
          { effect: ['configure', 'execute', 'terminate'], docs: 'man 1 brew' },
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
      { effect: ['read', 'write', 'execute'], network: 'arbitrary', repeatSafe: false, docs: PY },
    ),
    sub: {
      install: {
        facts: opaqueFact('Downloads ready-made Python code from the internet and installs it.', SETUP_STEPS, {
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
          effect: ['delete'],
          reversible: 'no',
          docs: PY,
        }),
        operands: ['package'],
      },
      download: {
        facts: fact('Downloads ready-made Python code from the internet without installing it.', {
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
        facts: fact('Lists the ready-made Python code packages installed here.', { docs: PY }),
        values: { ...PIP_INDEX_VALUES, '--path': 'path', '--exclude': 'package', '--format': 'text' },
      },
      show: { facts: fact('Shows the details of one installed Python code package.', { docs: PY }), operands: ['package'] },
      freeze: {
        facts: fact('Lists the installed Python code packages and their exact versions.', { docs: PY }),
        values: { '--path': 'path', '-r': 'path', '--requirement': 'path', '--exclude': 'package' },
      },
    },
  },
  node: {
    facts: opaqueFact(
      'Runs a program written in JavaScript.',
      'the JavaScript file it was given, whose contents are not shown here',
      { effect: ['execute'], network: 'arbitrary', docs: 'man 1 node' },
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
      { effect: ['execute'], network: 'arbitrary', docs: 'man 1 python3' },
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
      { effect: ['execute'], network: 'arbitrary', docs: 'man 1 sh' },
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
        effect: ['elevate', 'execute'],
        privilege: 'root',
        network: 'arbitrary',
        note: 'Whatever it runs can change anything here, including parts of macOS itself.',
        docs: 'man 8 sudo',
      },
    ),
    operands: ['command'],
    // `-h` is left out: on its own it asks for help, and only `--host=` gives it a value.
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
      { effect: ['execute'], network: 'arbitrary', docs: 'man 1 xargs' },
    ),
    operands: ['command'],
    values: valuesOf('text', ['-E', '-I', '-J', '-L', '-n', '-P', '-R', '-S', '-s']),
    nestedHere: true,
  },
  make: {
    facts: opaqueFact(
      'Carries out the build steps a project has written down for itself.',
      'the steps written in the project, which are not shown here',
      { effect: ['read', 'create', 'write', 'execute'], network: 'arbitrary', docs: 'man 1 make' },
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
        effect: ['read', 'write', 'execute'],
        note: 'Those instructions can change or remove records in the file, with no copy kept.',
        docs: 'man 1 sqlite3',
      },
    ),
    operands: ['path', 'command'],
    values: {
      '-init': 'path',
      ...valuesOf('text', ['-cmd', '-separator', '-nullvalue', '-newline', '-vfs', '-lookaside', '-mmap', '-pagecache']),
    },
  },
  docker: {
    facts: opaqueFact(
      'Works with programs that run in their own sealed-off copy of a system.',
      'the packaged program, whose contents were decided by whoever built it',
      { effect: ['read', 'write', 'execute'], network: 'arbitrary', repeatSafe: false, touchesCredentials: true, docs: 'https://docs.docker.com/reference/cli/docker/' },
    ),
    sub: {
      ps: {
        facts: fact('Lists the packaged programs running right now.', { docs: 'https://docs.docker.com/reference/cli/docker/' }),
        values: valuesOf('text', ['-f', '--filter', '--format', '-n', '--last']),
      },
      images: {
        facts: fact('Lists the packaged programs stored on this computer.', { docs: 'https://docs.docker.com/reference/cli/docker/' }),
        values: valuesOf('text', ['-f', '--filter', '--format']),
      },
      logs: {
        facts: fact('Shows what a packaged program has written as it ran.', { docs: 'https://docs.docker.com/reference/cli/docker/' }),
        operands: ['text'],
        values: valuesOf('text', ['--since', '-n', '--tail', '--until']),
      },
      run: {
        facts: opaqueFact(
          'Starts a packaged program in its own sealed-off copy of a system.',
          'the packaged program, whose contents were decided by whoever built it',
          { effect: ['create', 'execute'], network: 'arbitrary', docs: 'https://docs.docker.com/reference/cli/docker/' },
        ),
        operands: ['package', 'command'],
        values: DOCKER_RUN_VALUES,
        flags: [
          ENV_FILE,
          {
            flags: ['--privileged'],
            facts: {
              effect: ['elevate'],
              privilege: 'root',
              note: 'It is given full control of the system it runs on, so it is no longer sealed off from this computer.',
            },
          },
          VOLUME,
        ],
      },
      exec: {
        facts: opaqueFact(
          'Runs another command inside a packaged program that is already running.',
          'the command it was given, which runs inside the packaged program',
          { effect: ['execute'], network: 'arbitrary', docs: 'https://docs.docker.com/reference/cli/docker/' },
        ),
        operands: ['text', 'command'],
        values: valuesOf('text', ['--detach-keys', '-e', '--env', '-u', '--user', '-w', '--workdir']),
        flags: [ENV_FILE],
      },
      build: {
        facts: opaqueFact(
          'Builds a packaged program from the steps written in a folder.',
          'the steps written in that folder, which are not shown here',
          { effect: ['read', 'create', 'write', 'execute'], network: 'arbitrary', docs: 'https://docs.docker.com/reference/cli/docker/' },
        ),
        operands: ['path'],
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
          effect: ['read', 'create', 'install'],
          network: 'arbitrary',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['package'],
        values: { '--platform': 'text' },
      },
      push: {
        facts: fact('Sends a packaged program from this computer up to a service other people can reach.', {
          effect: ['read', 'transmit'],
          network: 'arbitrary',
          reversible: 'no',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['package'],
      },
      stop: {
        facts: fact('Stops a packaged program that is running.', {
          effect: ['terminate'],
          reversible: 'yes',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['text'],
        values: valuesOf('text', ['-t', '--time', '--timeout', '-s', '--signal']),
      },
      rm: {
        facts: fact('Removes a stopped packaged program and anything it had kept.', {
          effect: ['delete'],
          reversible: 'no',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['text'],
      },
      rmi: {
        facts: fact('Removes a stored packaged program from this computer.', {
          effect: ['delete'],
          reversible: 'no',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['package'],
      },
      compose: {
        facts: opaqueFact(
          'Starts or stops a set of packaged programs described together in one file.',
          'the packaged programs that file names, whose contents were decided by whoever built them',
          { effect: ['create', 'execute', 'terminate'], network: 'arbitrary', touchesCredentials: true, docs: 'https://docs.docker.com/reference/cli/docker/' },
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
      effect: ['read', 'create', 'write', 'delete', 'execute', 'terminate', 'install', 'transmit'],
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
