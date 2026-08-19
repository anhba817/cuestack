import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../../src/adapters/memory/index.js'
import { lessonOf } from '../harness/lesson.js'

describe('storage round-trip', () => {
  it('a saved lesson loads back equivalent', async () => {
    const storage = createMemoryStorage()
    const lesson = lessonOf({ slides: 2 })
    const saved = await storage.saveDraft('l1', lesson, 'ignored-on-first-save')
    expect(saved.ok).toBe(true)

    const loaded = await storage.loadDraft('l1')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.manifest).toEqual(lesson)
  })

  it('reports not_found rather than throwing for an absent lesson', async () => {
    const result = await createMemoryStorage().loadDraft('nope')
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('issues a new token on every successful save', async () => {
    const storage = createMemoryStorage()
    const first = await storage.saveDraft('l1', lessonOf(), 'x')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = await storage.saveDraft('l1', lessonOf(), first.token)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.token).not.toBe(first.token)
  })

  /**
   * Rewritten in feature 008, and the change is the point.
   *
   * This asserted one history entry per save, which was the EN-6 behaviour. Autosave at
   * 1.5-second intervals turns that into hundreds of indistinguishable rows, so the history
   * now records **checkpoints** while every save still advances the token (FR-DAT-006 and
   * FR-DAT-008 pulling in opposite directions, separated).
   */
  it('lists a version per checkpoint, not per save', async () => {
    const storage = createMemoryStorage()
    let token = 'x'
    for (let i = 0; i < 3; i++) {
      const r = await storage.saveDraft('l1', lessonOf(), token, i === 0 ? { checkpoint: {} } : undefined)
      if (r.ok) token = r.token
    }
    expect(await storage.listVersions('l1')).toHaveLength(1)
    // All three saves happened, though: the last one is what loads.
    const loaded = await storage.loadDraft('l1')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.token).toBe(token)
  })

  it('returns an empty version list for an unknown lesson', async () => {
    expect(await createMemoryStorage().listVersions('nope')).toEqual([])
  })
})
