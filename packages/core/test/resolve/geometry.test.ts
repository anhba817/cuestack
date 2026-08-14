import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { effect, slide, textElement } from '../harness/corpus.js'

describe('geometry and the empty-effect case', () => {
  it('an element with no effects is fully opaque at its authored geometry', () => {
    const s = slide([textElement({ x: 120, y: 80, width: 400, height: 100, effects: [] })])
    const el = resolve(s, 500).elements[0]!
    expect(el.opacity).toBe(1)
    expect(el.geometry).toEqual({ x: 120, y: 80, width: 400, height: 100, rotation: 0 })
    expect(el.transform).toEqual({ translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotate: 0 })
    expect(el.filter).toBeNull()
    expect(el.activeEffects).toEqual([])
  })

  it('keeps transform separate from geometry so the editor can show authored values', () => {
    const s = slide([
      textElement({
        x: 200,
        startMs: 0,
        endMs: 3000,
        effects: [effect({ type: 'slide', phase: 'enter', startMs: 0, durationMs: 1000, order: 1 })],
      }),
    ])
    const el = resolve(s, 300).elements[0]!
    expect(el.geometry.x).toBe(200) // authored position, unmoved
    expect(el.transform.translateX !== 0 || el.transform.translateY !== 0).toBe(true)
  })

  it('carries the authored rotation through', () => {
    const s = slide([textElement({ rotation: 12, effects: [] })])
    expect(resolve(s, 0).elements[0]!.geometry.rotation).toBe(12)
  })

  it('passes the payload through untouched — the kernel does not interpret content', () => {
    const payload = { text: 'unchanged' }
    const s = slide([textElement({ payload, effects: [] })])
    expect(resolve(s, 0).elements[0]!.payload).toEqual(payload)
  })
})
