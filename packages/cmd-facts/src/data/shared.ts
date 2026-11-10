import type { Entry, FlagRule, Role } from '../entry.ts'

/**
 * Options a tool reads wherever they are on the line, given to the base row and to every subcommand, so that their
 * values are never read as the thing the line runs or installs. A flag a subcommand already declares is left to it,
 * and `except` names the ones a subcommand spells the same but reads as a switch (`conda list -c`).
 */
export const everywhere = (
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

/**
 * The same options as `globals`, so they are stepped over before the subcommand too (`kubectl -n web get pods`).
 * `flags` are rules that carry facts of their own, such as a key handed over on the line.
 */
export const globalsOf = (values: Record<string, Role>, flags: FlagRule[] = []): FlagRule[] => [
  ...Object.entries(values).map(([flag, role]): FlagRule => ({ flags: [flag], takesValue: true, role, facts: {} })),
  ...flags,
]
