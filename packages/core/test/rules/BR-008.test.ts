import { describe, expect, it } from 'vitest'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import type { PublishingAdapter } from '../../src/publishing/index.js'
import { correct } from '../harness/faulty.js'

/**
 * BR-008: a published version is never modified.
 *
 * Two assertions, and they answer different questions. The freeze catches the accident — a
 * renderer or a host handler that writes to a manifest it was handed. The interface inspection
 * catches the design: there is no method to modify one, so a host implementing this adapter has
 * nowhere to put such a route even if it wanted one (research R-05).
 */
describe('BR-008', () => {
  const published = async () => {
    const publishing = createMemoryPublishing({ now: () => 1_700_000_000_000 })
    const result = await publishing.publish('lesson', correct(), 'teacher')
    expect(result.ok).toBe(true)
    const loaded = await publishing.loadPublished('lesson')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) throw new Error('unreachable')
    return { publishing, manifest: loaded.version.manifest }
  }

  it('refuses a write at the top level', async () => {
    const { manifest } = await published()
    expect(() => {
      ;(manifest as { schemaVersion: string }).schemaVersion = '9.9'
    }).toThrow()
  })

  it('refuses a write inside slides', async () => {
    const { manifest } = await published()
    expect(() => {
      ;(manifest.slides as unknown as { push: (s: unknown) => void }).push({})
    }).toThrow()
    expect(() => {
      ;(manifest.slides[0] as { durationMs: number }).durationMs = 1
    }).toThrow()
  })

  it("refuses a write inside a slide's elements", async () => {
    const { manifest } = await published()
    const element = manifest.slides[0]!.elements[0]!
    expect(() => {
      ;(element as { id: string }).id = 'renamed'
    }).toThrow()
    expect(() => {
      ;(element.payload as Record<string, unknown>)['text'] = 'rewritten'
    }).toThrow()
  })

  it('declares no method that modifies a version', () => {
    /**
     * By inspection of the *interface*, not of this implementation. A second adapter must reach
     * the same conclusion from the same declaration — the point of putting the rule in the shape
     * rather than in a guard is that no host can add the route.
     */
    const surface: Record<keyof PublishingAdapter, true> = {
      publish: true,
      listPublished: true,
      loadPublished: true,
      withdraw: true,
      restore: true,
      readRecord: true,
    }
    expect(Object.keys(surface).sort()).toEqual([
      'listPublished',
      'loadPublished',
      'publish',
      'readRecord',
      'restore',
      'withdraw',
    ])
    // No update, no delete, no setActive, no record edit.
    for (const forbidden of ['update', 'delete', 'setActive', 'editRecord', 'replace']) {
      expect(forbidden in surface).toBe(false)
    }
  })

  it('freezes what it hands out without freezing what it was given', async () => {
    const draft = correct()
    const publishing = createMemoryPublishing()
    await publishing.publish('lesson', draft, 'teacher')

    // The draft is resolved sixty times a second; freezing it would be the wrong trade (R-05).
    expect(Object.isFrozen(draft)).toBe(false)
    ;(draft.slides[0] as { durationMs: number }).durationMs = 9999
    expect(draft.slides[0]!.durationMs).toBe(9999)

    const loaded = await publishing.loadPublished('lesson')
    if (!loaded.ok) throw new Error('unreachable')
    expect(loaded.version.manifest.slides[0]!.durationMs).not.toBe(9999)
  })
})
