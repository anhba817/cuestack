import { describe, expect, it } from 'vitest'
import { validate } from '../src/validate/index.js'
import { withReference } from './helpers.js'

/**
 * FR-004 / US1 #6: geometry is stored in logical canvas units, independent of
 * the display size a lesson is viewed at.
 *
 * The enforcement is that a viewport-relative unit cannot be expressed at all.
 * Accepting "120px" would make the manifest's meaning depend on the device that
 * rendered it, which is the property FR-004 exists to prevent.
 */
describe('logical canvas geometry', () => {
  const axes = ['x', 'y', 'width', 'height'] as const
  const viewportUnits = ['120px', '50%', '10vw', '10vh', '2rem', '1em']

  it.each(axes)('rejects a string value for %s', (axis) => {
    const result = validate(withReference((m) => { m.slides[0].elements[0][axis] = '120px' }))
    expect(result.ok).toBe(false)
  })

  it.each(viewportUnits)('rejects the viewport-relative unit %s', (value) => {
    const result = validate(withReference((m) => { m.slides[0].elements[0].x = value }))
    expect(result.ok).toBe(false)
  })

  it.each(axes)('accepts a bare number for %s', (axis) => {
    const result = validate(withReference((m) => { m.slides[0].elements[0][axis] = 42 }))
    expect(result.ok).toBe(true)
  })

  it('rejects a non-finite coordinate', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(validate(withReference((m) => { m.slides[0].elements[0].x = bad })).ok).toBe(false)
    }
  })

  it('accepts a negative coordinate — off-canvas is a legitimate authoring state', () => {
    expect(validate(withReference((m) => { m.slides[0].elements[0].x = -50 })).ok).toBe(true)
  })

  it('rejects a non-positive width or height', () => {
    expect(validate(withReference((m) => { m.slides[0].elements[0].width = 0 })).ok).toBe(false)
    expect(validate(withReference((m) => { m.slides[0].elements[0].height = -10 })).ok).toBe(false)
  })

  it('validation outcome does not depend on aspect ratio', () => {
    for (const ratio of ['16:9', '4:3', '9:16']) {
      const result = validate(withReference((m) => { m.lesson.aspectRatio = ratio }))
      expect(result.ok).toBe(true)
    }
  })
})
