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

const SHOWN = 'Once shown, it is readable by anyone who can see what this command prints.'
// For a sign-in key, which is worth more than what it unlocks once: it is the account.
const KEY_SHOWN = 'Once shown, it is readable by anyone who can see what this command prints, and it can act as the account.'

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
        flags: [{ flags: ['-t', '--show-token'], facts: { touchesCredentials: true, note: `It shows the key each account signs in with. ${KEY_SHOWN}` } }],
      },
      'auth token': {
        facts: fact('Shows the key the signed-in GitHub account uses, in readable form.', {
          touchesCredentials: true,
          note: KEY_SHOWN,
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
          note: KEY_SHOWN,
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
          note: "Anything that can connect to it acts on the cluster with this account's access.",
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
        flags: [{ flags: ['--raw'], facts: { touchesCredentials: true, note: `The keys and passwords are shown in readable form. ${KEY_SHOWN}` } }],
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

// ── Terraform and OpenTofu ─────────────────────────────────────────────────────────────────────────────────────────

const TF = 'https://developer.hashicorp.com/terraform/cli/commands'
const TF_PLUGINS = 'the plugins and modules the project files name, which can run anything on this computer'

const TF_VARS: Record<string, Role> = { ...valuesOf('text', ['-var', '-target', '-replace', '-lock-timeout', '-parallelism']), '-var-file': 'path' }
const TF_STATE = valuesOf('path', ['-state', '-state-out', '-backup'])
const TF_UNASKED: FlagRule = { flags: ['-auto-approve'], facts: { note: 'The changes are made without being shown and agreed to first.' } }
const TF_PLAN_FILE: FlagRule = {
  flags: ['-out'],
  takesValue: true,
  role: 'path',
  facts: { effect: ['create'], note: 'The saved plan holds every value the change needs, secrets included, in readable form.' },
}

/** Terraform's options are whole words behind one dash, so `-auto-approve` is never a bundle of letters. */
const words = (entry: Entry): Entry => ({
  ...entry,
  flagStyle: 'words',
  sub: Object.fromEntries(Object.entries(entry.sub ?? {}).map(([w, rule]) => [w, { ...rule, flagStyle: 'words' as const }])),
})

const TERRAFORM: Entry = words({
  facts: opaqueFact('Creates, changes or removes the cloud resources the files of a project describe.', TF_PLUGINS, {
    effect: ['read', 'create', 'write', 'delete', 'execute', 'install'],
    network: 'arbitrary',
    reversible: 'no',
    touchesCredentials: true,
    docs: TF,
  }),
  globals: [{ flags: ['-chdir'], takesValue: true, role: 'path', facts: {} }],
  sub: {
    init: {
      facts: opaqueFact('Gets a project folder ready, downloading the plugins and modules its files name.', TF_PLUGINS, {
        effect: ['read', 'create', 'write', 'install'],
        network: 'arbitrary',
        docs: TF,
      }),
      values: { ...valuesOf('text', ['-backend-config', '-from-module', '-lockfile', '-lock-timeout']), '-plugin-dir': 'path' },
    },
    get: {
      facts: fact('Downloads the modules the files of a project name.', { effect: ['create', 'install'], network: 'arbitrary', reversible: 'unknown', docs: TF }),
    },
    validate: {
      facts: opaqueFact('Checks that the files of a project are written correctly.', TF_PLUGINS, { effect: ['read', 'execute'], network: 'arbitrary', docs: TF }),
    },
    fmt: {
      facts: fact('Rewrites the files of a project in the standard layout.', { effect: ['read', 'write'], reversible: 'unknown', docs: TF }),
      operands: ['path'],
    },
    plan: {
      facts: opaqueFact('Works out what it would take to make the cloud resources match the files of a project, without changing them.', TF_PLUGINS, {
        effect: ['read', 'execute'],
        network: 'arbitrary',
        docs: TF,
      }),
      values: { ...TF_VARS, ...TF_STATE, '-generate-config-out': 'path' },
      flags: [TF_PLAN_FILE],
    },
    apply: {
      facts: opaqueFact('Creates, changes or removes cloud resources so they match the files of a project.', TF_PLUGINS, {
        effect: ['create', 'write', 'delete', 'execute'],
        network: 'arbitrary',
        reversible: 'no',
        docs: TF,
      }),
      operands: ['path'],
      values: { ...TF_VARS, ...TF_STATE },
      flags: [TF_UNASKED],
    },
    destroy: {
      facts: opaqueFact('Removes every cloud resource the files of a project describe.', TF_PLUGINS, {
        effect: ['delete', 'execute'],
        network: 'arbitrary',
        reversible: 'no',
        docs: TF,
      }),
      values: { ...TF_VARS, ...TF_STATE },
      flags: [TF_UNASKED],
    },
    refresh: {
      facts: opaqueFact('Updates the record a project keeps of its cloud resources to match what is there now.', TF_PLUGINS, {
        effect: ['read', 'write', 'execute'],
        network: 'arbitrary',
        docs: TF,
      }),
      values: { ...TF_VARS, ...TF_STATE },
    },
    import: {
      facts: opaqueFact('Starts keeping track of a cloud resource that already exists, as part of a project.', TF_PLUGINS, {
        effect: ['read', 'write', 'execute'],
        network: 'arbitrary',
        docs: TF,
      }),
      operands: ['text'],
      values: { ...TF_VARS, ...TF_STATE, '-config': 'path' },
    },
    test: {
      facts: opaqueFact('Runs the checks written for a project, which can create and remove real cloud resources.', TF_PLUGINS, {
        effect: ['create', 'delete', 'execute'],
        network: 'arbitrary',
        reversible: 'no',
        docs: TF,
      }),
      values: { ...valuesOf('text', ['-var', '-filter']), ...valuesOf('path', ['-var-file', '-test-directory']) },
    },
    console: {
      facts: opaqueFact('Opens a prompt for trying out the expressions a project is written in.', TF_PLUGINS, { effect: ['read', 'execute'], network: 'arbitrary', docs: TF }),
      values: { ...TF_VARS, '-state': 'path' },
    },
    output: {
      facts: reads('Shows the values the last run of a project recorded for other projects to use.', TF, {
        touchesCredentials: true,
        note: 'A value marked as secret is shown in readable form when it is asked for by name, or in machine-readable text.',
      }),
      operands: ['text'],
      values: { '-state': 'path' },
    },
    show: {
      facts: reads('Shows the recorded state of the cloud resources of a project, or a saved plan.', TF, {
        touchesCredentials: true,
        note: 'In machine-readable text it shows the values marked as secret too.',
      }),
      operands: ['path'],
    },
    state: {
      facts: changes('Lists, moves or removes the cloud resources a project keeps track of, or shows one.', TF, ['read', 'write', 'delete'], {
        touchesCredentials: true,
        reversible: 'no',
      }),
      operands: ['text'],
      values: TF_STATE,
    },
    'state list': { facts: reads('Lists the cloud resources a project keeps track of.', TF), operands: ['text'], values: { '-state': 'path', '-id': 'text' } },
    'state show': {
      facts: reads('Shows everything recorded about one cloud resource a project keeps track of.', TF, { touchesCredentials: true }),
      operands: ['text'],
      values: { '-state': 'path' },
    },
    'state pull': {
      facts: reads('Shows the whole record a project keeps of its cloud resources, secrets included.', TF, { touchesCredentials: true, note: SHOWN }),
    },
    'state push': {
      facts: changes('Replaces the record a project keeps of its cloud resources with a file from this computer.', TF, ['write', 'transmit'], {
        touchesCredentials: true,
        reversible: 'no',
      }),
      operands: ['path'],
    },
    'state rm': {
      facts: changes('Stops keeping track of cloud resources, leaving the resources themselves in place.', TF, ['write'], { repeatSafe: true }),
      operands: ['text'],
      values: { ...TF_STATE, '-lock-timeout': 'text' },
    },
    'state mv': {
      facts: changes('Moves a cloud resource to another name in the record a project keeps.', TF, ['write']),
      operands: ['text'],
      values: { ...TF_STATE, '-lock-timeout': 'text' },
    },
    workspace: {
      facts: changes('Lists, switches, makes or removes the separate sets of cloud resources one project can keep.', TF, ['read', 'configure', 'create', 'delete'], {
        reversible: 'no',
      }),
      operands: ['text'],
    },
    'workspace list': { facts: reads('Lists the separate sets of cloud resources a project keeps.', TF) },
    'workspace show': { facts: fact('Shows which set of cloud resources a project is working on now.', { docs: TF }) },
    'workspace select': {
      facts: fact('Switches which set of cloud resources a project works on.', { effect: ['configure'], docs: TF }),
      operands: ['text'],
    },
    'workspace new': { facts: changes('Makes a new, empty set of cloud resources for a project.', TF, ['create']), operands: ['text'], values: { '-state': 'path', '-lock-timeout': 'text' } },
    'workspace delete': {
      facts: removes('Removes one of the sets of cloud resources a project keeps, and its record.', TF, {
        note: 'Any resources it still tracks are left running, with nothing keeping track of them.',
      }),
      operands: ['text'],
      values: { '-lock-timeout': 'text' },
    },
    providers: { facts: fact('Lists the plugins the files of a project need.', { docs: TF }) },
    graph: { facts: fact('Shows how the cloud resources of a project depend on each other.', { docs: TF }), values: valuesOf('text', ['-type', '-plan']) },
    version: { facts: reads('Shows which version of this tool and its plugins is in use.', TF) },
    taint: { facts: changes('Marks a cloud resource to be replaced the next time changes are made.', TF, ['write'], { reversible: 'yes', repeatSafe: true }), operands: ['text'] },
    untaint: { facts: changes('Clears the mark that a cloud resource is to be replaced.', TF, ['write'], { reversible: 'yes', repeatSafe: true }), operands: ['text'] },
    'force-unlock': {
      facts: changes('Releases the lock on the record a project keeps, which stops two changes running at once.', TF, ['write'], {
        note: 'If another change is still running, the two can leave the record wrong.',
      }),
      operands: ['text'],
    },
    login: {
      facts: fact('Signs in to a service that keeps shared projects and plugins, and saves the sign-in on this computer.', {
        effect: ['create', 'configure'],
        network: 'known-host',
        touchesCredentials: true,
        docs: TF,
      }),
      operands: ['host'],
    },
    logout: {
      facts: fact('Removes the saved sign-in to a service that keeps shared projects and plugins.', {
        effect: ['delete'],
        touchesCredentials: true,
        reversible: 'unknown',
        docs: TF,
      }),
      operands: ['host'],
    },
  },
})

// ── Helm ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const HELM = 'https://helm.sh/docs/helm/'
const HELM_CHART = 'the ready-made set it installs, whose contents and set-up steps were decided by whoever wrote it'

const HELM_VALUES: Record<string, Role> = {
  ...valuesOf('text', ['--kube-context', '-n', '--namespace', '--burst-limit', '--qps', '--kube-as-user', '--kube-as-group', '--kube-tls-server-name']),
  ...valuesOf('path', ['--kubeconfig', '--registry-config', '--repository-config', '--repository-cache', '--kube-ca-file', '--content-cache']),
  '--kube-apiserver': 'url',
}
const HELM_KEYS: FlagRule[] = [
  { flags: ['--kube-token'], takesValue: true, role: 'text', facts: { touchesCredentials: true } },
  { flags: ['--kube-insecure-skip-tls-verify'], facts: { note: 'It does not check that the cluster is the one it claims to be.' } },
]
const HELM_SIGN_IN: FlagRule[] = [
  { flags: ['--password'], takesValue: true, role: 'text', facts: { touchesCredentials: true } },
  { flags: ['--key-file'], takesValue: true, role: 'path', facts: { touchesCredentials: true } },
]
// A program named here gets everything the chart would put on the cluster, and runs on this computer.
const HELM_RENDERER: FlagRule = {
  flags: ['--post-renderer'],
  takesValue: true,
  role: 'path',
  facts: {
    effect: ['execute'],
    opaque: true,
    handsOverTo: 'the program named to rework what the ready-made set would install',
    reversible: 'unknown',
    repeatSafe: false,
  },
}
const HELM_SET: Record<string, Role> = {
  ...valuesOf('path', ['-f', '--values', '--ca-file', '--cert-file', '--keyring']),
  ...valuesOf('text', [
    '--set', '--set-string', '--set-file', '--set-json', '--set-literal', '--version', '--username', '-o', '--output', '--timeout',
    '--description', '--post-renderer-args', '--name-template', '--labels', '--kube-version', '-a', '--api-versions',
  ]),
  '--repo': 'url',
}

const HELM_ENTRY: Entry = everywhere(
  {
    facts: opaqueFact(
      'Installs, upgrades or removes ready-made sets of programs on a Kubernetes cluster.',
      `${HELM_CHART}, or an add-on command installed for this tool`,
      {
        effect: ['read', 'create', 'write', 'delete', 'execute', 'install'],
        network: 'arbitrary',
        reversible: 'no',
        touchesCredentials: true,
        docs: HELM,
      },
    ),
    globals: globalsOf(HELM_VALUES, HELM_KEYS),
    sub: {
      install: {
        facts: opaqueFact('Installs a ready-made set of programs on a Kubernetes cluster.', HELM_CHART, {
          effect: ['create', 'execute', 'install'],
          network: 'arbitrary',
          docs: HELM,
        }),
        operands: ['text', 'package'],
        values: HELM_SET,
        flags: [...HELM_SIGN_IN, HELM_RENDERER],
      },
      upgrade: {
        facts: opaqueFact('Moves an installed set of programs on a Kubernetes cluster to a new version or new settings.', HELM_CHART, {
          effect: ['create', 'write', 'delete', 'execute', 'install'],
          network: 'arbitrary',
          docs: HELM,
        }),
        operands: ['text', 'package'],
        values: { ...HELM_SET, '--history-max': 'text' },
        flags: [...HELM_SIGN_IN, HELM_RENDERER],
      },
      template: {
        facts: fact('Shows the files a ready-made set of programs would put on a Kubernetes cluster, without installing it.', {
          network: 'arbitrary',
          docs: HELM,
        }),
        operands: ['text', 'package'],
        values: { ...HELM_SET, '--output-dir': 'path', '-s': 'text', '--show-only': 'text' },
        flags: [...HELM_SIGN_IN, HELM_RENDERER],
      },
      uninstall: {
        facts: removes('Removes an installed set of programs from a Kubernetes cluster, with what it was running.', HELM, { effect: ['delete', 'terminate'] }),
        operands: ['text'],
        values: valuesOf('text', ['--timeout', '--cascade', '--description', '--deletion-propagation']),
      },
      rollback: {
        facts: changes('Puts an installed set of programs on a Kubernetes cluster back to an earlier version.', HELM, ['write', 'delete', 'create']),
        operands: ['text'],
        values: valuesOf('text', ['--timeout', '--history-max']),
      },
      list: { facts: reads('Lists the sets of programs installed on a Kubernetes cluster.', HELM), values: valuesOf('text', ['-o', '--output', '-f', '--filter', '-l', '--selector', '--max', '--offset', '--time-format']) },
      ls: { facts: reads('Lists the sets of programs installed on a Kubernetes cluster.', HELM), values: valuesOf('text', ['-o', '--output', '-f', '--filter', '-l', '--selector', '--max', '--offset', '--time-format']) },
      status: { facts: reads('Shows how an installed set of programs on a Kubernetes cluster is doing.', HELM), operands: ['text'], values: valuesOf('text', ['-o', '--output', '--revision']) },
      history: { facts: reads('Lists the earlier versions of an installed set of programs on a Kubernetes cluster.', HELM), operands: ['text'], values: valuesOf('text', ['-o', '--output', '--max']) },
      get: {
        facts: reads('Shows the settings and files an installed set of programs on a Kubernetes cluster was given.', HELM, {
          touchesCredentials: true,
          note: 'The settings it shows often hold passwords and keys, in readable form.',
        }),
        operands: ['text'],
        values: valuesOf('text', ['-o', '--output', '--revision', '--template']),
      },
      test: {
        facts: opaqueFact('Runs the checks a ready-made set of programs brings, on the Kubernetes cluster it is installed on.', HELM_CHART, {
          effect: ['create', 'execute'],
          network: 'known-host',
          docs: HELM,
        }),
        operands: ['text'],
        values: valuesOf('text', ['--timeout', '--filter']),
      },
      pull: {
        facts: fact('Downloads a ready-made set of programs to this computer, without installing it.', {
          effect: ['create', 'install'],
          network: 'arbitrary',
          reversible: 'unknown',
          docs: HELM,
        }),
        operands: ['package'],
        values: { ...HELM_SET, ...valuesOf('path', ['-d', '--destination', '--untardir', '--keyring']) },
        flags: HELM_SIGN_IN,
      },
      push: {
        facts: changes('Sends a ready-made set of programs from this computer to a service other people can reach.', HELM, ['read', 'transmit'], {
          network: 'arbitrary',
          reversible: 'no',
        }),
        operands: ['path', 'url'],
        values: valuesOf('path', ['--ca-file', '--cert-file']),
        flags: HELM_SIGN_IN,
      },
      repo: {
        facts: changes('Adds, updates, lists or removes the places ready-made sets of programs are downloaded from.', HELM, ['read', 'configure', 'delete'], {
          network: 'arbitrary',
          touchesCredentials: true,
        }),
        operands: ['text'],
      },
      'repo add': {
        facts: changes('Adds a place ready-made sets of programs can be downloaded from.', HELM, ['configure'], { network: 'arbitrary', repeatSafe: true }),
        operands: ['text', 'url'],
        values: { ...valuesOf('path', ['--ca-file', '--cert-file']), '--username': 'text' },
        flags: HELM_SIGN_IN,
      },
      'repo update': { facts: reads('Downloads the latest lists of what each saved place offers.', HELM, { effect: ['read', 'write'], network: 'arbitrary' }), operands: ['text'] },
      'repo list': { facts: fact('Lists the places ready-made sets of programs are downloaded from.', { docs: HELM }), values: valuesOf('text', ['-o', '--output']) },
      'repo remove': { facts: fact('Removes a saved place ready-made sets of programs are downloaded from.', { effect: ['configure', 'delete'], reversible: 'unknown', docs: HELM }), operands: ['text'] },
      registry: {
        facts: fact('Signs in to or out of a service that stores ready-made sets of programs.', {
          effect: ['configure'],
          network: 'arbitrary',
          touchesCredentials: true,
          reversible: 'unknown',
          docs: HELM,
        }),
        operands: ['text', 'host'],
        values: { ...valuesOf('text', ['-u', '--username']), ...valuesOf('path', ['--ca-file', '--cert-file']) },
        flags: [...HELM_SIGN_IN, { flags: ['-p'], takesValue: true, role: 'text', facts: { touchesCredentials: true } }],
      },
      plugin: {
        facts: opaqueFact('Installs, updates, lists or removes add-on commands for this tool.', 'the add-on and the set-up steps it brings, which can do anything a program on this computer can', {
          effect: ['create', 'install', 'execute', 'delete'],
          network: 'arbitrary',
          docs: HELM,
        }),
        operands: ['text'],
      },
      'plugin list': { facts: fact('Lists the add-on commands installed for this tool.', { docs: HELM }) },
      dependency: {
        facts: fact('Downloads or lists the other ready-made sets one set of programs needs.', {
          effect: ['read', 'create', 'install'],
          network: 'arbitrary',
          reversible: 'unknown',
          docs: HELM,
        }),
        operands: ['text', 'path'],
        values: { '--keyring': 'path' },
      },
      create: { facts: fact('Makes a new folder with the starting files for a ready-made set of programs.', { effect: ['create'], docs: HELM }), operands: ['path'], values: { '-p': 'text', '--starter': 'text' } },
      lint: { facts: fact('Checks a ready-made set of programs for mistakes.', { docs: HELM }), operands: ['path'], values: HELM_SET },
      package: {
        facts: fact('Packs a folder of files into a ready-made set of programs that can be shared.', { effect: ['read', 'create'], docs: HELM }),
        operands: ['path'],
        values: { ...valuesOf('path', ['-d', '--destination', '--keyring', '--passphrase-file']), ...valuesOf('text', ['--version', '--app-version', '--key']) },
      },
      search: { facts: reads('Searches for ready-made sets of programs to install.', HELM, { network: 'arbitrary' }), operands: ['text'], values: valuesOf('text', ['-o', '--output', '--version', '--max-col-width', '--endpoint']) },
      show: { facts: reads('Shows the description and settings of a ready-made set of programs.', HELM, { network: 'arbitrary' }), operands: ['text', 'package'], values: { ...HELM_SET } },
      version: { facts: fact('Shows which version of this tool is installed.', { docs: HELM }), values: { '--template': 'text' } },
      env: { facts: fact('Shows the settings and folders this tool uses.', { docs: HELM }) },
    },
  },
  HELM_VALUES,
  HELM_KEYS,
)

// ── Amazon Web Services ────────────────────────────────────────────────────────────────────────────────────────────

const AWS = 'https://awscli.amazonaws.com/v2/documentation/api/latest/index.html'

const AWS_VALUES: Record<string, Role> = {
  ...valuesOf('text', [
    '--profile', '--region', '--output', '--query', '--color', '--cli-binary-format', '--cli-error-format', '--cli-read-timeout',
    '--cli-connect-timeout',
  ]),
  '--endpoint-url': 'url',
  '--ca-bundle': 'path',
}
const AWS_FLAGS: FlagRule[] = [{ flags: ['--no-verify-ssl'], facts: { note: 'It does not check that the service is the one it claims to be.' } }]

const S3_COPY: Record<string, Role> = {
  ...valuesOf('pattern', ['--include', '--exclude']),
  ...valuesOf('text', [
    '--sse', '--sse-c', '--sse-kms-key-id', '--sse-c-copy-source', '--storage-class', '--grants', '--website-redirect', '--content-type',
    '--cache-control', '--content-disposition', '--content-encoding', '--content-language', '--expires', '--source-region',
    '--request-payer', '--checksum-mode', '--checksum-algorithm', '--copy-props', '--metadata', '--metadata-directive',
    '--expected-size', '--case-conflict', '--page-size',
  ]),
}
const S3_ACL: FlagRule = {
  flags: ['--acl'],
  takesValue: true,
  role: 'text',
  facts: { note: 'It sets who can read the files it writes, which can be anyone on the internet.' },
}
const S3_EVERYTHING: FlagRule = { flags: ['--recursive'], facts: { note: 'Everything under the address goes, not one file.' } }

const AWS_ENTRY: Entry = everywhere(
  {
    facts: opaqueFact(
      "Works with the services of an account on Amazon's cloud, including ones that remove or replace what is there.",
      'whatever the account is told to run, on the computers it reaches',
      {
        effect: ['read', 'create', 'write', 'delete', 'transmit', 'execute', 'configure'],
        network: 'arbitrary',
        reversible: 'no',
        touchesCredentials: true,
        docs: AWS,
      },
    ),
    globals: globalsOf(AWS_VALUES, AWS_FLAGS),
    sub: {
      s3: {
        facts: changes("Copies files to and from storage on Amazon's cloud, or lists or removes them.", AWS, ['read', 'create', 'write', 'delete', 'transmit'], {
          reversible: 'no',
          touchesCredentials: true,
        }),
        operands: ['text'],
      },
      's3 ls': {
        facts: reads("Lists the storage buckets on Amazon's cloud, or the files in one.", AWS),
        operands: ['url'],
        values: valuesOf('text', ['--page-size', '--request-payer', '--bucket-name-prefix', '--bucket-region']),
      },
      's3 cp': {
        facts: fact("Copies files between this computer and storage on Amazon's cloud, replacing any with the same name.", {
          effect: ['read', 'create', 'write', 'transmit'],
          network: 'known-host',
          reversible: 'no',
          docs: AWS,
        }),
        operands: ['text'],
        values: S3_COPY,
        flags: [S3_ACL],
      },
      's3 sync': {
        facts: fact("Copies whatever is new or changed between a folder and storage on Amazon's cloud.", {
          effect: ['read', 'create', 'write', 'transmit'],
          network: 'known-host',
          reversible: 'no',
          docs: AWS,
        }),
        operands: ['text'],
        values: S3_COPY,
        flags: [S3_ACL, { flags: ['--delete'], facts: { effect: ['delete'], note: 'Files at the far end that are not at the near end are removed.' } }],
      },
      's3 mv': {
        facts: fact("Moves files between this computer and storage on Amazon's cloud, replacing any with the same name.", {
          effect: ['read', 'create', 'write', 'delete', 'transmit'],
          network: 'known-host',
          reversible: 'no',
          docs: AWS,
        }),
        operands: ['text'],
        values: S3_COPY,
        flags: [S3_ACL],
      },
      's3 rm': {
        facts: removes("Removes files from storage on Amazon's cloud.", AWS),
        operands: ['url'],
        values: valuesOf('pattern', ['--include', '--exclude']),
        flags: [S3_EVERYTHING],
      },
      's3 mb': { facts: changes("Makes a new storage bucket on Amazon's cloud.", AWS, ['create'], { reversible: 'yes' }), operands: ['url'] },
      's3 rb': {
        facts: removes("Removes a storage bucket from Amazon's cloud.", AWS),
        operands: ['url'],
        flags: [{ flags: ['--force'], facts: { note: 'Every file in the bucket is removed first.' } }],
      },
      's3 presign': {
        facts: fact("Makes a link that lets anyone who has it download a file from storage on Amazon's cloud.", {
          touchesCredentials: true,
          note: 'Anyone with the link can download the file until the link runs out.',
          docs: AWS,
        }),
        operands: ['url'],
        values: { '--expires-in': 'text' },
      },
      configure: {
        facts: fact("Shows or changes the keys and settings used to reach Amazon's cloud.", {
          effect: ['read', 'configure'],
          touchesCredentials: true,
          reversible: 'unknown',
          repeatSafe: false,
          docs: AWS,
        }),
        operands: ['text'],
      },
      'configure list': { facts: fact("Lists the settings used to reach Amazon's cloud, with the keys mostly hidden.", { docs: AWS }) },
      'configure get': {
        facts: fact("Shows one saved setting used to reach Amazon's cloud, which can be a secret key.", { touchesCredentials: true, note: KEY_SHOWN, docs: AWS }),
        operands: ['text'],
      },
      'configure set': {
        facts: fact("Saves one setting used to reach Amazon's cloud, which can be a secret key.", {
          effect: ['configure'],
          touchesCredentials: true,
          reversible: 'unknown',
          note: 'A key given here is written on the line itself, where it can be seen and kept in the history of commands.',
          docs: AWS,
        }),
        operands: ['text'],
      },
      'configure export-credentials': {
        facts: fact("Shows the keys in use for Amazon's cloud, in readable form.", { touchesCredentials: true, note: KEY_SHOWN, docs: AWS }),
        values: valuesOf('text', ['--format']),
      },
      sts: {
        facts: reads("Works with the keys and identity used to reach Amazon's cloud.", AWS, { touchesCredentials: true }),
        operands: ['text'],
      },
      'sts get-caller-identity': { facts: reads("Shows which account and role the keys in use for Amazon's cloud belong to.", AWS) },
      'sts assume-role': {
        facts: reads("Gets short-lived keys that act as another role on Amazon's cloud, and shows them.", AWS, { touchesCredentials: true, note: KEY_SHOWN }),
        values: valuesOf('text', ['--role-arn', '--role-session-name', '--duration-seconds', '--external-id', '--serial-number', '--token-code', '--policy', '--policy-arns']),
      },
      'sts get-session-token': {
        facts: reads("Gets short-lived keys for the account in use on Amazon's cloud, and shows them.", AWS, { touchesCredentials: true, note: KEY_SHOWN }),
        values: valuesOf('text', ['--duration-seconds', '--serial-number', '--token-code']),
      },
      sso: {
        facts: fact("Signs in to or out of Amazon's cloud through an organisation's single sign-in.", {
          effect: ['create', 'configure', 'delete'],
          network: 'known-host',
          touchesCredentials: true,
          reversible: 'unknown',
          docs: AWS,
        }),
        operands: ['text'],
        values: valuesOf('text', ['--sso-session']),
      },
      'secretsmanager get-secret-value': {
        facts: reads("Shows a secret kept on Amazon's cloud, in readable form.", AWS, { touchesCredentials: true, note: SHOWN }),
        values: valuesOf('text', ['--secret-id', '--version-id', '--version-stage']),
      },
      'ssm get-parameter': {
        facts: reads("Shows one setting kept on Amazon's cloud.", AWS),
        values: valuesOf('text', ['--name']),
        flags: [{ flags: ['--with-decryption'], facts: { touchesCredentials: true, note: `A setting kept as a secret is shown in readable form. ${SHOWN}` } }],
      },
      'ecr get-login-password': {
        facts: reads("Shows a password for signing in to Amazon's storage of packaged programs.", AWS, { touchesCredentials: true, note: KEY_SHOWN }),
      },
      'lambda invoke': {
        facts: opaqueFact("Runs a function on Amazon's cloud and saves what it returns to a file.", 'the function it runs, whose code is not shown here', {
          effect: ['execute', 'create'],
          network: 'known-host',
          docs: AWS,
        }),
        operands: ['path'],
        values: valuesOf('text', ['--function-name', '--payload', '--invocation-type', '--log-type', '--qualifier', '--client-context']),
      },
      'logs tail': {
        facts: reads("Shows what a program on Amazon's cloud has written to its log, and can keep following it.", AWS),
        operands: ['text'],
        values: valuesOf('text', ['--since', '--filter-pattern', '--format', '--log-stream-names', '--log-stream-name-prefix']),
      },
      'ec2 describe-instances': {
        facts: reads("Lists the cloud computers on Amazon's cloud, with their details.", AWS),
        values: valuesOf('text', ['--instance-ids', '--filters', '--max-items', '--page-size', '--starting-token']),
      },
      'ec2 terminate-instances': {
        facts: removes("Shuts down cloud computers on Amazon's cloud for good, along with the disks set to go with them.", AWS, { effect: ['delete', 'terminate'] }),
        values: valuesOf('text', ['--instance-ids']),
      },
      'ec2 stop-instances': {
        facts: changes("Stops cloud computers on Amazon's cloud, keeping their disks.", AWS, ['terminate'], { reversible: 'yes', repeatSafe: true }),
        values: valuesOf('text', ['--instance-ids']),
      },
      'ec2 start-instances': {
        facts: changes("Starts stopped cloud computers on Amazon's cloud.", AWS, ['execute'], { reversible: 'yes', repeatSafe: true }),
        values: valuesOf('text', ['--instance-ids']),
      },
      'cloudformation deploy': {
        facts: opaqueFact("Creates or changes a set of resources on Amazon's cloud to match a template file.", 'the template file it was given, whose contents are not shown here', {
          effect: ['create', 'write', 'delete', 'execute'],
          network: 'known-host',
          reversible: 'no',
          docs: AWS,
        }),
        values: { '--template-file': 'path', ...valuesOf('text', ['--stack-name', '--parameter-overrides', '--capabilities', '--s3-bucket', '--role-arn', '--tags']) },
      },
      'cloudformation delete-stack': {
        facts: removes("Removes a set of resources from Amazon's cloud, along with what they held.", AWS),
        values: valuesOf('text', ['--stack-name', '--retain-resources', '--role-arn']),
      },
      'iam create-access-key': {
        facts: changes("Makes a new long-lived key for an account on Amazon's cloud, and shows it.", AWS, ['create'], { touchesCredentials: true, note: KEY_SHOWN }),
        values: valuesOf('text', ['--user-name']),
      },
    },
  },
  AWS_VALUES,
  AWS_FLAGS,
)

// ── Google Cloud ───────────────────────────────────────────────────────────────────────────────────────────────────

const GCLOUD = 'https://cloud.google.com/sdk/gcloud/reference'

const GCLOUD_VALUES: Record<string, Role> = {
  ...valuesOf('text', [
    '--project', '--account', '--configuration', '--billing-project', '--verbosity', '--format', '--flatten', '--filter', '--limit',
    '--page-size', '--sort-by', '--trace-token', '--impersonate-service-account', '--universe-domain',
  ]),
  '--flags-file': 'path',
}
const GCLOUD_FLAGS: FlagRule[] = [
  { flags: ['--access-token-file'], takesValue: true, role: 'path', facts: { touchesCredentials: true } },
  { flags: ['-q', '--quiet'], facts: { note: 'It answers yes to every question it would have asked first.' } },
]
const GCLOUD_PLACE = valuesOf('text', ['--zone', '--region'])

const GCLOUD_ENTRY: Entry = everywhere(
  {
    facts: opaqueFact(
      'Works with the services of a project on Google Cloud, including ones that remove or replace what is there.',
      'whatever is run on the cloud computers it reaches, or the set-up steps of the parts it installs',
      {
        effect: ['read', 'create', 'write', 'delete', 'transmit', 'execute', 'configure', 'install'],
        network: 'arbitrary',
        reversible: 'no',
        touchesCredentials: true,
        docs: GCLOUD,
      },
    ),
    globals: globalsOf(GCLOUD_VALUES, GCLOUD_FLAGS),
    sub: {
      auth: {
        facts: fact('Signs in to Google Cloud, signs out, or shows the keys in use.', {
          effect: ['read', 'create', 'configure', 'delete'],
          network: 'known-host',
          touchesCredentials: true,
          reversible: 'unknown',
          repeatSafe: false,
          docs: GCLOUD,
        }),
        operands: ['text'],
      },
      'auth list': { facts: fact('Lists the accounts signed in to Google Cloud on this computer.', { docs: GCLOUD }) },
      'auth login': {
        facts: fact('Signs in to Google Cloud and keeps the sign-in on this computer.', {
          effect: ['create', 'configure'],
          network: 'known-host',
          touchesCredentials: true,
          docs: GCLOUD,
        }),
        operands: ['text'],
        values: { '--cred-file': 'path', ...valuesOf('text', ['--scopes', '--client-id-file']) },
      },
      'auth activate-service-account': {
        facts: fact('Signs in to Google Cloud as a service account, from its key file.', { effect: ['configure'], touchesCredentials: true, docs: GCLOUD }),
        operands: ['text'],
        values: { '--key-file': 'path' },
      },
      'auth print-access-token': {
        facts: fact('Shows a short-lived key that acts as the signed-in Google Cloud account.', { network: 'known-host', touchesCredentials: true, note: KEY_SHOWN, docs: GCLOUD }),
        operands: ['text'],
      },
      'auth print-identity-token': {
        facts: fact('Shows a short-lived key that proves who the signed-in Google Cloud account is.', { network: 'known-host', touchesCredentials: true, note: KEY_SHOWN, docs: GCLOUD }),
        operands: ['text'],
        values: valuesOf('text', ['--audiences']),
      },
      'auth application-default': {
        facts: fact('Signs the programs on this computer in to Google Cloud, or shows the key they use.', {
          effect: ['read', 'create', 'configure', 'delete'],
          network: 'known-host',
          touchesCredentials: true,
          reversible: 'unknown',
          repeatSafe: false,
          note: KEY_SHOWN,
          docs: GCLOUD,
        }),
        operands: ['text'],
      },
      'auth revoke': {
        facts: fact('Signs an account out of Google Cloud and removes its saved sign-in from this computer.', {
          effect: ['delete', 'configure'],
          network: 'known-host',
          touchesCredentials: true,
          reversible: 'unknown',
          docs: GCLOUD,
        }),
        operands: ['text'],
      },
      config: {
        facts: fact('Shows or changes the settings this tool uses, such as the project it works on.', {
          effect: ['read', 'configure'],
          reversible: 'unknown',
          docs: GCLOUD,
        }),
        operands: ['text'],
      },
      'config list': { facts: fact('Lists the settings this tool uses, such as the project it works on.', { docs: GCLOUD }) },
      'config get': { facts: fact('Shows one setting this tool uses.', { docs: GCLOUD }), operands: ['text'] },
      projects: {
        facts: changes('Lists, makes or removes projects on Google Cloud, or changes who can reach them.', GCLOUD, ['read', 'create', 'configure', 'delete'], {
          reversible: 'no',
        }),
        operands: ['text'],
      },
      'projects list': { facts: reads('Lists the projects the signed-in account can reach on Google Cloud.', GCLOUD) },
      'projects delete': {
        facts: removes('Removes a project from Google Cloud, and stops everything running in it.', GCLOUD, {
          effect: ['delete', 'terminate'],
          reversible: 'unknown',
          note: 'It can be brought back for 30 days, after which it is gone for good.',
        }),
        operands: ['text'],
      },
      compute: {
        facts: opaqueFact('Works with the cloud computers of a project on Google Cloud, and connects to them.', 'whatever is run on the cloud computer it connects to', {
          effect: ['read', 'create', 'delete', 'execute', 'terminate', 'transmit'],
          network: 'known-host',
          reversible: 'no',
          docs: GCLOUD,
        }),
        operands: ['text'],
        values: GCLOUD_PLACE,
      },
      'compute instances list': { facts: reads('Lists the cloud computers of a project on Google Cloud.', GCLOUD), values: valuesOf('text', ['--zones', '--regions']) },
      'compute instances describe': { facts: reads('Shows the details of one cloud computer on Google Cloud.', GCLOUD), operands: ['text'], values: GCLOUD_PLACE },
      'compute instances create': {
        facts: changes('Starts new cloud computers on Google Cloud, which are paid for while they run.', GCLOUD, ['create', 'execute']),
        operands: ['text'],
        values: {
          ...GCLOUD_PLACE,
          ...valuesOf('text', ['--machine-type', '--image', '--image-family', '--image-project', '--boot-disk-size', '--network', '--subnet', '--tags', '--labels', '--service-account', '--scopes', '--metadata']),
          '--metadata-from-file': 'text',
        },
      },
      'compute instances delete': {
        facts: removes('Removes cloud computers from Google Cloud, along with the disks set to go with them.', GCLOUD, { effect: ['delete', 'terminate'] }),
        operands: ['text'],
        values: { ...GCLOUD_PLACE, '--delete-disks': 'text', '--keep-disks': 'text' },
      },
      'compute instances stop': {
        facts: changes('Stops cloud computers on Google Cloud, keeping their disks.', GCLOUD, ['terminate'], { reversible: 'yes', repeatSafe: true }),
        operands: ['text'],
        values: GCLOUD_PLACE,
      },
      'compute instances start': {
        facts: changes('Starts stopped cloud computers on Google Cloud.', GCLOUD, ['execute'], { reversible: 'yes', repeatSafe: true }),
        operands: ['text'],
        values: GCLOUD_PLACE,
      },
      'compute ssh': {
        facts: opaqueFact('Connects to a cloud computer on Google Cloud and works on it from here.', 'whatever is run on the cloud computer it connects to', {
          effect: ['execute'],
          network: 'known-host',
          docs: GCLOUD,
        }),
        operands: ['text', 'text'],
        values: { ...GCLOUD_PLACE, '--ssh-key-file': 'path', ...valuesOf('text', ['--ssh-flag', '--container', '--internal-ip', '--strict-host-key-checking']) },
        flags: [{ flags: ['--command'], takesValue: true, role: 'text', facts: {} }],
      },
      'compute scp': {
        facts: fact('Copies files between this computer and a cloud computer on Google Cloud.', {
          effect: ['read', 'create', 'write', 'transmit'],
          network: 'known-host',
          reversible: 'no',
          docs: GCLOUD,
        }),
        operands: ['text'],
        values: { ...GCLOUD_PLACE, '--ssh-key-file': 'path', '--scp-flag': 'text' },
      },
      storage: {
        facts: changes('Copies files to and from storage on Google Cloud, or lists or removes them.', GCLOUD, ['read', 'create', 'write', 'delete', 'transmit'], {
          reversible: 'no',
        }),
        operands: ['text'],
      },
      'storage ls': { facts: reads('Lists the storage buckets on Google Cloud, or the files in one.', GCLOUD), operands: ['url'] },
      'storage cp': {
        facts: fact('Copies files between this computer and storage on Google Cloud, replacing any with the same name.', {
          effect: ['read', 'create', 'write', 'transmit'],
          network: 'known-host',
          reversible: 'no',
          docs: GCLOUD,
        }),
        operands: ['text'],
        values: valuesOf('text', ['--predefined-acl', '-a', '--content-type', '--cache-control', '--storage-class', '-x', '--exclude']),
      },
      'storage rm': {
        facts: removes('Removes files from storage on Google Cloud.', GCLOUD),
        operands: ['url'],
        flags: [{ flags: ['-r', '-R', '--recursive'], facts: { note: 'Everything under the address goes, not one file.' } }],
      },
      run: {
        facts: opaqueFact('Puts programs on Google Cloud to run for whoever is allowed to reach them, or changes or removes them.', 'the packaged program it runs, whose contents were decided by whoever built it', {
          effect: ['create', 'write', 'delete', 'execute', 'transmit'],
          network: 'known-host',
          reversible: 'no',
          docs: GCLOUD,
        }),
        operands: ['text'],
        values: valuesOf('text', ['--region', '--platform']),
      },
      'run deploy': {
        facts: opaqueFact('Puts a program on Google Cloud to run, building it from a folder here if asked.', 'the packaged program it runs, whose contents were decided by whoever built it', {
          effect: ['create', 'write', 'execute', 'transmit'],
          network: 'known-host',
          docs: GCLOUD,
        }),
        operands: ['text'],
        values: {
          '--image': 'package',
          '--source': 'path',
          ...valuesOf('text', ['--region', '--platform', '--port', '--memory', '--cpu', '--service-account', '--set-env-vars', '--update-env-vars', '--set-secrets', '--update-secrets', '--min-instances', '--max-instances', '--concurrency', '--timeout', '--tag', '--command', '--args']),
          '--env-vars-file': 'path',
        },
        flags: [{ flags: ['--allow-unauthenticated'], facts: { note: 'Anyone on the internet can reach it, without signing in.' } }],
      },
      secrets: {
        facts: changes('Works with the secrets a project keeps on Google Cloud.', GCLOUD, ['read', 'create', 'write', 'delete'], { touchesCredentials: true, reversible: 'no' }),
        operands: ['text'],
      },
      'secrets list': { facts: reads('Lists the names of the secrets a project keeps on Google Cloud, without their contents.', GCLOUD) },
      'secrets versions access': {
        facts: reads('Shows a secret a project keeps on Google Cloud, in readable form.', GCLOUD, { touchesCredentials: true, note: SHOWN }),
        operands: ['text'],
        values: valuesOf('text', ['--secret', '--out-file']),
      },
      'container clusters get-credentials': {
        facts: fact('Saves the sign-in details for a Kubernetes cluster on Google Cloud, so commands here can reach it.', {
          effect: ['create', 'configure'],
          network: 'known-host',
          touchesCredentials: true,
          docs: GCLOUD,
        }),
        operands: ['text'],
        values: GCLOUD_PLACE,
      },
      'iam service-accounts keys create': {
        facts: changes('Makes a new long-lived key for a service account on Google Cloud, and saves it in a file.', GCLOUD, ['create'], {
          touchesCredentials: true,
          note: 'Whoever holds the file can act as that account until the key is removed.',
        }),
        operands: ['path'],
        values: valuesOf('text', ['--iam-account', '--key-file-type']),
      },
      components: {
        facts: fact('Installs, updates, lists or removes the parts of this tool.', {
          effect: ['read', 'create', 'write', 'delete', 'install'],
          network: 'known-host',
          reversible: 'unknown',
          docs: GCLOUD,
        }),
        operands: ['text'],
      },
      'components list': { facts: reads('Lists the parts of this tool, and which are installed.', GCLOUD) },
      'logging read': { facts: reads('Shows the log entries a project on Google Cloud has kept.', GCLOUD), operands: ['text'], values: valuesOf('text', ['--freshness', '--order', '--bucket', '--location', '--view']) },
      info: { facts: fact('Shows how this tool is installed and set up.', { docs: GCLOUD }) },
      version: { facts: fact('Shows the versions of this tool and its parts.', { docs: GCLOUD }) },
    },
  },
  GCLOUD_VALUES,
  GCLOUD_FLAGS,
)

// ── Secret stores: 1Password and Doppler ──────────────────────────────────────────────────────────────────────────────

const OP = 'https://developer.1password.com/docs/cli/reference/'
const ON_THE_LINE = 'Values given on the line itself can be seen and kept in the history of commands.'

const OP_VALUES: Record<string, Role> = { ...valuesOf('text', ['--account', '--encoding', '--format']), '--config': 'path' }
const OP_KEYS: FlagRule[] = [{ flags: ['--session'], takesValue: true, role: 'text', facts: { touchesCredentials: true } }]
const OP_ITEM = valuesOf('text', ['--vault', '--fields', '--categories', '--tags'])

const OP_ENTRY: Entry = everywhere(
  {
    facts: opaqueFact('Works with the passwords and secrets kept in 1Password.', 'the command it is given to run with those secrets', {
      effect: ['read', 'create', 'write', 'delete', 'execute', 'configure', 'transmit'],
      network: 'known-host',
      reversible: 'no',
      touchesCredentials: true,
      docs: OP,
    }),
    globals: globalsOf(OP_VALUES, OP_KEYS),
    sub: {
      read: {
        facts: fact('Shows one secret kept in 1Password, in readable form.', { network: 'known-host', touchesCredentials: true, note: SHOWN, docs: OP }),
        operands: ['text'],
        values: { '--file-mode': 'text' },
        flags: [
          {
            flags: ['-o', '--out-file'],
            takesValue: true,
            role: 'path',
            facts: { effect: ['create', 'write'], reversible: 'no', note: 'The secret is written to that file in readable form.' },
          },
        ],
      },
      run: {
        facts: opaqueFact('Runs another command with secrets from 1Password handed to it.', 'the command it was given, which receives the secrets', {
          effect: ['execute'],
          network: 'known-host',
          touchesCredentials: true,
          docs: OP,
        }),
        operands: ['command'],
        nestedHere: true,
        values: { '--env-file': 'path' },
        flags: [{ flags: ['--no-masking'], facts: { note: 'Secrets the command prints are shown as they are, not hidden.' } }],
      },
      inject: {
        facts: fact('Fills secrets from 1Password into a file of settings, in readable form.', {
          effect: ['read', 'create', 'write'],
          network: 'known-host',
          touchesCredentials: true,
          reversible: 'no',
          docs: OP,
        }),
        values: { ...valuesOf('path', ['-i', '--in-file', '-o', '--out-file']), '--file-mode': 'text' },
      },
      item: {
        facts: changes('Lists, shows, adds, changes or removes the items kept in 1Password.', OP, ['read', 'create', 'write', 'delete', 'transmit'], {
          touchesCredentials: true,
          reversible: 'no',
        }),
        operands: ['text'],
        values: OP_ITEM,
      },
      'item list': { facts: reads('Lists the names of the items kept in 1Password, without their secrets.', OP), values: OP_ITEM },
      'item get': {
        facts: reads('Shows an item kept in 1Password, with its secret fields hidden unless asked for.', OP, { touchesCredentials: true }),
        operands: ['text'],
        values: OP_ITEM,
        flags: [{ flags: ['--reveal'], facts: { note: `Its secret fields are shown in readable form. ${SHOWN}` } }],
      },
      'item create': {
        facts: changes('Adds a new item to 1Password.', OP, ['create', 'transmit'], { touchesCredentials: true, note: ON_THE_LINE }),
        operands: ['text'],
        values: { ...OP_ITEM, ...valuesOf('text', ['--category', '--title', '--ssh-generate-key']), '--url': 'url', '--template': 'path' },
        flags: [{ flags: ['--generate-password'], attached: true, role: 'text', facts: {} }],
      },
      'item edit': {
        facts: changes('Changes an item kept in 1Password.', OP, ['write', 'transmit'], { touchesCredentials: true, reversible: 'no', note: ON_THE_LINE }),
        operands: ['text'],
        values: { ...OP_ITEM, '--title': 'text', '--url': 'url', '--template': 'path' },
        flags: [{ flags: ['--generate-password'], attached: true, role: 'text', facts: {} }],
      },
      'item delete': { facts: removes('Removes an item from 1Password.', OP, { touchesCredentials: true }), operands: ['text'], values: OP_ITEM },
      'item share': {
        facts: changes('Makes a link that lets someone else see an item kept in 1Password.', OP, ['create', 'transmit'], { touchesCredentials: true, reversible: 'no' }),
        operands: ['text'],
        values: { ...OP_ITEM, ...valuesOf('text', ['--emails', '--expires-in', '--expiry']) },
      },
      document: {
        facts: changes('Lists, downloads, adds or removes the files kept in 1Password.', OP, ['read', 'create', 'write', 'delete', 'transmit'], {
          touchesCredentials: true,
          reversible: 'no',
        }),
        operands: ['text'],
        values: { ...OP_ITEM, ...valuesOf('path', ['-o', '--out-file']), ...valuesOf('text', ['--title', '--file-name', '--file-mode']) },
      },
      vault: {
        facts: changes('Lists, adds, changes or removes the vaults items are kept in on 1Password.', OP, ['read', 'create', 'write', 'delete', 'transmit'], {
          touchesCredentials: true,
          reversible: 'no',
        }),
        operands: ['text'],
      },
      'vault list': { facts: reads('Lists the vaults the signed-in account can reach on 1Password.', OP), values: valuesOf('text', ['--group', '--user', '--permission']) },
      signin: {
        facts: fact('Signs in to 1Password on this computer.', {
          effect: ['configure'],
          network: 'known-host',
          touchesCredentials: true,
          note: 'Outside the desktop app it prints a sign-in key for later commands to use.',
          docs: OP,
        }),
      },
      signout: {
        facts: fact('Signs out of 1Password on this computer.', { effect: ['configure', 'delete'], network: 'known-host', touchesCredentials: true, reversible: 'unknown', docs: OP }),
      },
      whoami: { facts: reads('Shows which 1Password account is signed in.', OP) },
      account: {
        facts: fact('Lists, adds or removes the 1Password accounts this computer can sign in to.', {
          effect: ['read', 'configure', 'delete'],
          network: 'known-host',
          touchesCredentials: true,
          reversible: 'unknown',
          docs: OP,
        }),
        operands: ['text'],
      },
      'account list': { facts: fact('Lists the 1Password accounts this computer can sign in to.', { docs: OP }) },
    },
  },
  OP_VALUES,
  OP_KEYS,
)

const DOPPLER = 'https://docs.doppler.com/docs/cli'

const DOPPLER_VALUES: Record<string, Role> = {
  ...valuesOf('text', ['-p', '--project', '-c', '--config', '--dns-resolver-address', '--dns-resolver-proto', '--dns-resolver-timeout', '--timeout']),
  ...valuesOf('path', ['--config-dir', '--scope', '--configuration']),
  ...valuesOf('url', ['--api-host', '--dashboard-host']),
}
const DOPPLER_KEYS: FlagRule[] = [
  { flags: ['-t', '--token'], takesValue: true, role: 'text', facts: { touchesCredentials: true } },
  { flags: ['--no-verify-tls'], facts: { note: 'It does not check that the service is the one it claims to be.' } },
]

const DOPPLER_ENTRY: Entry = everywhere(
  {
    facts: opaqueFact('Works with the secrets kept in Doppler, or runs a command with them.', 'the command it is given to run with those secrets', {
      effect: ['read', 'create', 'write', 'delete', 'execute', 'configure', 'transmit'],
      network: 'known-host',
      reversible: 'no',
      touchesCredentials: true,
      docs: DOPPLER,
    }),
    globals: globalsOf(DOPPLER_VALUES, DOPPLER_KEYS),
    sub: {
      run: {
        facts: opaqueFact('Runs another command with the secrets kept in Doppler handed to it.', 'the command it was given, which receives the secrets', {
          effect: ['execute'],
          network: 'known-host',
          touchesCredentials: true,
          docs: DOPPLER,
        }),
        operands: ['command'],
        nestedHere: true,
        values: {
          ...valuesOf('path', ['--mount', '--mount-template', '--fallback']),
          ...valuesOf('text', ['--mount-format', '--name-transformer', '--mount-max-reads', '--passphrase']),
        },
        flags: [{ flags: ['--command'], takesValue: true, role: 'command', facts: {} }],
      },
      secrets: {
        facts: changes('Shows, sets or removes the secrets kept in Doppler for a project.', DOPPLER, ['read', 'create', 'write', 'delete', 'transmit'], {
          touchesCredentials: true,
          reversible: 'no',
          note: 'On its own, it shows every secret in readable form.',
        }),
        operands: ['text'],
      },
      'secrets get': { facts: reads('Shows secrets kept in Doppler, in readable form.', DOPPLER, { touchesCredentials: true, note: SHOWN }), operands: ['text'] },
      'secrets set': {
        facts: changes('Saves secrets in Doppler, in place of any with the same name.', DOPPLER, ['create', 'write', 'transmit'], {
          touchesCredentials: true,
          reversible: 'no',
          repeatSafe: true,
          note: ON_THE_LINE,
        }),
        operands: ['text'],
      },
      'secrets delete': { facts: removes('Removes secrets kept in Doppler.', DOPPLER, { touchesCredentials: true }), operands: ['text'] },
      'secrets download': {
        facts: fact('Saves the secrets kept in Doppler for a project to a file, in readable form.', {
          effect: ['read', 'create', 'write'],
          network: 'known-host',
          touchesCredentials: true,
          reversible: 'no',
          docs: DOPPLER,
        }),
        operands: ['path'],
        values: valuesOf('text', ['--format', '--name-transformer', '--passphrase', '--fallback-passphrase']),
        flags: [{ flags: ['--no-file'], facts: { note: `The secrets are printed rather than saved. ${SHOWN}` } }],
      },
      'secrets upload': {
        facts: changes('Saves the secrets in a file here to Doppler, in place of any with the same name.', DOPPLER, ['read', 'write', 'transmit'], {
          touchesCredentials: true,
          reversible: 'no',
        }),
        operands: ['path'],
      },
      login: {
        facts: fact('Signs in to Doppler and keeps the sign-in on this computer.', {
          effect: ['create', 'configure'],
          network: 'known-host',
          touchesCredentials: true,
          docs: DOPPLER,
        }),
      },
      logout: {
        facts: fact('Signs out of Doppler and removes the saved sign-in from this computer.', {
          effect: ['delete', 'configure'],
          network: 'known-host',
          touchesCredentials: true,
          reversible: 'unknown',
          docs: DOPPLER,
        }),
      },
      setup: { facts: fact('Chooses which Doppler project and settings this folder uses.', { effect: ['configure'], network: 'known-host', docs: DOPPLER }) },
      configure: {
        facts: fact('Shows or changes the settings this tool keeps, which include its sign-in key.', {
          effect: ['read', 'configure'],
          touchesCredentials: true,
          reversible: 'unknown',
          docs: DOPPLER,
        }),
        operands: ['text'],
      },
      me: { facts: reads('Shows which Doppler account or key is in use.', DOPPLER) },
    },
  },
  DOPPLER_VALUES,
  DOPPLER_KEYS,
)

// ── Vercel ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const VERCEL = 'https://vercel.com/docs/cli'
const VERCEL_BUILD = "the build steps written in the project, which run on Vercel's computers or on this one"

const VERCEL_VALUES: Record<string, Role> = {
  ...valuesOf('text', ['-S', '--scope', '--team']),
  ...valuesOf('path', ['--cwd', '-A', '--local-config', '-Q', '--global-config']),
}
const VERCEL_KEYS: FlagRule[] = [{ flags: ['-t', '--token'], takesValue: true, role: 'text', facts: { touchesCredentials: true } }]
const VERCEL_LIST = valuesOf('text', ['-m', '--meta', '--environment', '-N', '--next', '-p', '--policy'])
const VERCEL_PROD: FlagRule = { flags: ['--prod'], facts: { note: 'It replaces what the live address shows.' } }
const VERCEL_PUBLIC: FlagRule = { flags: ['-p', '--public'], facts: { note: 'Its source files can be seen by anyone.' } }
const VERCEL_SETTINGS: FlagRule = { flags: ['-e', '--env', '-b', '--build-env'], takesValue: true, role: 'text', facts: { note: ON_THE_LINE } }

const VERCEL_ENTRY: Entry = everywhere(
  {
    facts: opaqueFact('Puts sites and apps on Vercel, and works with the ones already there.', VERCEL_BUILD, {
      effect: ['read', 'create', 'write', 'delete', 'transmit', 'execute', 'configure'],
      network: 'arbitrary',
      reversible: 'no',
      touchesCredentials: true,
      docs: VERCEL,
    }),
    operands: ['path'],
    globals: globalsOf(VERCEL_VALUES, VERCEL_KEYS),
    flags: [VERCEL_SETTINGS, VERCEL_PROD, VERCEL_PUBLIC],
    sub: {
      deploy: {
        facts: opaqueFact('Uploads a project to Vercel and puts it online, building it there first.', VERCEL_BUILD, {
          effect: ['read', 'transmit', 'execute', 'create'],
          network: 'known-host',
          reversible: 'no',
          docs: VERCEL,
        }),
        operands: ['path'],
        values: valuesOf('text', ['-m', '--meta', '--target', '--archive', '--regions']),
        flags: [VERCEL_SETTINGS, VERCEL_PROD, VERCEL_PUBLIC],
      },
      redeploy: {
        facts: opaqueFact('Builds and puts online again an earlier upload of a project on Vercel.', VERCEL_BUILD, {
          effect: ['transmit', 'execute'],
          network: 'known-host',
          docs: VERCEL,
        }),
        operands: ['text'],
        values: valuesOf('text', ['--target']),
      },
      dev: {
        facts: opaqueFact('Runs a project on this computer the way Vercel would, for trying it out.', VERCEL_BUILD, {
          effect: ['execute'],
          network: 'arbitrary',
          docs: VERCEL,
        }),
        operands: ['path'],
        values: valuesOf('text', ['-l', '--listen']),
      },
      build: {
        facts: opaqueFact('Builds a project on this computer the way Vercel would.', VERCEL_BUILD, {
          effect: ['read', 'create', 'write', 'execute'],
          network: 'arbitrary',
          docs: VERCEL,
        }),
        values: { '--output': 'path', '--target': 'text' },
      },
      env: {
        facts: changes('Lists, adds, removes or downloads the secret settings a project keeps on Vercel.', VERCEL, ['read', 'create', 'write', 'delete', 'transmit'], {
          touchesCredentials: true,
          reversible: 'no',
        }),
        operands: ['text'],
      },
      'env ls': { facts: reads('Lists the names of the secret settings a project keeps on Vercel.', VERCEL), operands: ['text'] },
      'env list': { facts: reads('Lists the names of the secret settings a project keeps on Vercel.', VERCEL), operands: ['text'] },
      'env add': {
        facts: changes('Adds a secret setting to a project on Vercel.', VERCEL, ['create', 'transmit'], { touchesCredentials: true }),
        operands: ['text'],
      },
      'env rm': { facts: removes('Removes a secret setting from a project on Vercel.', VERCEL, { touchesCredentials: true }), operands: ['text'] },
      'env pull': {
        facts: fact('Saves the secret settings a project keeps on Vercel to a file here, in readable form.', {
          effect: ['read', 'create', 'write'],
          network: 'known-host',
          touchesCredentials: true,
          reversible: 'no',
          docs: VERCEL,
        }),
        operands: ['path'],
        values: valuesOf('text', ['--environment', '--git-branch']),
      },
      pull: {
        facts: fact('Downloads the settings of a project on Vercel to this folder, its secret ones included.', {
          effect: ['read', 'create', 'write'],
          network: 'known-host',
          touchesCredentials: true,
          reversible: 'no',
          docs: VERCEL,
        }),
        operands: ['path'],
        values: valuesOf('text', ['--environment', '--git-branch']),
      },
      link: {
        facts: fact('Connects a folder here to a project on Vercel.', { effect: ['create', 'configure'], network: 'known-host', reversible: 'unknown', docs: VERCEL }),
        operands: ['path'],
        values: valuesOf('text', ['-p', '--project']),
      },
      login: {
        facts: fact('Signs in to Vercel and keeps the sign-in on this computer.', { effect: ['create', 'configure'], network: 'known-host', touchesCredentials: true, docs: VERCEL }),
        operands: ['text'],
      },
      logout: {
        facts: fact('Signs out of Vercel and removes the saved sign-in from this computer.', {
          effect: ['delete', 'configure'],
          network: 'known-host',
          touchesCredentials: true,
          reversible: 'unknown',
          docs: VERCEL,
        }),
      },
      whoami: { facts: reads('Shows which Vercel account is signed in.', VERCEL) },
      ls: { facts: reads('Lists the uploads of a project on Vercel.', VERCEL), operands: ['text'], values: VERCEL_LIST },
      list: { facts: reads('Lists the uploads of a project on Vercel.', VERCEL), operands: ['text'], values: VERCEL_LIST },
      inspect: { facts: reads('Shows the details of one upload of a project on Vercel.', VERCEL), operands: ['text'], values: valuesOf('text', ['--timeout']) },
      logs: { facts: reads('Shows what a project on Vercel has written to its log.', VERCEL), operands: ['text'] },
      rm: {
        facts: removes('Removes uploads, or a whole project, from Vercel.', VERCEL),
        operands: ['text'],
        flags: [{ flags: ['-y', '--yes'], facts: { note: 'It does not ask before removing them.' } }],
      },
      remove: {
        facts: removes('Removes uploads, or a whole project, from Vercel.', VERCEL),
        operands: ['text'],
        flags: [{ flags: ['-y', '--yes'], facts: { note: 'It does not ask before removing them.' } }],
      },
      promote: { facts: changes('Makes an earlier upload of a project the one its live address shows.', VERCEL, ['write', 'transmit'], { repeatSafe: true }), operands: ['text'], values: valuesOf('text', ['--timeout']) },
      rollback: { facts: changes('Puts the live address of a project on Vercel back to an earlier upload.', VERCEL, ['write', 'transmit'], { repeatSafe: true }), operands: ['text'], values: valuesOf('text', ['--timeout']) },
    },
  },
  VERCEL_VALUES,
  VERCEL_KEYS,
)

export const CLOUD: Record<string, Entry> = {
  aws: AWS_ENTRY,
  doppler: DOPPLER_ENTRY,
  gcloud: GCLOUD_ENTRY,
  gh: GH_ENTRY,
  helm: HELM_ENTRY,
  kubectl: KUBECTL,
  op: OP_ENTRY,
  terraform: TERRAFORM,
  vercel: VERCEL_ENTRY,
}

