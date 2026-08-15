import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { effect, slide, textElement } from '../harness/corpus.js'

/**
 * The resolver emits **both** answers: the normal visual and, where a motion effect is
 * active, its reduced alternative.
 *
 * Both are pure functions of `(slide, timeMs)`. The resolver does not know the preference,
 * cannot read it, and never branches on it — which is what keeps the parity sweep meaningful,
 * since it can compare both.
 *
 * FR-028 is what forces this shape: the preference must be honoured on the first rendered
 * frame, that frame is produced on a server which cannot read it, so the choice belongs to
 * CSS at paint time — and both answers have to already be in the markup for CSS to choose.
 */

const moving = (at = 0) =>
  slide([
    textElement({
      startMs: 0,
      endMs: 4000,
      effects: [effect({ type: 'slide', phase: 'enter', startMs: at, durationMs: 1000, order: 1 })],
    }),
  ])

const still = () =>
  slide([
    textElement({
      startMs: 0,
      endMs: 4000,
      effects: [effect({ type: 'fade', phase: 'enter', startMs: 0, durationMs: 1000, order: 1 })],
    }),
  ])

describe('when nothing moving is active', () => {
  it('is null for an element with no effects at all', () => {
    const el = resolve(slide([textElement({ effects: [] })]), 500).elements[0]!
    expect(el.reduced).toBeNull()
  })

  it('is null for an element whose active effect does not move', () => {
    // A fade is already its own reduced form. Emitting a second identical set would double
    // what the frame writer writes for no gain.
    expect(resolve(still(), 500).elements[0]!.reduced).toBeNull()
  })

  it('is null once a moving effect has finished', () => {
    // After the effect's window the element sits at its authored state, which reduced motion
    // does not change.
    expect(resolve(moving(), 3000).elements[0]!.reduced).toBeNull()
  })
})

describe('when a moving effect is active', () => {
  const el = () => resolve(moving(), 500).elements[0]!

  it('is present', () => {
    expect(el().reduced).not.toBeNull()
  })

  it('carries no movement', () => {
    const reduced = el().reduced!
    expect(reduced.transform).toEqual({ translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotate: 0 })
  })

  it('keeps the opacity the effect would have given', () => {
    // The substitution replaces the movement, not the fade. Content still arrives when it
    // was authored to arrive.
    const element = el()
    expect(element.reduced!.opacity).toBeCloseTo(element.opacity, 5)
  })

  it('differs from the normal visual, or there would be no point emitting it', () => {
    const element = el()
    expect(element.transform).not.toEqual(element.reduced!.transform)
  })
})

describe('timing is preserved (FR-026)', () => {
  it('reaches its end state at the same moment as the effect it replaces', () => {
    const atEnd = resolve(moving(), 1000).elements[0]!
    // At the effect's end both agree entirely: the substitution has finished when the
    // original would have.
    expect(atEnd.reduced).toBeNull()
    expect(atEnd.opacity).toBe(1)
  })

  it('runs over the same interval, not a shorter one', () => {
    // A substitution that completed early would change *when* content appears, which is the
    // meaning a learner is entitled to keep.
    const early = resolve(moving(), 250).elements[0]!
    const late = resolve(moving(), 750).elements[0]!
    expect(early.reduced!.opacity).toBeLessThan(late.reduced!.opacity)
    expect(late.reduced!.opacity).toBeLessThan(1)
  })
})

describe('both answers are pure', () => {
  it('gives the same pair for the same slide and time', () => {
    const first = resolve(moving(), 400).elements[0]!
    const second = resolve(moving(), 400).elements[0]!
    expect(second.reduced).toEqual(first.reduced)
    expect(second.transform).toEqual(first.transform)
  })

  it('does not depend on the order moments are asked for', () => {
    // Seeking backwards must give the same reduced visual as arriving forwards, exactly as
    // for the normal one. Principle V applies to both answers.
    const forwards = [200, 400, 600].map((t) => resolve(moving(), t).elements[0]!.reduced)
    const backwards = [600, 400, 200].map((t) => resolve(moving(), t).elements[0]!.reduced).reverse()
    expect(backwards).toEqual(forwards)
  })
})
