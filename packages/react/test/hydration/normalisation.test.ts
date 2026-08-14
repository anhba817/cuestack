import { describe, expect, it } from 'vitest'
import { canonical } from '../harness/render.js'

/**
 * The normaliser used by every hydration comparison, tested for what it must *not* forgive.
 *
 * `canonical()` exists because React and a browser's CSSOM serialise the same declarations
 * differently, and a second render therefore changed the string without changing anything
 * real. A normaliser is a dangerous thing to add to an equality suite: too broad, and the
 * whole suite goes green while proving nothing. So the differences it must still catch are
 * asserted directly.
 */
describe('the hydration normaliser', () => {
  it('forgives declaration spacing', () => {
    expect(canonical('<i style="--a: 1; --b: 2;"/>')).toBe(canonical('<i style="--a:1;--b:2"/>'))
  })

  it('forgives declaration order', () => {
    expect(canonical('<i style="--b:2;--a:1"/>')).toBe(canonical('<i style="--a:1;--b:2"/>'))
  })

  it('catches a different value', () => {
    expect(canonical('<i style="--a:1"/>')).not.toBe(canonical('<i style="--a:2"/>'))
  })

  it('catches a missing declaration', () => {
    expect(canonical('<i style="--a:1"/>')).not.toBe(canonical('<i style="--a:1;--b:2"/>'))
  })

  it('catches an extra declaration', () => {
    expect(canonical('<i style="--a:1;--b:2;--c:3"/>')).not.toBe(canonical('<i style="--a:1;--b:2"/>'))
  })

  it('forgives React\'s empty text separators', () => {
    expect(canonical('<i>a<!-- -->b</i>')).toBe(canonical('<i>ab</i>'))
  })

  it('does not forgive a non-empty comment', () => {
    // Only the empty separator. A comment with content in it is content.
    expect(canonical('<i>a<!-- note -->b</i>')).not.toBe(canonical('<i>ab</i>'))
  })

  it('still catches a text difference around a separator', () => {
    expect(canonical('<i>a<!-- -->b</i>')).not.toBe(canonical('<i>a<!-- -->c</i>'))
  })

  it('forgives attribute order', () => {
    expect(canonical('<input type="radio" name="a"/>')).toBe(canonical('<input name="a" type="radio"/>'))
  })

  it('catches a changed attribute value despite reordering', () => {
    expect(canonical('<input type="radio" name="a"/>')).not.toBe(canonical('<input name="b" type="radio"/>'))
  })

  it('catches a missing or extra attribute', () => {
    expect(canonical('<input type="radio"/>')).not.toBe(canonical('<input type="radio" name="a"/>'))
  })

  it('treats an empty value and a bare attribute as the same', () => {
    expect(canonical('<input readonly=""/>')).toBe(canonical('<input readonly/>'))
  })

  it('keeps tag names distinct', () => {
    expect(canonical('<input name="a"/>')).not.toBe(canonical('<select name="a"/>'))
  })

  it('touches nothing outside the style attribute', () => {
    expect(canonical('<i class="a" data-x="1"/>')).toBe('<i class="a" data-x="1"/>')
    expect(canonical('<i class="a"/>')).not.toBe(canonical('<i class="b"/>'))
    expect(canonical('<i>x</i>')).not.toBe(canonical('<i>y</i>'))
  })

  it('leaves whitespace elsewhere alone, including inside text', () => {
    // A normaliser that collapsed all whitespace would hide a genuine text difference.
    expect(canonical('<i>a  b</i>')).not.toBe(canonical('<i>a b</i>'))
  })
})
