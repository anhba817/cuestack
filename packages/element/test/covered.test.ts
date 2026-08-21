import { describe, expect, it } from 'vitest'
import { ELEMENT_TYPES } from '@cuestack/schema/validate'
import { COVERED, NOT_COVERED, covers } from '../src/covered.js'

/**
 * What this adapter renders, asserted against the format's own list rather than a hand-written one.
 *
 * A new element type in the schema fails here until somebody decides which side of the line it is
 * on — which is the only way a subset adapter stays honest as the format grows. The alternative is a
 * type that silently joins the unavailable set because nobody looked.
 */
describe('the covered set', () => {
  it('is exactly text, shape, and image', () => {
    expect([...COVERED].sort()).toEqual(['image', 'shape', 'text'])
  })

  it('accounts for every type the format declares', () => {
    // No type may be in neither list, and none in both.
    const all = [...ELEMENT_TYPES].sort()
    expect([...COVERED, ...NOT_COVERED].sort()).toEqual(all)
    expect([...COVERED].filter((t) => (NOT_COVERED as readonly string[]).includes(t))).toEqual([])
  })

  it('leaves media, buttons, and questions out', () => {
    expect([...NOT_COVERED].sort()).toEqual(['audio', 'button', 'question', 'video'])
  })

  it('answers for a type the format has never heard of', () => {
    // A third-party type cannot appear in a valid manifest, but the resolver can still be handed
    // one — and "not covered" is the honest answer rather than a crash.
    expect(covers('gauge')).toBe(false)
  })

  it('is one list, which is the point of the module', () => {
    /**
     * The renderers and the unavailable path both read this. Two lists would let a type be rendered
     * by one and apologised for by the other, which is a blank rectangle nobody can explain.
     */
    for (const type of COVERED) expect(covers(type)).toBe(true)
    for (const type of NOT_COVERED) expect(covers(type)).toBe(false)
  })
})
