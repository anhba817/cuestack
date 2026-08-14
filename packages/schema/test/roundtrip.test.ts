import { describe, expect, it } from 'vitest'
import { validate } from '../src/validate/index.js'
import { reference } from './helpers.js'

/** FR-006 / SC-003: export then import yields an equivalent lesson. */
describe('round-trip fidelity', () => {
  it('survives serialize -> parse -> validate with no content loss', () => {
    const original = reference()
    const first = validate(original)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const serialized = JSON.stringify(first.lesson)
    const second = validate(JSON.parse(serialized))
    expect(second.ok).toBe(true)
    if (!second.ok) return

    expect(second.lesson).toEqual(first.lesson)
  })

  it('preserves every field of the source document', () => {
    const original = reference()
    const result = validate(original)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Defaults may be filled in, but nothing authored may be dropped.
    expect(result.lesson).toMatchObject(original)
  })

  it('is stable across repeated round-trips', () => {
    let current: unknown = reference()
    for (let i = 0; i < 3; i++) {
      const r = validate(current)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      current = JSON.parse(JSON.stringify(r.lesson))
    }
    const final = validate(current)
    expect(final.ok).toBe(true)
    if (!final.ok) return
    expect(final.lesson).toEqual(current)
  })
})
