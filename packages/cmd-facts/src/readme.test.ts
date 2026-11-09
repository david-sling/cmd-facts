import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { explain } from './index.ts'
import type { Explanation } from './explain.ts'

// The README shows what `explain()` answers. Commented-out output is nobody's job to keep true, so each block is
// real JSON and this checks it against the real answer. A block may show a subset — the fields that make the point —
// and every field it does show has to match, at any depth.
const README = readFileSync(new URL('../../../README.md', import.meta.url), 'utf8')

const FENCE = /^```(\w*)\n([\s\S]*?)^```$/gm
const CALL = /explain\('([^']+)'\)/

// Paired by position, not by one regex over the whole file: a lazy match would run past a `ts` block that has no
// output of its own and pair it with the next block's.
const blocks = [...README.matchAll(FENCE)].map((m) => ({ lang: m[1] ?? '', body: m[2] ?? '' }))
const shown = blocks.flatMap(({ lang, body }, i) => {
  const line = lang === 'ts' && blocks[i + 1]?.lang === 'json' ? CALL.exec(body)?.[1] : undefined
  return line ? [{ line, expected: JSON.parse(blocks[i + 1]!.body) as Record<string, unknown> }] : []
})

/** Every key the README shows, compared against the real value; keys it leaves out are ignored. */
function subset(actual: unknown, expected: unknown, where: string): void {
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), where).toBe(true)
    const got = actual as unknown[]
    expect(got.length, `${where} length`).toBe(expected.length)
    expected.forEach((v, i) => subset(got[i], v, `${where}[${i}]`))
    return
  }
  if (expected && typeof expected === 'object') {
    expect(actual, where).toBeTypeOf('object')
    for (const [k, v] of Object.entries(expected)) subset((actual as Record<string, unknown>)[k], v, `${where}.${k}`)
    return
  }
  expect(actual, where).toEqual(expected)
}

describe('the README shows what the library actually answers', () => {
  it('has examples to check', () => {
    expect(shown.length).toBeGreaterThanOrEqual(3)
  })

  it.each(shown)('$line', ({ line, expected }) => {
    const got = explain(line) as unknown as Record<string, unknown>
    subset(got, expected, 'explain')
  })

  // The headline example is the one a reader takes the shape of the whole schema from.
  it('shows every field of a complete fact set in the headline example', () => {
    const headline = shown[0]
    expect(headline?.line).toBe('curl -fsSL https://get.example.com/install.sh -o install.sh')
    const facts = (headline?.expected['facts'] ?? {}) as Record<string, unknown>
    const real = explain(headline!.line) as Explanation
    expect(Object.keys(facts).sort()).toEqual(Object.keys(real.facts).sort())
  })
})
