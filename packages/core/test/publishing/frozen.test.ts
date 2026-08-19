import { describe, expect, it } from 'vitest'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import { lessonOf } from '../harness/lesson.js'

/**
 * A published version cannot be changed, and the freeze is the half that catches an accident.
 *
 * The absent method is the guarantee: there is nothing on `PublishingAdapter` that modifies a
 * version. The freeze is what catches the honest mistake — a host handing the same object to a
 * renderer that mutates it in place would violate BR-008 without writing anything that looks like
 * a violation, and this framework ships a renderer that takes manifests.
 *
 * Deep, not shallow. `Object.freeze` on the manifest alone would leave every slide and every
 * element writable, which is where a mutation would actually land.
 */
describe('a published version is frozen', () => {
  async function published() {
    const p = createMemoryPublishing({ now: () => 0 })
    await p.publish('l1', lessonOf({ slides: 2 }), 'teacher-a')
    const loaded = await p.loadPublished('l1')
    if (!loaded.ok) throw new Error('setup')
    return loaded.version.manifest
  }

  it('refuses a change at the top level', async () => {
    const manifest = await published()
    expect(() => {
      ;(manifest as { schemaVersion: string }).schemaVersion = '99.0'
    }).toThrow()
  })

  it('refuses a change to the slide list', async () => {
    const manifest = await published()
    expect(() => (manifest.slides as unknown as unknown[]).push({} as never)).toThrow()
  })

  it('refuses a change inside a slide', async () => {
    const manifest = await published()
    expect(() => {
      ;(manifest.slides[0] as { durationMs: number }).durationMs = 1
    }).toThrow()
  })

  it('refuses a change inside an element, which is where a mutation would really land', async () => {
    const manifest = await published()
    const element = manifest.slides[0]!.elements[0]
    if (!element) return
    expect(() => {
      ;(element as { x: number }).x = 999
    }).toThrow()
  })

  it('freezes every version, not only the active one', async () => {
    const p = createMemoryPublishing({ now: () => 0 })
    const first = await p.publish('l1', lessonOf(), 'teacher-a')
    await p.publish('l1', lessonOf({ slides: 2 }), 'teacher-a')
    if (!first.ok) throw new Error('setup')

    const loaded = await p.loadPublished('l1', first.version.id)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(() => {
      ;(loaded.version.manifest as { schemaVersion: string }).schemaVersion = '99.0'
    }).toThrow()
  })

  it('does not freeze what the caller handed in', async () => {
    // Publishing takes a snapshot; it does not seize the draft. An editor that could no longer
    // edit the lesson it had just published would be a strange kind of success.
    const p = createMemoryPublishing({ now: () => 0 })
    const draft = lessonOf()
    await p.publish('l1', draft, 'teacher-a')
    expect(() => {
      ;(draft as { schemaVersion: string }).schemaVersion = '1.0'
    }).not.toThrow()
  })
})
