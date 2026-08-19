import { describe, expect, it } from 'vitest'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import { createMemoryStorage } from '../../src/adapters/memory/index.js'
import { correct } from '../harness/faulty.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * BR-009: editing the draft after publishing changes nothing about the published version.
 *
 * The property the whole feature exists to make safe. A teacher who has published cannot be asked
 * to stop editing — so the two must be genuinely separate objects in separate stores, and this
 * asserts that by doing the editing rather than by reading the code.
 */
describe('BR-009', () => {
  it('leaves the published version byte-identical through many draft saves', async () => {
    const publishing = createMemoryPublishing({ now: () => 1_700_000_000_000 })
    const storage = createMemoryStorage({ now: () => 1_700_000_000_000 })

    const original = correct()
    await publishing.publish('lesson', original, 'teacher')
    const first = await publishing.loadPublished('lesson')
    if (!first.ok) throw new Error('unreachable')
    const asPublished = JSON.stringify(first.version.manifest)

    let draft: LessonManifest = JSON.parse(JSON.stringify(original)) as LessonManifest
    storage.seed('lesson', draft)
    const opened = await storage.loadDraft('lesson')
    if (!opened.ok) throw new Error('unreachable')
    let token = opened.token

    for (let i = 0; i < 20; i += 1) {
      draft = {
        ...draft,
        slides: [{ ...draft.slides[0]!, durationMs: 8000 + i * 100 }],
      } as LessonManifest
      const saved = await storage.saveDraft('lesson', draft, token)
      expect(saved.ok).toBe(true)
      if (saved.ok) token = saved.token
    }

    const again = await publishing.loadPublished('lesson')
    if (!again.ok) throw new Error('unreachable')
    expect(JSON.stringify(again.version.manifest)).toBe(asPublished)
    expect(again.version.manifest.slides[0]!.durationMs).toBe(original.slides[0]!.durationMs)
  })

  it('holds a snapshot rather than a reference to what was published', async () => {
    const publishing = createMemoryPublishing()
    const draft = correct()
    await publishing.publish('lesson', draft, 'teacher')

    // The caller keeps editing the object they handed in, which is what a host actually does.
    ;(draft.slides[0]!.elements as unknown as { id: string }[])[0]!.id = 'renamed'

    const loaded = await publishing.loadPublished('lesson')
    if (!loaded.ok) throw new Error('unreachable')
    expect(loaded.version.manifest.slides[0]!.elements[0]!.id).not.toBe('renamed')
  })
})
