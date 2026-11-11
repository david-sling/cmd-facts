import { CONFIDENCE, EFFECTS, NETWORK, PRIVILEGE, RANK, REVERSIBLE, effectsOf } from './facts.ts'
import type { Facts, Segment } from './facts.ts'
import { ROLES, reach } from './entry.ts'
import type { Entry, Role, Rule } from './entry.ts'

/**
 * A set of command rows shipped under one name, so a consumer can answer for tools this package has never heard of.
 *
 * A pack is data and only data: no functions, no matchers, no hook into parsing. A pack that could run code during a
 * lookup would see the command line, and nothing in this library is allowed to read meaning out of argument text.
 *
 * The envelope borrows its field names from schema.org's SoftwareSourceCode, so a manifest reads like any other
 * package manifest. The rows do not, and deliberately: there is no vocabulary out there for what a command does to a
 * computer, and bending one into shape would cost the `opaque` union that makes reading `effect` off a blind row a
 * type error rather than a lookup that quietly returns nothing.
 */
export type Pack = {
  /** Unique across the packs one consumer loads. This is the name `trust` and `override` refer to. */
  name: string
  version: string
  description?: string
  license?: string
  author?: string
  codeRepository?: string
  commands: Record<string, Entry>
}

/** One thing wrong with a pack, named where a person can find it. */
export type Problem = { where: string; says: string }

type Bad = (where: string, says: string) => void

const PACK_NAME = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
// A command name is the program basename `explain()` will look it up by, so a slash or a space could never match.
const COMMAND_NAME = /^[A-Za-z0-9][\w.+-]*$/
const SUB_KEY = /^[^\s-]\S*( [^\s-]\S*)*$/

const has = <T extends string>(all: T[], v: unknown): v is T => all.includes(v as T)

/**
 * Everything a pack has to hold to be safe to load: the shape of a fact set, the internal consistency the built-in
 * table holds itself to, and the grammar rules that decide where parsing recurses.
 *
 * Not checked here: register, jargon and the rest of the copy lints. Those are editorial, they are enforced on the
 * built-in table by the test suite, and a third-party pack should not fail to load because a sentence reads badly.
 * A pack author who wants them can run `rows(pack)` through the same lints.
 */
export function validate(pack: Pack): Problem[] {
  const problems: Problem[] = []
  const bad: Bad = (where, says) => void problems.push({ where, says })

  if (!PACK_NAME.test(pack?.name ?? '')) bad(String(pack?.name), 'A pack name is lowercase, optionally scoped: `@acme/kubectl`.')
  if (!pack?.version?.trim()) bad(pack?.name ?? '(pack)', 'A pack has to carry a version, so a consumer can record which one answered.')
  if (!pack?.commands || typeof pack.commands !== 'object') {
    bad(pack?.name ?? '(pack)', 'A pack has to carry a `commands` table.')
    return problems
  }

  for (const [name, entry] of Object.entries(pack.commands)) {
    if (!COMMAND_NAME.test(name)) bad(name, 'A command name is the program basename, with no slash and no spaces.')
    checkRule(bad, name, entry)
    checkGlobals(bad, name, entry)
    for (const [word, sub] of Object.entries(entry.sub ?? {})) {
      if (!SUB_KEY.test(word)) bad(`${name} ${word}`, 'A subcommand is one or more words split by single spaces, none starting with a dash.')
      checkRule(bad, `${name} ${word}`, sub)
      checkStandIn(bad, `${name} ${word}`, reach(entry), reach(sub))
      // A shorter subcommand answers for the longer ones under it that the table does not hold, as the base row does.
      const words = word.split(' ')
      for (let k = 1; k < words.length; k++) {
        const shorter = words.slice(0, k).join(' ')
        if (Object.hasOwn(entry.sub!, shorter)) checkStandIn(bad, `${name} ${word}`, reach(entry.sub![shorter]!), reach(sub), `\`${shorter}\``)
      }
    }
  }
  return problems
}

/**
 * A global option is held to the same rules as a flag, except that one which changes nothing still earns its place:
 * it is stepped over so the subcommand behind it resolves.
 */
function checkGlobals(bad: Bad, name: string, entry: Entry) {
  if (!entry.globals?.length) return
  if (!entry.sub) bad(name, '`globals` only means something where there is a subcommand table to step toward.')
  for (const g of entry.globals) {
    const at = `${name} ${g.flags?.[0] ?? '(unnamed global)'}`
    if (!g.flags?.length) {
      bad(name, 'A global option has to name at least one flag.')
      continue
    }
    for (const flag of g.flags) if (!flag.startsWith('-')) bad(at, `\`${flag}\` has to be declared with its dash.`)
    if (g.role && !has(ROLES, g.role)) bad(at, `\`${g.role}\` is not a known role.`)
    if (g.role && !g.takesValue) bad(at, 'A global that gives its value a role has to take a value.')
    if (g.role === 'command' && g.facts?.opaque !== true) bad(at, 'A global that holds another command has to leave the row opaque.')
    if ((g.facts as Record<string, unknown> | undefined)?.['opaque'] === false) bad(at, 'A global cannot make an opaque row clear again.')
    if (g.facts?.repeatSafe === true) bad(at, 'A global cannot claim a row is safe to repeat.')
    if (g.facts?.touchesCredentials === false) bad(at, 'A global cannot withdraw `touchesCredentials`.')
  }
}

function checkFacts(bad: Bad, where: string, f: Facts) {
  if (!f || typeof f !== 'object') return bad(where, 'The row carries no fact set.')
  if (!f.says?.trim()) bad(where, 'Every row needs a `says` sentence; it is what a person reads.')
  if (!has(REVERSIBLE, f.reversible)) bad(where, `\`reversible\` is one of ${REVERSIBLE.join(', ')}.`)
  if (!has(NETWORK, f.network)) bad(where, `\`network\` is one of ${NETWORK.join(', ')}.`)
  if (!has(PRIVILEGE, f.privilege)) bad(where, `\`privilege\` is one of ${PRIVILEGE.join(', ')}.`)
  if (!has(CONFIDENCE, f.confidence)) bad(where, `\`confidence\` is one of ${CONFIDENCE.join(', ')}.`)
  if (typeof f.touchesCredentials !== 'boolean') bad(where, '`touchesCredentials` is a boolean.')
  if (typeof f.repeatSafe !== 'boolean') bad(where, '`repeatSafe` is a boolean.')

  const effect = effectsOf(f) ?? []
  if (!effect.length) bad(where, 'A row has to name at least one effect.')
  for (const e of effect) if (!has(EFFECTS, e)) bad(where, `\`${e}\` is not one of the known effects.`)

  // The same consistency the built-in table holds itself to. A row that contradicts itself is worse than no row:
  // it reads as a measurement.
  if (effect.includes('delete') && f.reversible === 'yes') bad(where, 'A row that deletes cannot also say it can be put back.')
  if (effect.includes('transmit') && f.network === 'none') bad(where, 'A row that sends something cannot claim it touches no network.')
  if (effect.includes('elevate') && f.privilege === 'none') bad(where, 'A row that elevates cannot claim it needs no privilege.')
  if (f.privilege === 'root' && !effect.includes('elevate')) bad(where, 'A row that runs as root has to name the `elevate` effect.')

  if (f.opaque) {
    if (!f.handsOverTo?.trim()) bad(where, 'An opaque row has to name what it hands over to, in the same register as `says`.')
    if (f.reversible !== 'unknown' && f.reversible !== 'no') bad(where, 'An opaque row cannot promise that anything can be put back.')
    if (f.repeatSafe) bad(where, 'An opaque row cannot claim it is safe to repeat.')
  }
}

const WHICH = ['first', 'last', 'all', 'all-but-last']

/**
 * A slotted sentence is only worth having if it can be filled. The check that matters is the last one: a slot for a
 * role this row never gives an argument would fall back to `says` on every line forever, and silently.
 */
function checkTell(bad: Bad, where: string, tell: Segment[] | undefined, gives: Set<Role>, takers: Map<string, Role>) {
  if (tell === undefined) return
  if (!Array.isArray(tell) || !tell.length) return bad(where, '`tell` is a list of words and slots.')
  if (typeof tell[0] !== 'string') bad(where, '`tell` opens the sentence with the row\'s own words, never with a value off the command line.')
  const last = tell[tell.length - 1]
  if (typeof last !== 'string' || !last.trimEnd().endsWith('.')) bad(where, '`tell` ends the sentence, so it ends in a full stop.')

  const slots = tell.filter((x) => typeof x !== 'string')
  if (!slots.length) bad(where, 'A `tell` with no slot in it is `says` written twice.')
  for (const words of tell) {
    if (typeof words === 'string' && /[{}$%<>]/.test(words)) {
      bad(where, '`tell` carries its values in slots, not written into the words.')
    }
  }
  for (const slot of slots) {
    if (!has(ROLES, slot.role)) bad(where, `\`${slot.role}\` is not a known role.`)
    else if (!gives.has(slot.role)) bad(where, `\`tell\` asks for a \`${slot.role}\`, which this row never gives an argument.`)
    const which = slot.which
    if (which !== undefined && !WHICH.includes(which as string) && !(Number.isInteger(which) && (which as number) >= 0)) {
      bad(where, '`which` is first, last, all, all-but-last, or a number.')
    }
    if (slot.show !== undefined && slot.show !== 'host') bad(where, '`show` is `host`, or left out.')
    // An argument reports its flag as the first spelling of the rule it matched, so that is the spelling named here.
    if (slot.from !== undefined && slot.from !== 'operands' && takers.get(slot.from) !== slot.role) {
      bad(where, `\`from\` names \`${slot.from}\`, which has to be the first spelling of a flag rule here that takes a \`${slot.role}\`.`)
    }
  }
}

function checkRule(bad: Bad, where: string, rule: Rule) {
  checkFacts(bad, where, rule.facts)

  const gives = new Set<Role>([
    ...(rule.operands ?? []),
    ...Object.values(rule.values ?? {}),
    ...(rule.flags ?? []).flatMap((f) => [...(f.role ? [f.role] : []), ...(f.operands ?? [])]),
  ])
  const takers = new Map<string, Role>(
    (rule.flags ?? []).flatMap((f) => (f.takesValue && f.role && f.flags?.[0] ? [[f.flags[0], f.role] as [string, Role]] : [])),
  )
  checkTell(bad, where, rule.facts?.tell, gives, takers)
  for (const f of rule.flags ?? []) checkTell(bad, `${where} ${f.flags?.[0] ?? '(unnamed flag)'}`, f.facts?.tell, gives, takers)

  const named: Array<[string, Role]> = [
    ...(rule.operands ?? []).map((r, i): [string, Role] => [`operand ${i}`, r]),
    ...Object.entries(rule.values ?? {}),
  ]
  for (const [at, role] of named) if (!has(ROLES, role)) bad(where, `\`${role}\` at ${at} is not a known role.`)
  for (const flag of Object.keys(rule.values ?? {})) if (!flag.startsWith('-')) bad(where, `\`${flag}\` has to be declared with its dash.`)
  for (const flag of rule.plain ?? []) {
    if (typeof flag !== 'string' || !flag.startsWith('-')) bad(where, `\`${flag}\` in \`plain\` has to be declared with its dash.`)
    else if (rule.values?.[flag] !== undefined || (rule.flags ?? []).some((f) => f.flags?.includes(flag))) {
      bad(where, `\`${flag}\` is declared as plain and as something it does, which cannot both be true.`)
    }
  }

  // A position that holds another command is the handover itself, so a row that can produce one has to be opaque.
  const fixed: Role[] = [...(rule.operands ?? []), ...Object.values(rule.values ?? {})]
  if (fixed.includes('command') && !rule.facts?.opaque) bad(where, 'A row that holds another command in a position has to be opaque.')

  for (const f of rule.flags ?? []) {
    const at = `${where} ${f.flags?.[0] ?? '(unnamed flag)'}`
    if (!f.flags?.length) {
      bad(where, 'A flag rule has to name at least one flag.')
      continue
    }
    for (const flag of f.flags) if (!flag.startsWith('-')) bad(at, `\`${flag}\` has to be declared with its dash.`)
    if (f.role && !has(ROLES, f.role)) bad(at, `\`${f.role}\` is not a known role.`)
    if (f.role && !f.takesValue && !f.attached) bad(at, 'A flag that gives its value a role has to take a value.')
    if (f.attached && f.takesValue) bad(at, 'A flag takes its value from the next word or only attached to itself, not both.')
    if (f.operands !== undefined) {
      if (!Array.isArray(f.operands) || !f.operands.length) bad(at, '`operands` on a flag lists at least one role.')
      else for (const role of f.operands) if (!has(ROLES, role)) bad(at, `\`${role}\` in \`operands\` is not a known role.`)
      // A handover is found while the line is still being read, before a later flag could move it.
      if (Array.isArray(f.operands) && f.operands.includes('command')) bad(at, 'A flag cannot move another command into a position.')
      if (rule.operands?.includes('command')) bad(at, 'A flag cannot change the operands of a row whose operands hold a command.')
    }
    if (!Object.keys(f.facts ?? {}).length && !f.takesValue && !f.attached) bad(at, 'A flag that changes nothing and takes no value belongs in `plain`.')
    if (f.role === 'command' && !(rule.facts?.opaque || f.facts?.opaque === true)) {
      bad(at, 'A flag that holds another command has to leave the row opaque.')
    }
    // A flag may only widen the row it sits on, so a consumer that gated on the bare command is never surprised.
    // `opaque` is typed as `true | undefined`, but a pack can arrive as JSON, so the check reads the value rather
    // than trusting the type.
    if ((f.facts as Record<string, unknown> | undefined)?.['opaque'] === false) bad(at, 'A flag cannot make an opaque row clear again.')
    if (f.facts?.repeatSafe === true) bad(at, 'A flag cannot claim a row is safe to repeat.')
    if (f.facts?.touchesCredentials === false) bad(at, 'A flag cannot withdraw `touchesCredentials`.')
    if (f.facts?.reversible && rule.facts?.reversible === 'no') bad(at, 'A flag cannot soften a row that says nothing can be put back.')
  }

  const recurses = fixed.includes('command') || (rule.flags ?? []).some((f) => f.role === 'command')
  if (rule.nestedHere && !recurses) bad(where, 'A row that follows a nested command needs a position that holds one.')
  if (rule.assignmentsFirst && !rule.nestedHere) bad(where, '`assignmentsFirst` only means something where a nested command is followed.')
}

/**
 * The base row is what a line falls back to wherever the table has not read all of it: an unrecognised subcommand, or
 * a flag nobody has looked at. So with its flags it has to reach at least as far as every subcommand does with theirs.
 */
function checkStandIn(bad: Bad, where: string, base: Facts, sub: Facts, row = 'The base row') {
  if (!base || !sub) return
  // An opaque base row already admits it can do more than it names, and that nothing it does can be promised back,
  // so its effects stay a floor. A clear one claims a complete list, and that list has to hold for every subcommand.
  if (!base.opaque) {
    if (RANK.reversible[base.reversible] < RANK.reversible[sub.reversible]) {
      bad(where, `${row} says it is ${base.reversible} to put back, and this subcommand is ${sub.reversible}.`)
    }
    const missing = effectsOf(sub).filter((e) => !effectsOf(base).includes(e))
    if (missing.length) bad(where, `${row} does not name ${missing.join(', ')}, which this subcommand does.`)
  }
  if (!sub.repeatSafe && base.repeatSafe) bad(where, `${row} says it is safe to repeat, and this subcommand is not.`)
  if (sub.touchesCredentials && !base.touchesCredentials) bad(where, `${row} does not reach secrets, and this subcommand does.`)
  if (sub.opaque && !base.opaque) bad(where, `${row} is clear, and this subcommand hands over.`)
  if (RANK.network[base.network] < RANK.network[sub.network]) bad(where, `${row} claims less network reach than this subcommand has.`)
  if (RANK.privilege[base.privilege] < RANK.privilege[sub.privilege]) bad(where, `${row} claims less privilege than this subcommand needs.`)
}
