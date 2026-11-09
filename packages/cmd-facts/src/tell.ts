import type { Facts, Segment, Slot } from './facts.ts'
import type { Role } from './entry.ts'
import type { ArgSlot, Explanation } from './explain.ts'

/**
 * One piece of the sentence a consumer renders. Prose comes from the row and can be shown as it is. Values came off
 * the command line, so they are handed over as values: a consumer shows them in their own type, shortens them,
 * counts them, or looks them up against whatever it knows about this computer — and a person can see where the
 * row's words stop and the command's own text starts.
 */
export type Part =
  | { kind: 'text'; text: string }
  | { kind: 'values'; values: string[]; role: Role; flag?: string; show?: 'host' }

const host = (value: string): string => {
  try {
    return new URL(value).host || value
  } catch {
    return value
  }
}

function pick(args: ArgSlot[], slot: Slot): ArgSlot[] {
  const of = args.filter((a) => a.role === slot.role)
  if (!of.length) return []
  switch (slot.which) {
    case 'all':
      return of
    case 'last':
      return of.slice(-1)
    case 'all-but-last':
      return of.length > 1 ? of.slice(0, -1) : []
    case undefined:
    case 'first':
      return of.slice(0, 1)
    default:
      return of[slot.which] ? [of[slot.which]!] : []
  }
}

/**
 * The sentence for one fact set, in pieces, with the command's own arguments in it. `explain()` has already done
 * this — every explanation carries `parts` and `sentence` — so reach for it only to re-render some other pairing.
 *
 * A row that has no `tell`, and one whose line does not carry an argument for every slot, both fall back to `says`
 * whole. A sentence is never rendered with a hole in it: a reader who is about to approve something should not have
 * to work out which words were missing.
 */
export function partsOf(facts: Facts, args: ArgSlot[]): Part[] {
  const said: Part[] = [{ kind: 'text', text: facts.says }]
  const tell: Segment[] | undefined = facts.tell
  if (!tell?.length) return said

  const parts: Part[] = []
  for (const segment of tell) {
    if (typeof segment === 'string') {
      parts.push({ kind: 'text', text: segment })
      continue
    }
    const found = pick(args, segment)
    if (!found.length) return said
    parts.push({
      kind: 'values',
      values: found.map((a) => (segment.show === 'host' ? host(a.value) : a.value)),
      role: segment.role,
      ...(found[0]!.flag ? { flag: found[0]!.flag } : {}),
      ...(segment.show ? { show: segment.show } : {}),
    })
  }
  return parts
}

/** The same, for an explanation that already holds both halves. */
export const tellOf = (e: Explanation): Part[] => partsOf(e.facts, e.args)

/**
 * The pieces joined into one sentence, with several values listed by commas and `and`. This is what `sentence` on an
 * explanation holds. It is the right thing to show a person; it is the wrong thing to build a UI out of, because the
 * argument text is now inside the words. Where a consumer can render the two apart, `parts` lets it.
 */
export const flatten = (parts: Part[]): string =>
  parts
    .map((p) => (p.kind === 'text' ? p.text : list(p.values)))
    .join('')
    .trim()

const list = (values: string[]): string =>
  values.length <= 1 ? (values[0] ?? '') : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`
