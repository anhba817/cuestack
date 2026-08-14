import { describe, expect, it } from 'vitest'
import { validate } from '../src/validate/index.js'
import { describeFormat } from '../src/validate/introspect.js'
import { withReference } from './helpers.js'

/**
 * The fallback paths in map-issue.ts and introspect.ts. These are the branches a
 * fixture corpus does not reach: malformed input that lands in a default arm
 * rather than a named rule. Left untested they would be the arms most likely to
 * be silently wrong, since nothing else exercises them.
 */
describe('issue mapping edge cases', () => {
  it('falls back to TYPE_MISMATCH for an unclassified custom check', () => {
    const r = validate(withReference((m) => { m.slides[0].elements[0].payload.text = 42 }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues.map((i) => i.code)).toContain('TYPE_MISMATCH')
  })

  it('classifies a non-array slides value rather than crashing', () => {
    const r = validate(withReference((m) => { m.slides = 'not an array' }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues.length).toBeGreaterThan(0)
  })

  it('handles a union failure outside elements and effects', () => {
    const r = validate(withReference((m) => { m.slides[0].background = { kind: 'plaid' } }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues.map((i) => i.code)).toContain('ENUM_VALUE_INVALID')
  })

  it('reports a too_small violation on a non-ms field as a type mismatch', () => {
    const r = validate(withReference((m) => { m.lesson.title = '' }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues.map((i) => i.code)).toContain('TYPE_MISMATCH')
  })

  it('reports a too_big violation as a type mismatch', () => {
    const r = validate(withReference((m) => { m.lesson.title = 'x'.repeat(500) }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues.map((i) => i.code)).toContain('TYPE_MISMATCH')
  })

  it('resolves a location when the slide index is not a number', () => {
    const r = validate({ schemaVersion: '1.0', lesson: {}, slides: [] })
    expect(r.ok).toBe(false)
    if (r.ok) return
    for (const issue of r.issues) expect(issue.location).toBeDefined()
  })

  it('describes an object value in a message when geometry is an object', () => {
    const r = validate(withReference((m) => { m.slides[0].elements[0].x = { value: 1 } }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    const issue = r.issues.find((i) => i.code === 'GEOMETRY_NOT_NUMERIC')
    expect(issue?.message).toContain('an object')
  })

  it('describes null and array values distinctly', () => {
    const asNull = validate(withReference((m) => { m.slides[0].elements[0].x = null }))
    expect(asNull.ok).toBe(false)
    if (asNull.ok) return
    expect(asNull.issues.find((i) => i.code === 'GEOMETRY_NOT_NUMERIC')?.message).toContain('null')

    const asArray = validate(withReference((m) => { m.slides[0].elements[0].y = [1, 2] }))
    expect(asArray.ok).toBe(false)
    if (asArray.ok) return
    expect(asArray.issues.find((i) => i.code === 'GEOMETRY_NOT_NUMERIC')?.message).toContain('an array')
  })

  it('reports an unknown element type nested under a valid slide', () => {
    const r = validate(withReference((m) => { m.slides[3].elements[0].type = 'hologram' }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    const issue = r.issues.find((i) => i.code === 'UNKNOWN_ELEMENT_TYPE')
    expect(issue?.location.slideId).toBe('slide_wrap')
  })
})

describe('format introspection', () => {
  it('marks optional fields as optional and required fields as required', () => {
    const fields = describeFormat()
    const byPath = new Map(fields.map((f) => [f.path, f]))
    expect(byPath.get('lesson.title')?.optional).toBe(false)
    expect(byPath.get('lesson.description')?.optional).toBe(true)
  })

  it('walks into arrays and unions', () => {
    const paths = describeFormat().map((f) => f.path)
    expect(paths).toContain('slides[].elements[].startMs')
    expect(paths).toContain('slides[].elements[].effects[].phase')
  })

  it('produces a stable result across calls', () => {
    expect(JSON.stringify(describeFormat())).toBe(JSON.stringify(describeFormat()))
  })
})

describe('union fallbacks', () => {
  it('reports a non-enum union miss as a type mismatch', () => {
    const r = validate(withReference((m) => { m.slides[2].elements[0].payload.correctResponse = 42 }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues.map((i) => i.code)).toContain('TYPE_MISMATCH')
  })

  it('reports a bad transition type as an invalid enum value', () => {
    const r = validate(withReference((m) => { m.slides[0].transition.type = 'warp' }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues.map((i) => i.code)).toContain('ENUM_VALUE_INVALID')
  })
})
