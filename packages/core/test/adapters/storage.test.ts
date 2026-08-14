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

  it('lists a version per save', async () => {
    const storage = createMemoryStorage()
    let token = 'x'
    for (let i = 0; i < 3; i++) {
      const r = await storage.saveDraft('l1', lessonOf(), token)
      if (r.ok) token = r.token
    }
    expect(await storage.listVersions('l1')).toHaveLength(3)
  })

  it('returns an empty version list for an unknown lesson', async () => {
    expect(await createMemoryStorage().listVersions('nope')).toEqual([])
  })
})
