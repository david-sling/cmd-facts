import { fact, opaqueFact, LOCAL, LOOKS } from '../entry.ts'
import type { Entry } from '../entry.ts'

const GIT = 'man 1 git'
const SETUP_STEPS = 'the set-up steps the downloaded packages bring with them'

export const GIT_ENTRY: Entry = {
  facts: fact('Works with the saved history of a project kept on this computer.', {
    privilege: 'none', touchesCredentials: false,
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
    status: { facts: fact('Shows which files in a project have changed since its last save point.', { ...LOOKS, docs: GIT }) },
    log: { facts: fact('Shows the list of save points a project has, newest first.', { ...LOOKS, docs: GIT }) },
    diff: { facts: fact('Shows exactly what changed in the files of a project since its last save point.', { ...LOOKS, docs: GIT }) },
    show: { facts: fact('Shows what one save point in a project changed.', { ...LOOKS, docs: GIT }) },
    branch: { facts: fact('Lists or sets up the separate lines of work a project keeps.', { ...LOCAL, reversible: 'yes', repeatSafe: true, effect: ['read', 'write'], docs: GIT }) },
    clone: {
      facts: fact('Copies a project from a server onto this computer.', {
        reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true,
        effect: ['read', 'create'],
        network: 'known-host',
        docs: GIT,
      }),
      operands: ['url', 'path'],
    },
    fetch: {
      facts: fact('Collects the latest changes from the server without touching the files you see.', {
        reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true,
        effect: ['read', 'write'],
        network: 'known-host',
        docs: GIT,
      }),
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
    },
    push: {
      facts: fact('Sends the save points made here up to the server, where other people can see them.', {
        privilege: 'none', touchesCredentials: false, repeatSafe: true,
        effect: ['read', 'transmit'],
        network: 'known-host',
        reversible: 'no',
        docs: GIT,
      }),
    },
    add: { facts: fact('Marks changed files to be included in the next save point.', { ...LOCAL, reversible: 'yes', repeatSafe: true, effect: ['write'], docs: GIT }), operands: ['path'] },
    commit: {
      facts: fact('Makes a new save point from the changes that were marked.', {
        ...LOCAL, reversible: 'yes',
        effect: ['create'],
        repeatSafe: false,
        docs: GIT,
      }),
    },
    checkout: {
      facts: fact('Switches the files you see to another version of the project.', {
        ...LOCAL, repeatSafe: true,
        effect: ['write'],
        reversible: 'unknown',
        note: 'Changes that were never saved to a save point can be lost.',
        docs: GIT,
      }),
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
    },
    reset: {
      facts: fact('Moves a project back to an earlier save point.', {
        ...LOCAL, repeatSafe: true,
        effect: ['write', 'delete'],
        reversible: 'no',
        note: 'Work that was never saved to a save point cannot be put back.',
        docs: GIT,
      }),
    },
    clean: {
      facts: fact('Removes files sitting in the project folder that were never added to its history.', {
        ...LOCAL, repeatSafe: true,
        effect: ['delete'],
        reversible: 'no',
        note: 'Those files do not go to the Bin and cannot be put back.',
        docs: GIT,
      }),
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
    },
    config: {
      facts: fact('Shows or changes the settings a project uses, or the ones used across this computer.', {
        ...LOCAL, repeatSafe: true,
        effect: ['read', 'configure'],
        reversible: 'unknown',
        docs: GIT,
      }),
    },
  },
}

const nodePackager = (docs: string): Entry => ({
  facts: opaqueFact(
    'Works with the ready-made code packages a project is built on.',
    'the steps written inside the project and inside the packages it uses',
    { privilege: 'none', touchesCredentials: false, effect: ['read', 'write', 'execute'], network: 'arbitrary', repeatSafe: false, docs },
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
      facts: opaqueFact(
        'Sends the code in this folder to a public package service, where anyone can download it.',
        'the steps the project runs for itself before sending',
        { privilege: 'none', touchesCredentials: false, effect: ['read', 'transmit'], network: 'arbitrary', docs },
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

const PY = 'https://pip.pypa.io/en/stable/cli/'

export const DEV: Record<string, Entry> = {
  git: GIT_ENTRY,
  npm: nodePackager('https://docs.npmjs.com/cli/commands'),
  pnpm: nodePackager('https://pnpm.io/cli/add'),
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
      },
      reinstall: {
        facts: opaqueFact(
          'Removes an installed program and installs it again from the internet.',
          'the set-up steps that program brings with it',
          { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'write', 'delete', 'install'], network: 'arbitrary', docs: 'man 1 brew' },
        ),
        operands: ['package'],
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
      },
      list: { facts: fact('Lists the programs installed through Homebrew.', { ...LOOKS, docs: 'man 1 brew' }) },
      info: { facts: fact('Shows what a program is and whether it is installed.', { effect: ['read'], reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true, network: 'arbitrary', docs: 'man 1 brew' }) },
      search: { facts: fact('Looks for a program by name among the ones that can be installed.', { effect: ['read'], reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true, network: 'arbitrary', docs: 'man 1 brew' }) },
      doctor: { facts: fact('Checks whether Homebrew itself is set up properly on this computer.', { ...LOOKS, docs: 'man 1 brew' }) },
      cleanup: {
        facts: fact('Removes older versions of installed programs to free up room.', {
          ...LOCAL, repeatSafe: true,
          effect: ['delete'],
          reversible: 'no',
          docs: 'man 1 brew',
        }),
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
      },
      list: { facts: fact('Lists the ready-made Python code packages installed here.', { ...LOOKS, docs: PY }) },
      show: { facts: fact('Shows the details of one installed Python code package.', { ...LOOKS, docs: PY }), operands: ['package'] },
      freeze: { facts: fact('Lists the installed Python code packages and their exact versions.', { ...LOOKS, docs: PY }) },
    },
  },
  node: {
    facts: opaqueFact(
      'Runs a program written in JavaScript.',
      'the JavaScript file it was given, whose contents are not shown here',
      { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs: 'man 1 node' },
    ),
    operands: ['path'],
    values: { '-e': 'command', '--eval': 'command', '-p': 'command' },
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
    values: { '-u': 'user', '--user': 'user' },
    nestedHere: true,
  },
  xargs: {
    facts: opaqueFact(
      'Runs another command once for each line of text it is handed.',
      'the command it was given, which it runs once per line',
      { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs: 'man 1 xargs' },
    ),
    operands: ['command'],
    nestedHere: true,
  },
  make: {
    facts: opaqueFact(
      'Carries out the build steps a project has written down for itself.',
      'the steps written in the project, which are not shown here',
      { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'write', 'execute'], network: 'arbitrary', docs: 'man 1 make' },
    ),
    operands: ['text'],
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
  },
  docker: {
    facts: opaqueFact(
      'Works with programs that run in their own sealed-off copy of a system.',
      'the packaged program, whose contents were decided by whoever built it',
      { privilege: 'none', touchesCredentials: false, effect: ['read', 'write', 'execute'], network: 'arbitrary', repeatSafe: false, docs: 'https://docs.docker.com/reference/cli/docker/' },
    ),
    sub: {
      ps: { facts: fact('Lists the packaged programs running right now.', { ...LOOKS, docs: 'https://docs.docker.com/reference/cli/docker/' }) },
      images: { facts: fact('Lists the packaged programs stored on this computer.', { ...LOOKS, docs: 'https://docs.docker.com/reference/cli/docker/' }) },
      logs: { facts: fact('Shows what a packaged program has written as it ran.', { ...LOOKS, docs: 'https://docs.docker.com/reference/cli/docker/' }), operands: ['text'] },
      run: {
        facts: opaqueFact(
          'Starts a packaged program in its own sealed-off copy of a system.',
          'the packaged program, whose contents were decided by whoever built it',
          { privilege: 'none', touchesCredentials: false, effect: ['create', 'execute'], network: 'arbitrary', docs: 'https://docs.docker.com/reference/cli/docker/' },
        ),
        operands: ['package', 'command'],
      },
      exec: {
        facts: opaqueFact(
          'Runs another command inside a packaged program that is already running.',
          'the command it was given, which runs inside the packaged program',
          { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs: 'https://docs.docker.com/reference/cli/docker/' },
        ),
        operands: ['text', 'command'],
      },
      build: {
        facts: opaqueFact(
          'Builds a packaged program from the steps written in a folder.',
          'the steps written in that folder, which are not shown here',
          { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'write', 'execute'], network: 'arbitrary', docs: 'https://docs.docker.com/reference/cli/docker/' },
        ),
        operands: ['path'],
      },
      pull: {
        facts: fact('Downloads a packaged program from the internet onto this computer.', {
          reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true,
          effect: ['read', 'create', 'install'],
          network: 'arbitrary',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['package'],
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
      },
      stop: {
        facts: fact('Stops a packaged program that is running.', {
          ...LOCAL, repeatSafe: true,
          effect: ['terminate'],
          reversible: 'yes',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['text'],
      },
      rm: {
        facts: fact('Removes a stopped packaged program and anything it had kept.', {
          ...LOCAL, repeatSafe: true,
          effect: ['delete'],
          reversible: 'no',
          docs: 'https://docs.docker.com/reference/cli/docker/',
        }),
        operands: ['text'],
      },
      rmi: {
        facts: fact('Removes a stored packaged program from this computer.', {
          ...LOCAL, repeatSafe: true,
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
          { privilege: 'none', touchesCredentials: false, effect: ['create', 'execute', 'terminate'], network: 'arbitrary', docs: 'https://docs.docker.com/reference/cli/docker/' },
        ),
        operands: ['text'],
      },
    },
  },
}
