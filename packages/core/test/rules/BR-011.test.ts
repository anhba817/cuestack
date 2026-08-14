import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { slide, textElement } from '../harness/corpus.js'

/** BR-011 — locked elements resolve exactly as unlocked ones. */
describe('BR-011', () => {
  it('a locked element resolves identically to an unlocked one', () => {
    const common = { id: 'el', startMs: 0, endMs: 1000, effects: [] }
    const unlocked = resolve(slide([textElement({ ...common, locked: false })]), 500)
    const locked = resolve(slide([textElement({ ...common, locked: true })]), 500)
    expect({ ...locked, slideId: '' }).toEqual({ ...unlocked, slideId: '' })
  })

  it('locking is authoring state and is not carried into the render state', () => {
    const state = resolve(slide([textElement({ locked: true, effects: [] })]), 0)
    expect(state.elements[0]).not.toHaveProperty('locked')
  })
})
