import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../../src/adapters/memory/index.js'
import { lessonOf } from '../harness/lesson.js'

/**
 * Every save advances the version; only a checkpoint enters the history.
 *
 * The separation feature 008 introduces, and the reason it exists: autosave fires roughly
 * every 1.5 seconds of idle, so an hour of editing is hundreds of writes. All of them must
 * advance the token or a conflict cannot be detected (FR-DAT-006); almost none of them may
 * appear in a list a teacher reads (FR-DAT-008).
 *
 * The case that costs an hour of work is the last one here. An adapter that treated a
 * non-checkpoint save as a no-op would satisfy every assertion about the *history* and
 * silently discard the draft.
 */
describe('checkpoints and saves are different things', () => {
  const now = () => 1_700_000_000_000

  it('an ordinary save records no history entry', async () => {
    const storage = createMemoryStorage({ now })
    const first = await storage.saveDraft('l1', lessonOf({ slides: 1 }), 'unset')
    expect(first.ok).toBe(true)
    if (!first.ok) return

    await storage.saveDraft('l1', lessonOf({ slides: 2 }), first.token)
    expect(await storage.listVersions('l1')).toHaveLength(0)
  })

  it('a checkpoint records exactly one entry', async () => {
    const storage = createMemoryStorage({ now })
    const first = await storage.saveDraft('l1', lessonOf(), 'unset', { checkpoint: {} })
    expect(first.ok).toBe(true)
    expect(await storage.listVersions('l1')).toHaveLength(1)
  })

  it('advances the token whether or not it is a checkpoint', async () => {
    const storage = createMemoryStorage({ now })
    const a = await storage.saveDraft('l1', lessonOf(), 'unset')
    if (!a.ok) throw new Error('setup')
    const b = await storage.saveDraft('l1', lessonOf({ slides: 2 }), a.token)
    if (!b.ok) throw new Error('setup')
    expect(b.token).not.toBe(a.token)

    // And the stale one is still refused, checkpoint or not.
    const stale = await storage.saveDraft('l1', lessonOf(), a.token, { checkpoint: {} })
    expect(stale.ok).toBe(false)
  })

  it('stores a label verbatim and returns it', async () => {
    const storage = createMemoryStorage({ now })
    await storage.saveDraft('l1', lessonOf(), 'unset', {
      checkpoint: { label: 'Before I rearranged everything' },
    })
    const entries = await storage.listVersions('l1')
    expect(entries[0]?.label).toBe('Before I rearranged everything')
  })

  it('omits the label when the teacher gave none', async () => {
    const storage = createMemoryStorage({ now })
    await storage.saveDraft('l1', lessonOf(), 'unset', { checkpoint: {} })
    const entries = await storage.listVersions('l1')
    expect(entries[0]?.label).toBeUndefined()
  })

  it('stamps each entry with the host clock, not the caller’s', async () => {
    let clock = 1_000
    const storage = createMemoryStorage({ now: () => clock })
    const a = await storage.saveDraft('l1', lessonOf(), 'unset', { checkpoint: {} })
    if (!a.ok) throw new Error('setup')
    clock = 5_000
    await storage.saveDraft('l1', lessonOf({ slides: 2 }), a.token, { checkpoint: {} })

    const entries = await storage.listVersions('l1')
    expect(entries.map((e) => e.recordedAt)).toEqual([1_000, 5_000])
  })

  it('numbers entries in order and never reorders them', async () => {
    const storage = createMemoryStorage({ now })
    let token = 'unset'
    for (let i = 0; i < 4; i++) {
      const r = await storage.saveDraft('l1', lessonOf({ slides: i + 1 }), token, { checkpoint: {} })
      if (!r.ok) throw new Error('setup')
      token = r.token
    }
    const entries = await storage.listVersions('l1')
    expect(entries.map((e) => e.versionNumber)).toEqual([1, 2, 3, 4])
  })

  /**
   * The one an implementation can fail while passing everything above.
   *
   * FR-035c states it as a rule at the boundary: a save without a checkpoint is *absent from
   * the history, not absent from storage*.
   */
  it('a save between checkpoints is still what loadDraft returns', async () => {
    const storage = createMemoryStorage({ now })
    const first = await storage.saveDraft('l1', lessonOf({ slides: 1 }), 'unset', { checkpoint: {} })
    if (!first.ok) throw new Error('setup')

    await storage.saveDraft('l1', lessonOf({ slides: 3 }), first.token)

    const loaded = await storage.loadDraft('l1')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.manifest.slides).toHaveLength(3)
    expect(await storage.listVersions('l1')).toHaveLength(1)
  })
})
