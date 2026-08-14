import { describe, expect, it } from 'vitest'
import { describeFormat } from '../src/validate/introspect.js'

/**
 * SC-009, first clause: "No field in the format can hold a learner identifier
 * or an author credential, demonstrated by an automated check over the format
 * definition itself."
 *
 * This is the complement to unknown-field.test.ts. That file proves an
 * *injected* field is refused; this one proves no such field was ever
 * *defined*. Both are needed: a schema that legitimately declared `ownerId`
 * would pass the injection test and still violate the invariant.
 */
describe('format definition carries no identity', () => {
  const fields = describeFormat()

  it('describes a non-trivial number of fields', () => {
    expect(fields.length).toBeGreaterThan(30)
  })

  const forbidden = [
    /learner/i,
    /student/i,
    /^user(id|name)?$/i,
    /owner/i,
    /author(id)?$/i,
    /credential/i,
    /password/i,
    /secret/i,
    /token/i,
    /apikey/i,
    /email/i,
    /(^|[^a-z])ip($|[^a-z])/i,
    /session/i,
    /workspace/i,
    /createdat/i,
    /updatedat/i,
    /timestamp/i,
  ]

  it('defines no field whose name suggests an identity or credential', () => {
    const offenders = fields.filter((f) =>
      forbidden.some((pattern) => pattern.test(f.name)),
    )
    expect(offenders.map((o) => o.path)).toEqual([])
  })

  it('defines no free-form container that could hold arbitrary nested data', () => {
    // `metadata` is allowed but constrained to string values — see data-model.md.
    const openEnded = fields.filter((f) => f.kind === 'unconstrained-record')
    expect(openEnded.map((o) => o.path)).toEqual([])
  })

  it('defines no date or datetime field anywhere in the format', () => {
    const temporal = fields.filter((f) => f.kind === 'date')
    expect(temporal.map((o) => o.path)).toEqual([])
  })
})
