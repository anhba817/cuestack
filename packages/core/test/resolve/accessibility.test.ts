import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { slide, textElement } from '../harness/corpus.js'

/**
 * Authored accessibility metadata reaches the consumer.
 *
 * Added in Wave 2, which found it missing. A renderer receives only a `ResolvedElement`,
 * and feature 003's FR-015 requires it to expose an image's alternative text — so without
 * this pass-through the alt text sat in the manifest, unreachable by the one component
 * that needs it, and the only workaround would have been handing renderers the lesson.
 *
 * Static and authored, like `payload`. Nothing here varies with time, so it costs the
 * resolver nothing and takes no position on anything.
 */
describe('accessibility metadata passes through the resolver', () => {
  const at = (accessibility?: Record<string, unknown>) =>
    resolve(
      slide([
        textElement({
          startMs: 0,
          endMs: 3000,
          effects: [],
          ...(accessibility ? { accessibility } : {}),
        }),
      ]),
      100,
    ).elements[0]!

  it('carries what the author wrote, unchanged', () => {
    expect(at({ altText: 'Worker wearing safety equipment' }).accessibility).toEqual({
      altText: 'Worker wearing safety equipment',
    })
  })

  it('carries a label as well as alternative text', () => {
    expect(at({ label: 'Safety briefing video' }).accessibility).toEqual({
      label: 'Safety briefing video',
    })
  })

  it('is null when the author said nothing, never an empty object', () => {
    // The distinction is load-bearing for the renderer: "the author said nothing" and "the
    // author said none" are different, and an image renderer decides between `alt=""` and a
    // described fallback on exactly that.
    expect(at().accessibility).toBeNull()
  })

  it('does not vary with time', () => {
    const authored = { altText: 'Unchanging' }
    const first = resolve(
      slide([textElement({ startMs: 0, endMs: 3000, effects: [], accessibility: authored })]),
      0,
    ).elements[0]!
    const later = resolve(
      slide([textElement({ startMs: 0, endMs: 3000, effects: [], accessibility: authored })]),
      2999,
    ).elements[0]!
    expect(later.accessibility).toEqual(first.accessibility)
  })
})
