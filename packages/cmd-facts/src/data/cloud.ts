import { fact, opaqueFact, valuesOf } from '../entry.ts'
import type { Entry, FlagRule, Role } from '../entry.ts'
import type { Effect, Facts } from '../facts.ts'
import { everywhere, globalsOf } from './shared.ts'

// Tools that act on services and clusters somewhere else. What they change is on another computer, so a removal
// there is as final as one here, and the reach is the service the tool talks to, not the open internet.

type Over = Parameters<typeof fact>[1]

/** Reads from the service and changes nothing. */
const reads = (says: string, docs: string, over: Over = {}): Facts => fact(says, { network: 'known-host', docs, ...over })

/** Changes something on the service. Two runs are not the same as one unless the row says so. */
const changes = (says: string, docs: string, effect: Effect[], over: Over = {}): Facts =>
  fact(says, { effect, network: 'known-host', reversible: 'unknown', repeatSafe: false, docs, ...over })

/** Removes something from the service for good. */
const removes = (says: string, docs: string, over: Over = {}): Facts =>
  fact(says, { effect: ['delete'], network: 'known-host', reversible: 'no', docs, ...over })

const SHOWN = 'Once shown, it is readable by anyone who can see what this command prints, and it can act as the account.'

// ── GitHub ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const GH = 'https://cli.github.com/manual/'

// Which project on GitHub a command works on, read before or after the subcommand.
const GH_REPO = valuesOf('text', ['-R', '--repo'])
const GH_BODY = { ...valuesOf('text', ['-b', '--body']), ...valuesOf('path', ['-F', '--body-file']) }
const GH_FORMAT = valuesOf('text', ['--json', '-q', '--jq', '-t', '--template'])
const GH_LIST = { ...GH_FORMAT, ...valuesOf('text', ['-L', '--limit', '-l', '--label', '-A', '--author', '-a', '--assignee', '-S', '--search', '-s', '--state', '--app', '-m', '--milestone', '--mention']) }
const GH_FILED = {
  ...valuesOf('text', ['-t', '--title', '-a', '--assignee', '-l', '--label', '-m', '--milestone', '-p', '--project', '-T', '--template', '--recover']),
  ...GH_BODY,
}
const GH_EDITS = valuesOf('text', [
  '--add-assignee', '--remove-assignee', '--add-label', '--remove-label', '--add-project', '--remove-project', '--remove-milestone',
])
const GH_GONE_BRANCH: FlagRule = {
  flags: ['-d', '--delete-branch'],
  facts: { effect: ['delete'], note: 'The line of work the pull request came from is removed as well.' },
}

const GH_ENTRY: Entry = everywhere(
  {
    facts: opaqueFact(
      'Works with projects, pull requests and issues on GitHub.',
      'add-on commands installed for it, which can do anything a program on this computer can',
      {
        effect: ['read', 'create', 'write', 'delete', 'transmit', 'execute', 'configure'],
        network: 'arbitrary',
        reversible: 'no',
        touchesCredentials: true,
        docs: GH,
      },
    ),
    globals: globalsOf(GH_REPO),
    sub: {
      pr: { facts: changes('Works with the pull requests of a project on GitHub.', GH, ['read', 'create', 'write', 'transmit'], { reversible: 'no' }) },
      'pr list': { facts: reads('Lists the pull requests of a project on GitHub.', GH), values: { ...GH_LIST, ...valuesOf('text', ['-B', '--base', '-H', '--head']) } },
      'pr view': { facts: reads('Shows one pull request on GitHub, with its description and discussion.', GH), operands: ['text'], values: GH_FORMAT },
      'pr diff': { facts: reads('Shows the changes a pull request on GitHub would make.', GH), operands: ['text'], values: valuesOf('text', ['--color']) },
      'pr checks': { facts: reads('Shows whether the automatic checks on a pull request passed.', GH), operands: ['text'], values: { ...GH_FORMAT, '-i': 'text', '--interval': 'text' } },
      'pr status': { facts: reads('Shows the pull requests that involve the signed-in account.', GH), values: GH_FORMAT },
      'pr create': {
        facts: changes('Opens a new pull request on GitHub, which tells the people watching the project.', GH, ['create', 'transmit'], { reversible: 'no' }),
        values: { ...GH_FILED, ...valuesOf('text', ['-B', '--base', '-H', '--head', '-r', '--reviewer']) },
      },
      'pr merge': {
        facts: changes('Merges a pull request into its project on GitHub.', GH, ['write', 'transmit'], { reversible: 'no' }),
        operands: ['text'],
        values: { ...valuesOf('text', ['-t', '--subject', '--author-email', '--match-head-commit']), ...GH_BODY },
        flags: [GH_GONE_BRANCH, { flags: ['--admin'], facts: { note: 'It goes ahead even where the project asks for reviews or checks first.' } }],
      },
      'pr close': {
        facts: changes('Closes a pull request on GitHub without merging it.', GH, ['write', 'transmit'], { reversible: 'yes' }),
        operands: ['text'],
        values: valuesOf('text', ['-c', '--comment']),
        flags: [{ ...GH_GONE_BRANCH, facts: { ...GH_GONE_BRANCH.facts, reversible: 'no' } }],
      },
      'pr reopen': { facts: changes('Opens a closed pull request on GitHub again.', GH, ['write', 'transmit'], { reversible: 'yes', repeatSafe: true }), operands: ['text'], values: valuesOf('text', ['-c', '--comment']) },
      'pr ready': { facts: changes('Marks a draft pull request on GitHub as ready for review.', GH, ['write', 'transmit'], { reversible: 'yes', repeatSafe: true }), operands: ['text'] },
      'pr edit': {
        facts: changes('Changes the title, description or labels of a pull request on GitHub.', GH, ['write', 'transmit']),
        operands: ['text'],
        values: { ...GH_FILED, ...GH_EDITS, '-B': 'text', '--base': 'text', '--add-reviewer': 'text', '--remove-reviewer': 'text' },
      },
      'pr comment': { facts: changes('Adds a comment to a pull request on GitHub, which tells the people watching it.', GH, ['create', 'transmit'], { reversible: 'no' }), operands: ['text'], values: GH_BODY },
      'pr review': {
        facts: changes('Approves a pull request on GitHub, asks for changes, or comments on it.', GH, ['create', 'transmit'], { reversible: 'no' }),
        operands: ['text'],
        values: GH_BODY,
      },
      'pr checkout': {
        facts: changes('Switches the files in this project folder to the changes in a pull request.', GH, ['create', 'write']),
        operands: ['text'],
        values: valuesOf('text', ['-b', '--branch']),
        flags: [{ flags: ['-f', '--force'], facts: { effect: ['delete'], reversible: 'no', note: 'Changes here that were not saved in the history are overwritten.' } }],
      },

      issue: { facts: changes('Works with the issues filed on a project on GitHub.', GH, ['read', 'create', 'write', 'delete', 'transmit'], { reversible: 'no' }) },
      'issue list': { facts: reads('Lists the issues filed on a project on GitHub.', GH), values: GH_LIST },
      'issue view': { facts: reads('Shows one issue on GitHub, with its discussion.', GH), operands: ['text'], values: GH_FORMAT },
      'issue status': { facts: reads('Shows the issues that involve the signed-in account.', GH), values: GH_FORMAT },
      'issue create': { facts: changes('Files a new issue on a project on GitHub, which tells the people watching it.', GH, ['create', 'transmit'], { reversible: 'no' }), values: GH_FILED },
      'issue comment': { facts: changes('Adds a comment to an issue on GitHub, which tells the people watching it.', GH, ['create', 'transmit'], { reversible: 'no' }), operands: ['text'], values: GH_BODY },
      'issue edit': {
        facts: changes('Changes the title, description or labels of an issue on GitHub.', GH, ['write', 'transmit']),
        operands: ['text'],
        values: { ...GH_FILED, ...GH_EDITS },
      },
      'issue close': {
        facts: changes('Closes an issue on GitHub.', GH, ['write', 'transmit'], { reversible: 'yes' }),
        operands: ['text'],
        values: valuesOf('text', ['-c', '--comment', '-r', '--reason']),
      },
      'issue reopen': { facts: changes('Opens a closed issue on GitHub again.', GH, ['write', 'transmit'], { reversible: 'yes', repeatSafe: true }), operands: ['text'], values: valuesOf('text', ['-c', '--comment']) },
      'issue delete': { facts: removes('Removes an issue from GitHub for good, with its discussion.', GH), operands: ['text'] },

      repo: {
        facts: opaqueFact('Works with projects on GitHub, or copies one onto this computer.', 'the copying program, which is also handed any words after a double dash', {
          effect: ['read', 'create', 'write', 'delete', 'transmit', 'configure'],
          network: 'known-host',
          reversible: 'no',
          docs: GH,
        }),
      },
      'repo view': { facts: reads('Shows the description and main page of a project on GitHub.', GH), operands: ['text'], values: { ...GH_FORMAT, '-b': 'text', '--branch': 'text' } },
      'repo list': { facts: reads('Lists the projects an account or organisation has on GitHub.', GH), operands: ['text'], values: { ...GH_FORMAT, ...valuesOf('text', ['-L', '--limit', '-l', '--language', '--topic', '--visibility']) } },
      'repo clone': {
        facts: opaqueFact('Copies a project from GitHub onto this computer.', 'the copying program, which is also handed any words after a double dash', {
          effect: ['read', 'create'],
          network: 'known-host',
          docs: GH,
        }),
        operands: ['text', 'path', 'text'],
        values: valuesOf('text', ['-u', '--upstream-remote-name']),
      },
      'repo create': {
        facts: changes('Makes a new project on GitHub, and can copy the files of a folder here up to it.', GH, ['create', 'transmit']),
        operands: ['text'],
        values: {
          ...valuesOf('text', ['-d', '--description', '-t', '--team', '-p', '--template', '-r', '--remote', '-g', '--gitignore', '-l', '--license']),
          '-h': 'url',
          '--homepage': 'url',
          '-s': 'path',
          '--source': 'path',
        },
        flags: [{ flags: ['--public'], facts: { reversible: 'no', note: 'The project and everything copied up to it can be seen by anyone.' } }],
      },
      'repo delete': {
        facts: removes('Removes a project from GitHub for good, with its history, issues and pull requests.', GH),
        operands: ['text'],
        flags: [{ flags: ['--yes'], facts: { note: 'It does not ask before removing the project.' } }],
      },
      'repo fork': {
        facts: changes('Makes a copy of a project on GitHub under the signed-in account, and can copy it onto this computer.', GH, ['create', 'transmit']),
        operands: ['text'],
        values: valuesOf('text', ['--fork-name', '--org', '--remote-name']),
      },
      'repo edit': {
        facts: changes('Changes the settings of a project on GitHub, including who can see it.', GH, ['configure', 'transmit'], { repeatSafe: true }),
        operands: ['text'],
        values: valuesOf('text', ['-d', '--description', '-h', '--homepage', '--default-branch', '--add-topic', '--remove-topic']),
        flags: [
          {
            flags: ['--visibility'],
            takesValue: true,
            role: 'text',
            facts: { reversible: 'no', note: 'A project made public shows its whole history to anyone, who can keep a copy.' },
          },
        ],
      },
      'repo archive': { facts: changes('Marks a project on GitHub as finished, so no one can change it.', GH, ['configure', 'transmit'], { reversible: 'yes', repeatSafe: true }), operands: ['text'] },
      'repo rename': { facts: changes('Gives a project on GitHub a new name.', GH, ['configure', 'transmit']), operands: ['text'] },

      release: { facts: changes('Works with the published versions of a project on GitHub.', GH, ['read', 'create', 'write', 'delete', 'transmit'], { reversible: 'no' }) },
      'release list': { facts: reads('Lists the published versions of a project on GitHub.', GH), values: { ...GH_FORMAT, '-L': 'text', '--limit': 'text' } },
      'release view': { facts: reads('Shows one published version of a project on GitHub.', GH), operands: ['text'], values: GH_FORMAT },
      'release create': {
        facts: changes('Publishes a new version of a project on GitHub, with any files given attached for anyone to download.', GH, ['create', 'transmit'], { reversible: 'no' }),
        operands: ['text', 'path'],
        values: {
          ...valuesOf('text', ['-t', '--title', '-n', '--notes', '--target', '--discussion-category', '--notes-start-tag']),
          '-F': 'path',
          '--notes-file': 'path',
        },
      },
      'release upload': {
        facts: changes('Attaches files to a published version of a project on GitHub, for anyone to download.', GH, ['create', 'transmit'], { reversible: 'no' }),
        operands: ['text', 'path'],
      },
      'release download': {
        facts: changes('Downloads the files attached to a published version of a project on GitHub.', GH, ['create', 'write']),
        operands: ['text'],
        values: { ...valuesOf('path', ['-D', '--dir', '-O', '--output']), '-p': 'pattern', '--pattern': 'pattern', '-A': 'text', '--archive': 'text' },
      },
      'release delete': {
        facts: removes('Removes a published version of a project from GitHub.', GH),
        operands: ['text'],
        flags: [{ flags: ['--cleanup-tag'], facts: { note: 'The marker in the history that it was published from is removed too.' } }],
      },

      run: {
        facts: opaqueFact('Works with the automated jobs that run for a project on GitHub.', 'the automated steps written in the project, which are not shown here', {
          effect: ['read', 'create', 'delete', 'execute', 'terminate', 'transmit'],
          network: 'known-host',
          reversible: 'no',
          docs: GH,
        }),
      },
      'run list': {
        facts: reads('Lists the recent automated jobs of a project on GitHub.', GH),
        values: { ...GH_FORMAT, ...valuesOf('text', ['-L', '--limit', '-w', '--workflow', '-b', '--branch', '-u', '--user', '-e', '--event', '-s', '--status', '-c', '--commit', '--created']) },
      },
      'run view': { facts: reads('Shows how one automated job of a project on GitHub went.', GH), operands: ['text'], values: { ...GH_FORMAT, '-j': 'text', '--job': 'text', '-a': 'text', '--attempt': 'text' } },
      'run watch': { facts: reads('Follows an automated job of a project on GitHub until it finishes.', GH), operands: ['text'], values: valuesOf('text', ['-i', '--interval']) },
      'run rerun': {
        facts: opaqueFact('Runs an automated job of a project on GitHub again.', 'the automated steps written in the project, which are not shown here', {
          effect: ['execute'],
          network: 'known-host',
          docs: GH,
        }),
        operands: ['text'],
        values: valuesOf('text', ['-j', '--job']),
      },
      'run cancel': { facts: changes('Stops an automated job of a project on GitHub before it finishes.', GH, ['terminate', 'transmit'], { reversible: 'no', repeatSafe: true }), operands: ['text'] },
      'run delete': { facts: removes('Removes the record of an automated job from a project on GitHub.', GH), operands: ['text'] },
      'run download': {
        facts: changes('Downloads the files an automated job of a project on GitHub saved.', GH, ['create', 'write']),
        operands: ['text'],
        values: { ...valuesOf('path', ['-D', '--dir']), ...valuesOf('text', ['-n', '--name']), '-p': 'pattern', '--pattern': 'pattern' },
      },
      workflow: {
        facts: opaqueFact('Lists, starts, or turns on and off the automated jobs of a project on GitHub.', 'the automated steps written in the project, which are not shown here', {
          effect: ['read', 'execute', 'configure'],
          network: 'known-host',
          docs: GH,
        }),
        operands: ['text'],
        values: valuesOf('text', ['-r', '--ref', '-f', '--raw-field', '-F', '--field']),
      },
      'workflow list': { facts: reads('Lists the automated jobs a project on GitHub has set up.', GH), values: { ...GH_FORMAT, '-L': 'text', '--limit': 'text' } },
      'workflow view': { facts: reads('Shows one of the automated jobs a project on GitHub has set up.', GH), operands: ['text'], values: { ...GH_FORMAT, '-r': 'text', '--ref': 'text' } },

      auth: {
        facts: fact('Signs in to GitHub, signs out, or shows which account is signed in.', {
          effect: ['read', 'configure', 'delete'],
          touchesCredentials: true,
          reversible: 'unknown',
          repeatSafe: false,
          network: 'known-host',
          docs: GH,
        }),
        values: { '-h': 'host', '--hostname': 'host', '-u': 'text', '--user': 'text', '-s': 'text', '--scopes': 'text' },
      },
      'auth status': {
        facts: reads('Shows which GitHub accounts are signed in on this computer.', GH),
        values: { '-h': 'host', '--hostname': 'host', ...GH_FORMAT },
        flags: [{ flags: ['-t', '--show-token'], facts: { touchesCredentials: true, note: `It shows the key each account signs in with. ${SHOWN}` } }],
      },
      'auth token': {
        facts: fact('Shows the key the signed-in GitHub account uses, in readable form.', {
          touchesCredentials: true,
          note: SHOWN,
          docs: GH,
        }),
        values: { '-h': 'host', '--hostname': 'host', '-u': 'text', '--user': 'text' },
      },
      'auth login': {
        facts: fact('Signs in to GitHub and keeps the sign-in on this computer.', {
          effect: ['create', 'configure'],
          touchesCredentials: true,
          network: 'known-host',
          docs: GH,
        }),
        values: { '-h': 'host', '--hostname': 'host', ...valuesOf('text', ['-s', '--scopes', '-p', '--git-protocol']) },
        flags: [{ flags: ['--insecure-storage'], facts: { note: 'The sign-in key is saved in a plain file rather than the locked store this computer keeps.' } }],
      },
      'auth logout': {
        facts: fact('Signs out of GitHub and removes the saved sign-in from this computer.', {
          effect: ['delete', 'configure'],
          touchesCredentials: true,
          reversible: 'unknown',
          docs: GH,
        }),
        values: { '-h': 'host', '--hostname': 'host', '-u': 'text', '--user': 'text' },
      },
      'auth setup-git': {
        facts: fact('Lets the other programs on this computer that copy projects sign in to GitHub with the saved account.', {
          effect: ['configure'],
          touchesCredentials: true,
          docs: GH,
        }),
        values: { '-h': 'host', '--hostname': 'host' },
      },

      secret: {
        facts: changes('Works with the secrets GitHub keeps for the automated jobs of a project.', GH, ['read', 'create', 'write', 'delete', 'transmit'], {
          touchesCredentials: true,
          reversible: 'no',
        }),
      },
      'secret list': { facts: reads('Lists the names of the secrets GitHub keeps for a project, without their contents.', GH), values: { ...GH_FORMAT, ...valuesOf('text', ['-e', '--env', '-o', '--org', '-u', '--user', '-a', '--app']) } },
      'secret set': {
        facts: changes('Saves a secret on GitHub for automated jobs to use, in place of any with the same name.', GH, ['create', 'write', 'transmit'], {
          touchesCredentials: true,
          reversible: 'no',
          repeatSafe: true,
        }),
        operands: ['text'],
        values: valuesOf('text', ['-e', '--env', '-o', '--org', '-v', '--visibility', '-r', '--repos', '-a', '--app', '-u', '--user']),
        flags: [
          {
            flags: ['-b', '--body'],
            takesValue: true,
            role: 'text',
            facts: { note: 'The secret is written on the line itself, where it can be seen and kept in the history of commands.' },
          },
          { flags: ['-f', '--env-file'], takesValue: true, role: 'path', facts: {} },
        ],
      },
      'secret delete': {
        facts: removes('Removes a secret GitHub keeps for the automated jobs of a project.', GH, { touchesCredentials: true }),
        operands: ['text'],
        values: valuesOf('text', ['-e', '--env', '-o', '--org', '-a', '--app', '-u', '--user']),
      },

      api: {
        facts: changes('Sends any request to GitHub as the signed-in account, including ones that change or remove things.', GH, ['read', 'create', 'write', 'delete', 'transmit'], {
          reversible: 'no',
        }),
        operands: ['text'],
        values: {
          ...valuesOf('text', ['-X', '--method', '-f', '--raw-field', '-F', '--field', '-H', '--header', '-q', '--jq', '-t', '--template', '-p', '--preview', '--cache']),
          '--input': 'path',
          '--hostname': 'host',
        },
      },
      extension: {
        facts: opaqueFact('Installs, removes or runs add-on commands other people have written for this tool.', 'the add-on, which can do anything a program on this computer can', {
          effect: ['read', 'install', 'delete', 'execute'],
          network: 'arbitrary',
          docs: GH,
        }),
        operands: ['text'],
      },
      'extension list': { facts: fact('Lists the add-on commands installed for this tool.', { docs: GH }) },
      'extension install': {
        facts: fact('Downloads an add-on command someone else wrote for this tool and installs it.', {
          effect: ['create', 'install'],
          network: 'arbitrary',
          reversible: 'unknown',
          note: 'Once installed, it runs as a command of its own, with the reach of any program on this computer.',
          docs: GH,
        }),
        operands: ['text'],
        values: valuesOf('text', ['--pin']),
      },
      gist: { facts: changes('Works with gists, the small sets of files GitHub keeps for sharing.', GH, ['read', 'create', 'write', 'delete', 'transmit'], { reversible: 'no' }) },
      'gist list': { facts: reads('Lists the gists of the signed-in account.', GH), values: valuesOf('text', ['-L', '--limit']) },
      'gist view': { facts: reads('Shows the files of one gist on GitHub.', GH), operands: ['text'], values: valuesOf('text', ['-f', '--filename']) },
      'gist create': {
        facts: changes('Uploads files to GitHub as a gist, which anyone with its link can see.', GH, ['create', 'transmit'], { reversible: 'no' }),
        operands: ['path'],
        values: valuesOf('text', ['-d', '--desc', '-f', '--filename']),
        flags: [{ flags: ['-p', '--public'], facts: { note: 'It is listed publicly, not only reachable by its link.' } }],
      },
      'gist delete': { facts: removes('Removes a gist from GitHub.', GH), operands: ['text'] },
      'ssh-key': {
        facts: changes('Lists, adds or removes the keys that can sign in as the GitHub account.', GH, ['read', 'configure', 'delete', 'transmit'], { touchesCredentials: true }),
      },
      'ssh-key list': { facts: reads('Lists the keys that can sign in as the GitHub account.', GH) },
      'ssh-key add': {
        facts: changes('Adds a key to the GitHub account, so whoever holds its private half can act as the account.', GH, ['configure', 'transmit'], {
          touchesCredentials: true,
        }),
        operands: ['path'],
        values: valuesOf('text', ['-t', '--title', '--type']),
      },
      browse: { facts: reads('Opens a project on GitHub in the web browser.', GH), operands: ['text'], values: valuesOf('text', ['-b', '--branch']) },
      search: { facts: reads('Searches GitHub for projects, issues, pull requests or code.', GH), operands: ['text'], values: { ...GH_FORMAT, '-L': 'text', '--limit': 'text' } },
      status: { facts: reads('Shows the pull requests, issues and mentions that involve the signed-in account.', GH), values: valuesOf('text', ['-o', '--org', '-e', '--exclude']) },
      codespace: {
        facts: opaqueFact('Works with the cloud computers GitHub runs for writing code, and connects to them.', 'whatever is run on the cloud computer it connects to', {
          effect: ['create', 'delete', 'execute', 'transmit'],
          network: 'known-host',
          reversible: 'no',
          docs: GH,
        }),
        operands: ['text'],
      },
      config: {
        facts: fact('Shows or changes the settings this tool uses.', { effect: ['read', 'configure'], docs: GH }),
        operands: ['text'],
        values: { '-h': 'host', '--host': 'host' },
      },
    },
  },
  GH_REPO,
)

// ── Kubernetes ─────────────────────────────────────────────────────────────────────────────────────────────────────

const KUBE = 'https://kubernetes.io/docs/reference/kubectl/'

const KUBE_VALUES: Record<string, Role> = {
  ...valuesOf('text', [
    '-n', '--namespace', '--context', '--cluster', '--user', '--username', '--as', '--as-group', '--as-uid', '--request-timeout',
    '--tls-server-name', '--profile', '-v', '--v', '--vmodule', '--log-flush-frequency',
  ]),
  ...valuesOf('path', ['--kubeconfig', '--cache-dir', '--certificate-authority', '--client-certificate', '--profile-output']),
  '-s': 'url',
  '--server': 'url',
}
const KUBE_KEYS: FlagRule[] = [
  { flags: ['--token', '--password'], takesValue: true, role: 'text', facts: { touchesCredentials: true } },
  { flags: ['--client-key'], takesValue: true, role: 'path', facts: { touchesCredentials: true } },
  { flags: ['--insecure-skip-tls-verify'], facts: { note: 'It does not check that the cluster is the one it claims to be.' } },
]

// `-f` names a file, a folder or an address to read from, so it is text.
const KUBE_FILES = valuesOf('text', ['-f', '--filename', '-k', '--kustomize'])
const KUBE_PICK = valuesOf('text', ['-l', '--selector', '--field-selector', '-o', '--output', '--template', '--sort-by', '-L', '--label-columns'])
// A value for these only counts written on with `=`: `--dry-run` alone means `--dry-run=client`, and the next word is
// what the line points at.
const KUBE_ATTACHED: FlagRule = { flags: ['--dry-run', '--cascade'], attached: true, role: 'text', facts: {} }
const KUBE_ALL: FlagRule = {
  flags: ['--all', '-A', '--all-namespaces'],
  facts: { note: 'Everything of that kind goes, not one named item.' },
}

const KUBECTL: Entry = everywhere(
  {
    facts: opaqueFact(
      'Works with the programs and settings running on a Kubernetes cluster.',
      'whatever the cluster is told to run, or an add-on command installed under this name',
      {
        effect: ['read', 'create', 'write', 'delete', 'execute', 'configure', 'terminate'],
        network: 'arbitrary',
        reversible: 'no',
        touchesCredentials: true,
        docs: KUBE,
      },
    ),
    globals: globalsOf(KUBE_VALUES, KUBE_KEYS),
    sub: {
      get: {
        facts: reads('Lists what is running on a Kubernetes cluster, or shows one item in detail.', KUBE, {
          touchesCredentials: true,
          note: 'The secrets kept in the cluster can be shown in readable form with it.',
        }),
        operands: ['text'],
        values: { ...KUBE_FILES, ...KUBE_PICK, '--chunk-size': 'text' },
      },
      describe: {
        facts: reads('Shows one item on a Kubernetes cluster in detail, with what has happened to it lately.', KUBE),
        operands: ['text'],
        values: { ...KUBE_FILES, ...valuesOf('text', ['-l', '--selector', '--chunk-size']) },
      },
      logs: {
        facts: reads('Shows what a program running on a Kubernetes cluster has written as it ran.', KUBE),
        operands: ['text'],
        values: valuesOf('text', [
          '-c', '--container', '--since', '--since-time', '--tail', '-l', '--selector', '--max-log-requests', '--pod-running-timeout', '--limit-bytes',
        ]),
      },
      top: { facts: reads('Shows how much memory and processor time the programs on a Kubernetes cluster are using.', KUBE), operands: ['text'], values: KUBE_PICK },
      events: { facts: reads('Lists what has happened lately on a Kubernetes cluster.', KUBE), values: { ...KUBE_PICK, '--for': 'text', '--types': 'text' } },
      explain: {
        facts: reads('Describes one kind of item a Kubernetes cluster can hold, and its settings.', KUBE),
        operands: ['text'],
        values: valuesOf('text', ['--api-version', '-o', '--output']),
      },
      version: { facts: reads('Shows the versions of this tool and of the Kubernetes cluster it talks to.', KUBE), values: valuesOf('text', ['-o', '--output']) },
      'cluster-info': { facts: reads('Shows the addresses of a Kubernetes cluster and its main services.', KUBE) },
      'api-resources': { facts: reads('Lists the kinds of item a Kubernetes cluster can hold.', KUBE), values: { ...KUBE_PICK, '--api-group': 'text', '--verbs': 'text' } },
      diff: {
        facts: reads('Shows what would change on a Kubernetes cluster if the files given were applied.', KUBE),
        values: { ...KUBE_FILES, ...KUBE_PICK, '--field-manager': 'text' },
      },
      wait: { facts: reads('Waits until items on a Kubernetes cluster reach a given state.', KUBE), operands: ['text'], values: { ...KUBE_FILES, ...KUBE_PICK, '--for': 'text', '--timeout': 'text' } },
      apply: {
        facts: opaqueFact('Changes what runs on a Kubernetes cluster to match the files it is pointed at.', 'the files it was pointed at, whose contents are not shown here', {
          effect: ['create', 'write', 'configure', 'execute'],
          network: 'known-host',
          docs: KUBE,
        }),
        values: {
          ...KUBE_FILES,
          ...KUBE_PICK,
          ...valuesOf('text', ['--field-manager', '--prune-allowlist', '--prune-whitelist', '--resource-version', '--grace-period', '--timeout']),
        },
        flags: [{ flags: ['--prune'], facts: { effect: ['delete'], reversible: 'no', note: 'Anything on the cluster the files no longer list can be removed.' } }],
      },
      create: {
        facts: opaqueFact('Adds new items to a Kubernetes cluster, from files or from the words on this line.', 'the files it was pointed at, whose contents are not shown here', {
          effect: ['create', 'execute'],
          network: 'known-host',
          touchesCredentials: true,
          docs: KUBE,
        }),
        operands: ['text'],
        values: { ...KUBE_FILES, ...KUBE_PICK, '--image': 'package', '--field-manager': 'text' },
      },
      'create secret': {
        facts: changes('Saves a secret on a Kubernetes cluster for the programs on it to use.', KUBE, ['create'], { touchesCredentials: true }),
        operands: ['text'],
        values: { ...KUBE_PICK, ...valuesOf('path', ['--from-file', '--from-env-file']), ...valuesOf('text', ['--type', '--cert', '--key', '--docker-server', '--docker-username', '--docker-email']) },
        flags: [
          {
            flags: ['--from-literal', '--docker-password'],
            takesValue: true,
            role: 'text',
            facts: { note: 'The secret is written on the line itself, where it can be seen and kept in the history of commands.' },
          },
        ],
      },
      'create token': {
        facts: fact('Makes a new key that can act as an account on a Kubernetes cluster, and shows it.', {
          effect: ['create'],
          network: 'known-host',
          touchesCredentials: true,
          reversible: 'unknown',
          repeatSafe: false,
          note: SHOWN,
          docs: KUBE,
        }),
        operands: ['text'],
        values: valuesOf('text', ['--duration', '--audience', '--bound-object-kind', '--bound-object-name', '--bound-object-uid', '-o', '--output']),
      },
      delete: {
        facts: removes('Removes items from a Kubernetes cluster, and stops what they were running.', KUBE, { effect: ['delete', 'terminate'] }),
        operands: ['text'],
        values: { ...KUBE_FILES, ...KUBE_PICK, ...valuesOf('text', ['--grace-period', '--timeout']) },
        flags: [KUBE_ALL, { flags: ['--force'], facts: { note: 'Programs are stopped at once, without the time they would normally get to finish.' } }],
      },
      exec: {
        facts: opaqueFact('Runs a command inside a program that is already running on a Kubernetes cluster.', 'the command it was given, which runs inside the cluster', {
          effect: ['execute'],
          network: 'known-host',
          docs: KUBE,
        }),
        operands: ['text', 'command'],
        values: { ...valuesOf('text', ['-c', '--container', '--pod-running-timeout']), ...KUBE_FILES },
      },
      run: {
        facts: opaqueFact('Starts a program on a Kubernetes cluster from a packaged copy of it.', 'the packaged program, whose contents were decided by whoever built it', {
          effect: ['create', 'execute'],
          network: 'known-host',
          docs: KUBE,
        }),
        operands: ['text', 'command'],
        values: {
          '--image': 'package',
          ...KUBE_FILES,
          ...valuesOf('text', [
            '--env', '--port', '-l', '--labels', '--overrides', '--restart', '--image-pull-policy', '--annotations', '--pod-running-timeout',
            '-o', '--output', '--template', '--grace-period', '--hostport', '--limits', '--requests', '--serviceaccount', '--timeout',
          ]),
        },
      },
      debug: {
        facts: opaqueFact('Starts a program on a Kubernetes cluster for looking into a running program or one of its computers.', 'the packaged program it starts, and whatever is run inside it', {
          effect: ['create', 'execute'],
          network: 'known-host',
          note: 'Pointed at one of the cluster computers, the program it starts can reach everything on that computer.',
          docs: KUBE,
        }),
        operands: ['text', 'command'],
        values: valuesOf('text', ['--image', '-c', '--container', '--target', '--profile', '--copy-to', '--env', '-f', '--filename']),
      },
      'port-forward': {
        facts: fact('Passes connections made on this computer through to a program on a Kubernetes cluster.', {
          effect: ['read', 'transmit'],
          network: 'listens',
          docs: KUBE,
        }),
        operands: ['text'],
        values: valuesOf('text', ['--address', '--pod-running-timeout']),
      },
      proxy: {
        facts: fact('Accepts connections on this computer and passes them on to a Kubernetes cluster, signed in as this account.', {
          effect: ['read', 'transmit'],
          network: 'listens',
          note: 'Anything that can connect to it acts on the cluster with this account’s access.',
          docs: KUBE,
        }),
        values: {
          ...valuesOf('text', [
            '-p', '--port', '--address', '--accept-hosts', '--reject-paths', '--accept-paths', '--api-prefix', '-P', '--www-prefix', '--keepalive',
            '--reject-methods',
          ]),
          ...valuesOf('path', ['-w', '--www', '-u', '--unix-socket']),
        },
      },
      cp: {
        facts: fact('Copies files between this computer and a program running on a Kubernetes cluster.', {
          effect: ['read', 'create', 'write', 'transmit'],
          network: 'known-host',
          reversible: 'no',
          docs: KUBE,
        }),
        operands: ['text'],
        values: valuesOf('text', ['-c', '--container', '--retries']),
      },
      scale: {
        facts: changes('Changes how many copies of a program a Kubernetes cluster runs.', KUBE, ['configure', 'terminate'], { repeatSafe: true }),
        operands: ['text'],
        values: { ...KUBE_FILES, ...KUBE_PICK, ...valuesOf('text', ['--replicas', '--current-replicas', '--resource-version', '--timeout']) },
      },
      rollout: {
        facts: changes('Restarts, pauses or rolls back the programs on a Kubernetes cluster, or shows how a change is going.', KUBE, ['read', 'write', 'terminate']),
        operands: ['text'],
        values: { ...KUBE_FILES, ...KUBE_PICK, ...valuesOf('text', ['--to-revision', '--revision', '--timeout']) },
      },
      'rollout status': { facts: reads('Shows how a change to the programs on a Kubernetes cluster is going.', KUBE), operands: ['text'], values: { ...KUBE_FILES, ...KUBE_PICK, '--revision': 'text', '--timeout': 'text' } },
      'rollout history': { facts: reads('Lists the earlier versions of a program on a Kubernetes cluster.', KUBE), operands: ['text'], values: { ...KUBE_FILES, ...KUBE_PICK, '--revision': 'text' } },
      patch: {
        facts: changes('Changes part of an item on a Kubernetes cluster in place.', KUBE, ['write']),
        operands: ['text'],
        values: { ...KUBE_FILES, ...KUBE_PICK, ...valuesOf('text', ['-p', '--patch', '--type', '--subresource', '--field-manager']), '--patch-file': 'path' },
      },
      label: {
        facts: changes('Adds, changes or removes the labels on items on a Kubernetes cluster.', KUBE, ['write'], { repeatSafe: true }),
        operands: ['text'],
        values: { ...KUBE_FILES, ...KUBE_PICK, '--resource-version': 'text' },
      },
      annotate: {
        facts: changes('Adds, changes or removes the notes on items on a Kubernetes cluster.', KUBE, ['write'], { repeatSafe: true }),
        operands: ['text'],
        values: { ...KUBE_FILES, ...KUBE_PICK, '--resource-version': 'text' },
      },
      edit: {
        facts: opaqueFact('Opens an item on a Kubernetes cluster in a text editor, and saves the changes back.', 'the text editor set up on this computer', {
          effect: ['write', 'execute'],
          network: 'known-host',
          docs: KUBE,
        }),
        operands: ['text'],
        values: { ...KUBE_FILES, ...KUBE_PICK, '--field-manager': 'text', '--subresource': 'text' },
      },
      drain: {
        facts: changes('Moves every program off one of the computers in a Kubernetes cluster, and keeps new ones away from it.', KUBE, ['configure', 'terminate']),
        operands: ['text'],
        values: valuesOf('text', ['--grace-period', '--timeout', '-l', '--selector', '--pod-selector', '--skip-wait-for-delete-timeout']),
        flags: [{ flags: ['--delete-emptydir-data'], facts: { effect: ['delete'], reversible: 'no', note: 'Data the moved programs kept on that computer is lost.' } }],
      },
      cordon: { facts: changes('Keeps new programs away from one of the computers in a Kubernetes cluster.', KUBE, ['configure'], { reversible: 'yes', repeatSafe: true }), operands: ['text'], values: valuesOf('text', ['-l', '--selector']) },
      uncordon: { facts: changes('Lets new programs go to one of the computers in a Kubernetes cluster again.', KUBE, ['configure'], { reversible: 'yes', repeatSafe: true }), operands: ['text'], values: valuesOf('text', ['-l', '--selector']) },
      config: {
        facts: fact('Shows or changes which Kubernetes cluster this computer talks to, and the sign-in details kept for it.', {
          effect: ['read', 'configure', 'delete'],
          touchesCredentials: true,
          reversible: 'unknown',
          repeatSafe: false,
          docs: KUBE,
        }),
        operands: ['text'],
      },
      'config view': {
        facts: fact('Shows the saved Kubernetes settings, with the keys hidden unless asked for.', { docs: KUBE }),
        values: valuesOf('text', ['-o', '--output', '--template']),
        flags: [{ flags: ['--raw'], facts: { touchesCredentials: true, note: `The keys and passwords are shown in readable form. ${SHOWN}` } }],
      },
      'config get-contexts': { facts: fact('Lists the Kubernetes clusters and accounts this computer has saved.', { docs: KUBE }), operands: ['text'], values: valuesOf('text', ['-o', '--output']) },
      'config current-context': { facts: fact('Shows which saved Kubernetes cluster and account later commands use.', { docs: KUBE }) },
      'config use-context': {
        facts: fact('Switches which saved Kubernetes cluster and account later commands use.', { effect: ['configure'], docs: KUBE }),
        operands: ['text'],
      },
      auth: { facts: reads('Checks what the signed-in account is allowed to do on a Kubernetes cluster.', KUBE), operands: ['text'], values: { '-n': 'text', '--namespace': 'text', ...valuesOf('text', ['--subresource', '-o', '--output']) } },
      plugin: { facts: fact('Lists the add-on commands installed for this tool.', { docs: KUBE }) },
    },
  },
  KUBE_VALUES,
  [...KUBE_KEYS, KUBE_ATTACHED],
)

export const CLOUD: Record<string, Entry> = {
  gh: GH_ENTRY,
  kubectl: KUBECTL,
}

