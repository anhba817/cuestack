import { describe, expect, it } from 'vitest'
import { declarationsFor, resolveValue, rules, stageBox, stylesheet } from '../harness/css.js'
import { lessonOf, slide } from '../harness/corpus.js'
import { stageProperties } from '../../src/theme/tokens.js'

/**
 * The stylesheet chooses between the two answers the kernel emits.
 *
 * Evaluated rather than pattern-matched: `var(--cs-r-tx, 0)` and `var(--cs-tx, 0)` have the
 * same shape and opposite meanings, and only resolving them catches a mirrored name typed
 * wrong. The CSS evaluator from feature 003 already does this for scaling.
 */

const stageVars = stageProperties(lessonOf([slide([])])) as Record<string, string>

/** The declarations the reduced-motion media block contributes to `.cs-element`. */
function reducedBlock(): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const rule of rules(stylesheet('stage.css'))) {
    if (!rule.media?.includes('prefers-reduced-motion')) continue
    if (!rule.selectors.includes('.cs-element')) continue
    Object.assign(merged, rule.declarations)
  }
  return merged
}

describe('the reduced-motion block', () => {
  const block = reducedBlock()

  it('exists', () => {
    expect(Object.keys(block).length).toBeGreaterThan(0)
  })

  it('prefers the kernel’s reduced value for every visual property', () => {
    for (const [normal, reduced] of [
      ['--cs-opacity', '--cs-r-opacity'],
      ['--cs-tx', '--cs-r-tx'],
      ['--cs-ty', '--cs-r-ty'],
      ['--cs-sx', '--cs-r-sx'],
      ['--cs-sy', '--cs-r-sy'],
      ['--cs-rotate', '--cs-r-rotate'],
    ]) {
      expect(block[normal!], `${normal} does not read ${reduced}`).toContain(`var(${reduced}`)
    }
  })

  it('uses the reduced value when the kernel emitted one', () => {
    const vars = { ...stageVars, '--cs-r-tx': '0', '--cs-tx': '40' }
    expect(resolveValue(block['--cs-tx']!, vars, stageBox(1024, stageVars))).toBe(0)
  })

  it('falls back to no motion when the kernel emitted none', () => {
    // Wave 2's floor, kept for an effect whose author declared no alternative.
    const vars = { ...stageVars, '--cs-tx': '40' }
    expect(resolveValue(block['--cs-tx']!, vars, stageBox(1024, stageVars))).toBe(0)
    expect(resolveValue(block['--cs-sx']!, vars, stageBox(1024, stageVars))).toBe(1)
  })

  it('keeps the reduced opacity rather than forcing it to one', () => {
    // The substitution *is* a fade. Neutralising opacity along with the transforms would
    // make a slide-in appear instantly, which is what Wave 2 did and what BR-015 forbids.
    const vars = { ...stageVars, '--cs-r-opacity': '0.4', '--cs-opacity': '0.4' }
    expect(resolveValue(block['--cs-opacity']!, vars, stageBox(1024, stageVars))).toBeCloseTo(0.4, 5)
  })

  it('preserves the normal opacity when no reduced value was emitted', () => {
    // An element mid-fade under reduced motion still fades: a fade is not motion.
    const vars = { ...stageVars, '--cs-opacity': '0.3' }
    expect(resolveValue(block['--cs-opacity']!, vars, stageBox(1024, stageVars))).toBeCloseTo(0.3, 5)
  })

  it('no longer zeroes the transforms unconditionally', () => {
    // The Wave 2 behaviour this replaces. A literal `0` here would ignore whatever the
    // kernel computed.
    expect(block['--cs-tx']).not.toBe('0')
    expect(block['--cs-sx']).not.toBe('1')
  })
})

describe('the element rule still consumes what the block sets', () => {
  it('reads every property the reduced block overrides', () => {
    // The indirection only works because `.cs-element` consumes `--cs-tx` rather than a
    // literal. If a later change inlined a transform, the media block would silently stop
    // having any effect.
    const element = declarationsFor('.cs-element')
    expect(element['transform']).toContain('--cs-tx')
    expect(element['transform']).toContain('--cs-sx')
    expect(element['opacity']).toContain('--cs-opacity')
  })
})
