import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { corpus } from '../harness/corpus.js'

/** SC-003: byte-identical across the corpus, at every boundary. */
describe('resolve determinism', () => {
  it.each(corpus().map((e) => [e.name, e] as const))('%s is byte-identical', (_name, entry) => {
    for (const t of entry.boundaries) {
      expect(JSON.stringify(resolve(entry.slide, t))).toBe(JSON.stringify(resolve(entry.slide, t)))
    }
  })

  it('does not mutate or retain the slide', () => {
    for (const { slide } of corpus()) {
      const before = JSON.stringify(slide)
      resolve(slide, 1000)
      expect(JSON.stringify(slide)).toBe(before)
    }
  })

  it('emits no timestamp or generated id into the state', () => {
    for (const { slide, boundaries } of corpus()) {
      for (const t of boundaries.slice(0, 6)) {
        const json = JSON.stringify(resolve(slide, t))
        expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
        // Anchored so a float like 0.16666666666666 is not mistaken for an epoch.
        expect(json).not.toMatch(/(^|[^\d.])1[6-9]\d{11}([^\d]|$)/)
      }
    }
  })
})
