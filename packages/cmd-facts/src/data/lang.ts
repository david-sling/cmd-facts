import { fact, opaqueFact, valuesOf, LOCAL, LOOKS } from '../entry.ts'
import type { Entry, FlagRule, Role, Rule } from '../entry.ts'

// Every program here runs code the line does not show: a file, a project's own build steps, or the set-up steps a
// downloaded package brings. So every row is blind, and what it hands over to is named in the same plain words.

const SETUP = 'the set-up steps the downloaded packages bring with them'
const PROJECT_STEPS = 'the steps written inside the project and inside the packages it uses'

/** A program that runs a file written in one language, and can be handed the code on the line instead. */
const runtime = (language: string, docs: string, inline: string[] = [], extra: Partial<Entry> = {}): Entry => ({
  facts: opaqueFact(`Runs a program written in ${language}.`, `the ${language} file it was given, whose contents are not shown here`, {
    privilege: 'none', touchesCredentials: false,
    effect: ['execute'],
    network: 'arbitrary',
    docs,
  }),
  operands: ['path'],
  ...extra,
  flags: [
    ...(inline.length
      ? [
          {
            flags: inline,
            takesValue: true,
            role: 'command' as const,
            facts: { says: `Runs the ${language} instructions written straight into this command.` },
          },
        ]
      : []),
    ...(extra.flags ?? []),
  ],
})

/**
 * Options a tool reads wherever they are on the line, given to the base row and to every subcommand, so that their
 * values are never read as the thing the line runs or installs. A flag a subcommand already declares is left to it,
 * and `except` names the ones a subcommand spells the same but reads as a switch (`conda list -c`).
 */
const everywhere = (
  entry: Entry,
  values: Record<string, Role>,
  flags: FlagRule[] = [],
  except: Record<string, string[]> = {},
): Entry => ({
  ...entry,
  values: { ...values, ...entry.values },
  flags: [...(entry.flags ?? []), ...flags],
  sub: Object.fromEntries(
    Object.entries(entry.sub ?? {}).map(([word, rule]) => {
      const own = new Set([...(rule.flags ?? []).flatMap((f) => f.flags), ...(except[word] ?? [])])
      const given = Object.fromEntries(Object.entries(values).filter(([flag]) => !own.has(flag)))
      const added = flags.filter((f) => !f.flags.some((x) => own.has(x)))
      return [word, { ...rule, values: { ...given, ...rule.values }, flags: [...(rule.flags ?? []), ...added] }]
    }),
  ),
})

/** The base row of a tool that works with a project's packages: it can reach anything its subcommands can. */
// A package manager's base row stands in for its publish and sign-in commands, which use the registry sign-in it keeps.
const manager = (says: string, docs: string): Rule['facts'] =>
  opaqueFact(says, PROJECT_STEPS, { privilege: 'none', touchesCredentials: true, effect: ['read', 'write', 'execute'], network: 'arbitrary', repeatSafe: false, docs })

const installs = (says: string, docs: string): Rule => ({
  facts: opaqueFact(says, SETUP, { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'write', 'install'], network: 'arbitrary', docs }),
  operands: ['package'],
})

const removes = (says: string, docs: string): Rule => ({
  facts: fact(says, { ...LOCAL, repeatSafe: true, effect: ['delete', 'write'], reversible: 'unknown', docs }),
  operands: ['package'],
})

const script = (says: string, handsOverTo: string, docs: string): Rule => ({
  facts: opaqueFact(says, handsOverTo, { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', docs }),
  operands: ['text'],
})

/** A subcommand that runs another command, carried as separate words on this line, with the project's packages. */
const execs = (says: string, docs: string): Rule => ({
  facts: opaqueFact(says, 'the command it was given, which runs with the packages the project uses', {
    privilege: 'none', touchesCredentials: false,
    effect: ['execute'],
    network: 'arbitrary',
    docs,
  }),
  operands: ['command'],
  nestedHere: true,
})

const builds = (says: string, docs: string): Rule => ({
  facts: opaqueFact(says, 'the build steps written in the project, which are not shown here', {
    privilege: 'none', touchesCredentials: false,
    effect: ['read', 'create', 'write', 'execute'],
    network: 'arbitrary',
    docs,
  }),
})

const publishes = (says: string, docs: string): Rule => ({
  facts: opaqueFact(says, 'the steps the project runs for itself before sending', {
    privilege: 'none', touchesCredentials: false,
    effect: ['read', 'transmit'],
    network: 'arbitrary',
    reversible: 'no',
    docs,
  }),
  flags: [{ flags: ['--otp'], takesValue: true, role: 'text', facts: { touchesCredentials: true } } satisfies FlagRule],
})

const fetchesAndRuns = (docs: string): Entry => ({
  facts: opaqueFact(
    'Downloads a ready-made code package if it is not here already, and runs it.',
    'the package it runs, which can do anything a program on this computer can',
    { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'execute', 'install'], network: 'arbitrary', docs },
  ),
  operands: ['package', 'text'],
  values: { '-p': 'package', '--package': 'package' },
})

// The options each tool reads on every subcommand, so that their values are never read as what the line runs.
/** Where `cargo add` and `cargo install` take a package from, when not the public package service. */
const CARGO_SOURCE = {
  ...valuesOf('url', ['--git', '--index']),
  ...valuesOf('text', ['--branch', '--tag', '--rev', '--registry']),
  '--path': 'path',
} as const

const CARGO_VALUES = {
  ...valuesOf('path', ['--manifest-path', '--target-dir', '--out-dir', '--config']),
  ...valuesOf('text', [
    '-p', '--package', '--exclude', '-j', '--jobs', '--bin', '--example', '--test', '--bench', '--profile', '-F', '--features',
    '--target', '--message-format', '--color', '-Z', '--explain',
  ]),
}
const GO_VALUES = {
  ...valuesOf('path', ['-o', '-modfile', '-overlay', '-pkgdir', '-C']),
  ...valuesOf('text', [
    '-tags', '-p', '-asmflags', '-buildmode', '-compiler', '-gccgoflags', '-gcflags', '-installsuffix', '-ldflags', '-mod',
  ]),
}
// `-toolexec` and `-exec` name a program to run each step through; the rows are blind already, so they carry no more.
const GO_RUNS = { ...GO_VALUES, ...valuesOf('text', ['-toolexec', '-exec']) }
const YARN_VALUES = {
  '--registry': 'url',
  ...valuesOf('path', ['--cwd', '--global-folder', '--link-folder', '--modules-folder', '--preferred-cache-folder', '--cache-folder', '--use-yarnrc']),
  ...valuesOf('text', ['--mutex', '--emoji', '--proxy', '--https-proxy', '--network-concurrency', '--network-timeout']),
} as const
const YARN_OTP: FlagRule = { flags: ['--otp'], takesValue: true, role: 'text', facts: { touchesCredentials: true } }
const CONDA_VALUES = {
  ...valuesOf('path', ['-p', '--prefix', '--file', '--clone']),
  ...valuesOf('text', ['-n', '--name', '-c', '--channel', '--revision', '--repodata-fn']),
}
const PIPX_VALUES = valuesOf('text', ['--python', '-i', '--index-url', '--pip-args', '--suffix'])
const BUN_VALUES = { ...valuesOf('path', ['--cwd', '--cache-dir']), ...valuesOf('text', ['--backend', '--link-native-bins']) }

const GEM_INSTALL_VALUES = {
  ...valuesOf('path', ['-i', '--install-dir', '-n', '--bindir', '--build-root', '-g', '--file']),
  ...valuesOf('text', ['-v', '--version', '--platform', '--document', '-P', '--trust-policy', '--without', '-s', '--source']),
}

const YARN = 'https://yarnpkg.com/cli'
const BUN = 'https://bun.sh/docs/cli'
const CARGO = 'https://doc.rust-lang.org/cargo/commands/'
const GO = 'https://pkg.go.dev/cmd/go'
const GEM = 'https://guides.rubygems.org/command-reference/'
const BUNDLE = 'https://bundler.io/man/bundle.1.html'
const COMPOSER = 'https://getcomposer.org/doc/03-cli.md'
const POETRY = 'https://python-poetry.org/docs/cli/'
const CONDA = 'https://docs.conda.io/projects/conda/en/latest/commands/'

export const LANG: Record<string, Entry> = {
  npx: {
    ...fetchesAndRuns('https://docs.npmjs.com/cli/commands/npx'),
    values: {
      '-p': 'package',
      '--package': 'package',
      '--registry': 'url',
      ...valuesOf('path', ['--cache', '--userconfig']),
      ...valuesOf('text', ['-s', '--shell', '-n', '--node-arg']),
    },
    // The value is run as a line of its own, in place of a package.
    flags: [{ flags: ['-c', '--call'], takesValue: true, role: 'command', facts: {} }],
  },
  bunx: fetchesAndRuns(`${BUN}/bunx`),
  yarn: everywhere({
    facts: manager('Works with the ready-made code packages a project is built on.', YARN),
    values: YARN_VALUES,
    globals: [
      ...Object.entries(YARN_VALUES).map(([flag, role]): FlagRule => ({ flags: [flag], takesValue: true, role, facts: {} })),
      YARN_OTP,
    ],
    sub: {
      install: installs('Downloads the ready-made code packages a project lists and puts them into it.', YARN),
      add: installs('Adds a ready-made code package from the internet to the project.', YARN),
      upgrade: installs('Downloads newer versions of the packages the project uses.', YARN),
      up: installs('Downloads newer versions of the packages the project uses.', YARN),
      remove: removes('Takes a ready-made code package out of the project.', YARN),
      run: script('Runs one of the commands the project has saved under a short name.', 'the command the project has saved under that name', YARN),
      test: script('Runs the checks the project has written for itself.', 'the command the project has saved for its checks', YARN),
      start: script('Starts the project the way the project itself says to start it.', 'the command the project has saved for starting itself', YARN),
      exec: execs('Runs another command with the packages the project uses.', YARN),
      dlx: fetchesAndRuns(YARN),
      publish: publishes('Sends the code in this folder to a public package service, where anyone can download it.', YARN),
      info: { facts: fact('Shows the details of a ready-made code package.', { effect: ['read'], reversible: 'yes', privilege: 'none', touchesCredentials: false, repeatSafe: true, network: 'arbitrary', docs: YARN }), operands: ['package'] },
      why: { facts: fact('Shows why the project needs a given ready-made code package.', { ...LOOKS, docs: YARN }), operands: ['package'] },
    },
  }, YARN_VALUES, [YARN_OTP]),
  bun: everywhere({
    facts: opaqueFact(
      'Runs a program written in JavaScript or TypeScript, or works with the code packages a project uses.',
      PROJECT_STEPS,
      { privilege: 'none', touchesCredentials: true, effect: ['read', 'write', 'execute'], network: 'arbitrary', repeatSafe: false, docs: BUN },
    ),
    operands: ['path'],
    sub: {
      install: installs('Downloads the ready-made code packages a project lists and puts them into it.', BUN),
      i: installs('Downloads the ready-made code packages a project lists and puts them into it.', BUN),
      add: installs('Adds a ready-made code package from the internet to the project.', BUN),
      update: installs('Downloads newer versions of the packages the project uses.', BUN),
      remove: removes('Takes a ready-made code package out of the project.', BUN),
      run: script('Runs a program file, or one of the commands the project has saved under a short name.', 'the file or saved command it was given', BUN),
      test: {
        ...script('Runs the checks the project has written for itself.', 'the checks written in the project', BUN),
        values: {
          ...valuesOf('path', ['-r', '--preload', '--tsconfig-override']),
          '-t': 'pattern',
          '--test-name-pattern': 'pattern',
          ...valuesOf('text', [
            '--timeout', '--rerun-each', '--extension-order', '--jsx-factory', '--jsx-import-source', '--jsx-runtime', '--main-fields',
            '-d', '--define', '-e', '--external', '-l', '--loader', '-u', '--origin', '-p', '--port', '--target', '--install',
          ]),
        },
      },
      x: fetchesAndRuns(`${BUN}/bunx`),
      build: {
        ...builds('Bundles the code of a project into files that are ready to ship.', BUN),
        operands: ['path'],
        values: {
          ...valuesOf('path', ['-r', '--preload', '--tsconfig-override', '--outdir', '--outfile', '--root']),
          ...valuesOf('text', [
            '--extension-order', '--jsx-factory', '--jsx-import-source', '--jsx-runtime', '--main-fields', '-d', '--define',
            '-e', '--external', '-l', '--loader', '-u', '--origin', '-p', '--port', '--target', '--install', '--format',
            '--public-path', '--entry-naming', '--chunk-naming', '--asset-naming',
          ]),
        },
      },
      publish: publishes('Sends the code in this folder to a public package service, where anyone can download it.', BUN),
    },
  }, BUN_VALUES),
  deno: {
    facts: opaqueFact(
      'Runs a program written in JavaScript or TypeScript.',
      'the file it was given, whose contents are not shown here',
      { privilege: 'none', touchesCredentials: false, effect: ['execute'], network: 'arbitrary', repeatSafe: false, docs: 'https://docs.deno.com/runtime/reference/cli/' },
    ),
    operands: ['path'],
    sub: {
      run: script('Runs a program written in JavaScript or TypeScript.', 'the file it was given, whose contents are not shown here', 'https://docs.deno.com/runtime/reference/cli/run/'),
      task: script('Runs one of the commands the project has saved under a short name.', 'the command the project has saved under that name', 'https://docs.deno.com/runtime/reference/cli/task/'),
      test: script('Runs the checks the project has written for itself.', 'the checks written in the project', 'https://docs.deno.com/runtime/reference/cli/test/'),
      install: installs('Downloads a ready-made code package and installs it, here or as a program anyone on this computer can run.', 'https://docs.deno.com/runtime/reference/cli/install/'),
      fmt: {
        facts: fact('Tidies the layout of the code in a project, rewriting the files in place.', {
          ...LOCAL, repeatSafe: true,
          effect: ['read', 'write'],
          reversible: 'no',
          docs: 'https://docs.deno.com/runtime/reference/cli/fmt/',
        }),
        operands: ['path'],
      },
    },
  },
  cargo: everywhere({
    facts: manager('Builds, runs or tests a project written in Rust, or adds ready-made code packages to it.', CARGO),
    sub: {
      build: builds('Builds a project written in Rust into a program.', CARGO),
      b: builds('Builds a project written in Rust into a program.', CARGO),
      check: builds('Checks a project written in Rust for mistakes without finishing the build.', CARGO),
      c: builds('Checks a project written in Rust for mistakes without finishing the build.', CARGO),
      run: script('Builds a project written in Rust and runs the program it makes.', 'the program the project builds, and the build steps written in it', CARGO),
      r: script('Builds a project written in Rust and runs the program it makes.', 'the program the project builds, and the build steps written in it', CARGO),
      test: script('Builds a project written in Rust and runs the checks it has written for itself.', 'the checks and build steps written in the project', CARGO),
      t: script('Builds a project written in Rust and runs the checks it has written for itself.', 'the checks and build steps written in the project', CARGO),
      add: {
        ...installs('Adds a ready-made code package from the internet to the project.', CARGO),
        values: { ...CARGO_SOURCE, '--rename': 'text' },
      },
      install: {
        ...installs('Downloads and builds a program written in Rust, and installs it for this account.', CARGO),
        values: { ...CARGO_SOURCE, '--version': 'text', '--root': 'path', '--index': 'url' },
      },
      update: {
        ...installs('Downloads newer versions of the packages the project uses.', CARGO),
        values: { '--precise': 'text' },
      },
      remove: removes('Takes a ready-made code package out of the project.', CARGO),
      fmt: {
        facts: fact('Tidies the layout of the code in a project, rewriting the files in place.', { ...LOCAL, repeatSafe: true, effect: ['read', 'write'], reversible: 'no', docs: CARGO }),
      },
      publish: {
        ...publishes('Sends the code in this folder to a public package service, where anyone can download it.', CARGO),
        values: { '--index': 'url', '--registry': 'text' },
        flags: [{ flags: ['--token'], takesValue: true, role: 'text', facts: { touchesCredentials: true } }],
      },
    },
  }, CARGO_VALUES),
  go: everywhere({
    facts: manager('Builds, runs or tests a project written in Go, or fetches the code packages it uses.', GO),
    sub: {
      build: builds('Builds a project written in Go into a program.', GO),
      run: script('Builds a program written in Go and runs it.', 'the program it builds, whose code is not shown here', GO),
      test: script('Builds a project written in Go and runs the checks it has written for itself.', 'the checks written in the project', GO),
      install: installs('Downloads and builds a program written in Go, and installs it for this account.', GO),
      get: installs('Adds a ready-made code package from the internet to the project.', GO),
      generate: script('Runs the steps a project has written into its code for making more code.', 'the commands written into the project for making code', GO),
      fmt: {
        facts: fact('Tidies the layout of the code in a project, rewriting the files in place.', { ...LOCAL, repeatSafe: true, effect: ['read', 'write'], reversible: 'no', docs: GO }),
        operands: ['path'],
      },
      vet: builds('Checks a project written in Go for likely mistakes.', GO),
      version: { facts: fact('Shows which version of the Go tools is installed.', { ...LOOKS, docs: GO }) },
      env: { facts: fact('Shows the settings the Go tools are using.', { ...LOOKS, docs: GO }) },
    },
  }, GO_RUNS),
  ruby: runtime('Ruby', 'man 1 ruby', ['-e'], {
    values: { '-C': 'path', '-I': 'path', '-r': 'package' },
    // Each of these takes its value only written onto the letter (`-0777`, `-x./dir`), and stands alone otherwise.
    flags: [{ flags: ['-0', '-x', '-K', '-T', '-F'], attached: true, role: 'text', facts: {} }],
  }),
  perl: runtime('Perl', 'man 1 perl', ['-e', '-E']),
  php: runtime('PHP', 'https://www.php.net/manual/en/features.commandline.options.php', ['-r'], { values: { '-f': 'path', '-c': 'path', '-d': 'text' } }),
  java: runtime('Java', 'man 1 java', [], {
    values: valuesOf('text', ['-cp', '-classpath', '--class-path', '-p', '--module-path', '-m', '--module']),
    flags: [{ flags: ['-jar'], takesValue: true, role: 'path', facts: { says: 'Runs a program written in Java, packed into one file.' } }],
    flagStyle: 'words',
  }),
  swift: runtime('Swift', 'https://www.swift.org/documentation/'),
  gem: {
    facts: manager('Works with the ready-made Ruby code packages installed on this computer.', GEM),
    sub: {
      install: { ...installs('Downloads ready-made Ruby code from the internet and installs it.', GEM), values: GEM_INSTALL_VALUES },
      update: { ...installs('Downloads newer versions of the installed Ruby code packages.', GEM), values: GEM_INSTALL_VALUES },
      uninstall: { ...removes('Removes a ready-made Ruby code package from this computer.', GEM), values: GEM_INSTALL_VALUES },
      // Here `-i` asks whether a package is installed, so it stands alone.
      list: { facts: fact('Lists the ready-made Ruby code packages installed here.', { ...LOOKS, docs: GEM }), values: valuesOf('text', ['-v', '--version', '-B', '--bulk-threshold', '-s', '--source']) },
    },
  },
  bundle: {
    facts: manager('Installs the ready-made Ruby code packages a project lists, or runs a command with them.', BUNDLE),
    sub: {
      install: {
        ...installs('Downloads the ready-made Ruby code packages a project lists and installs them.', BUNDLE),
        values: {
          ...valuesOf('path', ['--binstubs', '--gemfile', '--path']),
          ...valuesOf('text', ['--jobs', '-j', '--retry', '--shebang', '--trust-policy', '--with', '--without']),
        },
      },
      update: {
        ...installs('Downloads newer versions of the Ruby code packages the project uses.', BUNDLE),
        values: valuesOf('text', ['-g', '--group', '--source', '-j', '--jobs', '--retry']),
      },
      add: installs('Adds a ready-made Ruby code package to the project.', BUNDLE),
      exec: execs('Runs another command with the Ruby code packages the project uses.', BUNDLE),
    },
  },
  composer: {
    facts: manager('Works with the ready-made PHP code packages a project uses.', COMPOSER),
    values: { '-d': 'path', '--working-dir': 'path' },
    sub: {
      install: installs('Downloads the ready-made PHP code packages a project lists and puts them into it.', COMPOSER),
      update: installs('Downloads newer versions of the PHP code packages the project uses.', COMPOSER),
      require: installs('Adds a ready-made PHP code package from the internet to the project.', COMPOSER),
      remove: removes('Takes a ready-made PHP code package out of the project.', COMPOSER),
      'run-script': script('Runs one of the commands the project has saved under a short name.', 'the command the project has saved under that name', COMPOSER),
      run: script('Runs one of the commands the project has saved under a short name.', 'the command the project has saved under that name', COMPOSER),
    },
  },
  pipx: everywhere({
    facts: opaqueFact(
      'Installs a program written in Python into a space of its own, or runs one without installing it.',
      SETUP,
      { privilege: 'none', touchesCredentials: false, effect: ['read', 'create', 'write', 'install', 'execute'], network: 'arbitrary', repeatSafe: false, docs: 'https://pipx.pypa.io/stable/docs/' },
    ),
    sub: {
      install: installs('Downloads a program written in Python and installs it into a space of its own.', 'https://pipx.pypa.io/stable/docs/'),
      run: { ...fetchesAndRuns('https://pipx.pypa.io/stable/docs/'), values: { '--spec': 'package' } },
      uninstall: removes('Removes a program written in Python that was installed into a space of its own.', 'https://pipx.pypa.io/stable/docs/'),
      list: { facts: fact('Lists the programs written in Python installed into spaces of their own.', { ...LOOKS, docs: 'https://pipx.pypa.io/stable/docs/' }) },
    },
  }, PIPX_VALUES),
  poetry: everywhere({
    facts: manager('Works with the ready-made Python code packages a project uses, and the space it runs in.', POETRY),
    sub: {
      install: installs('Downloads the ready-made Python code packages a project lists and installs them.', POETRY),
      add: installs('Adds a ready-made Python code package to the project.', POETRY),
      update: installs('Downloads newer versions of the Python code packages the project uses.', POETRY),
      remove: removes('Takes a ready-made Python code package out of the project.', POETRY),
      run: execs('Runs another command with the Python code packages the project uses.', POETRY),
      build: builds('Packs a Python project into files that are ready to share.', POETRY),
      publish: publishes('Sends a Python project to a public package service, where anyone can download it.', POETRY),
    },
    globals: [{ flags: ['-C', '--directory'], takesValue: true, role: 'path', facts: {} }],
  }, { '-C': 'path', '--directory': 'path' }),
  conda: everywhere({
    facts: manager('Works with ready-made code packages and the separate spaces they are installed into.', CONDA),
    sub: {
      install: installs('Downloads ready-made code packages from the internet and installs them.', CONDA),
      update: installs('Downloads newer versions of installed code packages.', CONDA),
      create: installs('Makes a new separate space and installs ready-made code packages into it.', CONDA),
      remove: removes('Removes ready-made code packages, or a whole separate space of them.', CONDA),
      list: { facts: fact('Lists the ready-made code packages installed in a space.', { ...LOOKS, docs: CONDA }) },
      run: execs('Runs another command inside one of the separate spaces of code packages.', CONDA),
    },
  }, CONDA_VALUES, [], { list: ['-c', '--canonical'] }),
  xcodebuild: {
    facts: opaqueFact('Builds an app project made with Xcode.', 'the build steps written in the project, which are not shown here', {
      privilege: 'none', touchesCredentials: false,
      effect: ['read', 'create', 'write', 'execute'],
      network: 'arbitrary',
      docs: 'man 1 xcodebuild',
    }),
    flagStyle: 'words',
    values: {
      ...valuesOf('path', [
        '-workspace', '-project', '-derivedDataPath', '-archivePath', '-exportPath', '-exportOptionsPlist', '-xcconfig',
        '-resultBundlePath', '-resultStreamPath', '-clonedSourcePackagesDirPath', '-localizationPath', '-xcroot', '-xctestrun',
      ]),
      ...valuesOf('text', [
        '-scheme', '-target', '-configuration', '-sdk', '-destination', '-arch', '-toolchain', '-destination-timeout', '-jobs',
        '-maximum-concurrent-test-device-destinations', '-maximum-concurrent-test-simulator-destinations',
        '-parallel-testing-enabled', '-parallel-testing-worker-count', '-maximum-parallel-testing-workers', '-find-executable',
        '-find-library', '-enableAddressSanitizer', '-enableThreadSanitizer', '-enableUndefinedBehaviorSanitizer',
        '-resultBundleVersion', '-enableCodeCoverage', '-exportLanguage', '-testPlan', '-test-timeouts-enabled',
        '-default-test-execution-time-allowance', '-maximum-test-execution-time-allowance', '-scmProvider',
      ]),
    },
    operands: ['text'],
  },
  xcrun: {
    facts: opaqueFact('Finds one of the developer tools that come with Xcode and runs it.', 'the developer tool it was given, and what that tool is asked to do', {
      privilege: 'none', touchesCredentials: false,
      effect: ['execute'],
      network: 'arbitrary',
      docs: 'man 1 xcrun',
    }),
    operands: ['command'],
    values: { '--sdk': 'text', '--toolchain': 'text' },
    nestedHere: true,
  },
  cmake: {
    ...builds('Prepares the build steps for a project, or carries them out.', 'https://cmake.org/cmake/help/latest/manual/cmake.1.html'),
    operands: ['path'],
    values: {
      ...valuesOf('path', ['-S', '-B', '-C', '--install-prefix', '--trace-source', '--trace-redirect']),
      '-U': 'pattern',
      ...valuesOf('text', ['-D', '-G', '-T', '-A', '--preset', '--log-level', '--trace-format']),
    },
    flags: [{ flags: ['-Werror', '-Wno-error'], attached: true, role: 'text', facts: {} }],
  },
  ninja: builds('Carries out the build steps a project has written down for itself.', 'https://ninja-build.org/manual.html'),
}
