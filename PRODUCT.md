# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TanStack Start (React + Vite + Nitro), chosen by the user. It matches the sibling `valet` project's web app, so
the routing, MDX and deploy patterns are already familiar. The page needs no server of its own: `cmd-facts` has
zero runtime dependencies and touches no Node builtins, so the live demo runs entirely in the browser.

## Users

**Primary:** the engineer wiring an approval surface and deciding what to show above a command the reader did not
write. Four confirmed situations, all from the README: a remote support session where a customer clicks Allow, a CI
gate where a release manager signs off, an agent asking before it runs a tool, and an admin console that logs who
approved what.

**Secondary, and never a visitor:** the person on the other side of that prompt, who is assumed never to have opened
a terminal. They do not come to this page, but their needs set the register of everything the library emits, and so
of the page that demonstrates it.

## Product Purpose

`explain()` returns structured facts about what a command does, so the surface showing it can render a plain-English
sentence, colour a button, gate a policy, or compute its own risk level. Success for this page is an engineer running
`npm i cmd-facts` and wiring `explain()` into their approval surface.

## Positioning

The schema is the deliverable; the sentence is one rendering of it, not the product. Four claims a neighbouring tool
could not truthfully copy, all of them deliberate refusals:

- **No risk or danger score.** Risk depends on the target, not the command. `rm` on a build folder and `rm` on a home
  folder are the same command. Facts here, scoring at the consumer, which knows the target.
- **No model and no inference at run time, now or later.** The command line is attacker-controlled. The failure mode
  being avoided is a fluent, reassuring sentence above a dangerous command; the library returns nothing instead.
- **No discovery.** A pack has to be named in a `createExplainer` call in the consumer's own source. No JSON
  directory, no env var, no scan of `node_modules`; the library reads neither disk nor network.
- **No footgun notes and no executable undo strings.** A command carrying a warning implies the ones without are fine.

It is not a man-page browser and not a linter.

## Operating Context

The library runs inside approval prompts, where the command line is attacker-controlled and nothing is read from the
agent or person requesting the command, including its stated reason. Consumers read the fields to make their own
decision; only consumers that must talk to a person read `says`.

## Capabilities and Constraints

- `explain(command)` returns `sentence`, `facts`, `program`, `args`, `escalated`, `attribution` and related fields.
- Fields include `effect`, `reversible`, `network`, `privilege`, `touchesCredentials`, `repeatSafe`, `opaque`,
  `confidence`, `source`, `note`, `docs`.
- Packs are registered through `createExplainer` with an explicit `trust` list. A pack not named in `trust` arrives at
  `confidence: derived`, so a consumer gating on `verified` never auto-approves a claim nobody vouched for.
- JSON Schema ships at `packages/cmd-facts/schema/pack.schema.json`.
- Published on npm as `cmd-facts`, currently 0.2.0, MIT. Zero runtime dependencies.
- Register is enforced by tests, not review: one sentence, ends in a full stop, under 150 characters, no term that
  assumes the reader knows what a command is (`folder` not `directory`, `program` not `binary`), no verdict about
  safety, no string that could be lifted out and run.
- `packages/cmd-facts/` is the only published thing. The library stays free of anything the page needs.

## Brand Commitments

- Name: `cmd-facts`. Repository `david-sling/cmd-facts`.
- Voice: plain, factual, unexcited. It states what happens; it never reassures, warns, or scores. The README's own
  register is the reference.
- Typography, chosen by the user and binding: **Manrope** for display and body, **Spline Sans Mono** for commands,
  paths and field values. No serif anywhere.
- Theme, chosen by the user and binding: the page is **dark**, with an animated mist background (`@spell/animated-gradient`, preset `Mist`) and that mist's pink, `#ed4fa6`, as the single accent. Reference images the user pinned live in `explorations/references/`.

## Evidence on Hand

- `README.md` at the repo root: ~25KB of real, finished prose with worked examples, the full field list, the pack
  model, and the refusals above. It is the strongest content asset and the page should draw copy from it.
- The library itself, importable in the browser, so the demo on the page can be real rather than a screenshot.
- The published npm package and its version.
- **Absent, and not to be invented:** testimonials, named customers, adoption numbers, benchmarks, download counts,
  pricing, case studies, logos, or any claim about who uses this.

## Product Principles

1. **Facts here, scoring at the consumer.** Never a number that a reader could mistake for policy.
2. **The schema is the deliverable.** Anything that makes the sentence look like the product misrepresents it.
3. **Silence beats a fluent wrong answer.** Coverage is never bought with a heuristic over argument text.
4. **Anything added is added in code.** No discovery, anywhere, for any reason.
5. **The reader is assumed never to have opened a terminal.** That register governs the product and the page alike.
