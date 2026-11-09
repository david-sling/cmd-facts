import { describe, expect, it } from 'vitest'
import SCHEMA from '../schema/pack.schema.json'
import { CONFIDENCE, EFFECTS, NETWORK, PRIVILEGE, REVERSIBLE } from './facts.ts'
import { ROLES } from './entry.ts'

// The schema is for authoring: an editor completing a pack written as JSON. `validate()` is what enforces the rules
// at registration, and it checks consistency a schema cannot express. These two can only disagree about the one
// thing a schema does carry on its own, which is the set of values each field may hold.
const defs = SCHEMA.$defs as unknown as Record<string, { enum?: string[] }>

describe('the published schema and the exported vocabularies agree', () => {
  it.each([
    ['effect', EFFECTS],
    ['role', ROLES],
    ['reversible', REVERSIBLE],
    ['network', NETWORK],
    ['privilege', PRIVILEGE],
    ['confidence', CONFIDENCE],
  ])('$0', (name, values) => {
    expect(defs[name as string]?.enum).toEqual(values)
  })

  it('carries every source a consumer can be handed', () => {
    expect(defs['source']?.enum).toContain('plugin')
    expect(defs['source']?.enum).toContain('unknown')
  })
})
