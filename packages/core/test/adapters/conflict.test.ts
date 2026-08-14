import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../../src/adapters/memory/index.js'
import { lessonOf } from '../harness/lesson.js'

/**
 * SC-008 / FR-031: a stale save is refused, and the stored manifest is untouched.
 *
 * The conflict path is in the signature rather than in a convention, so a host
 * cannot accidentally implement last-writer-wins — there is nowhere to put the
 * token that isn't the check.
 */
describe('save conflicts', () => {
  async function twoSessions() {
    const storage = createMemoryStorage()
    const original = lessonOf({ slides: 1 })
    const created = await storage.saveDraft('l1', original, 'first')
    if (!created.ok) throw new Error('setup failed')

    // Both sessions load the same version.
    const sessionA = await storage.loadDraft('l1')
    const sessionB = await storage.loadDraft('l1')
    if (!sessionA.ok || !sessionB.ok) throw new Error('setup failed')
    return { storage, sessionA, sessionB }
  }

  it('the second save against a stale token is refused', async () => {
    const { storage, sessionA, sessionB } = await twoSessions()
    const first = await storage.saveDraft('l1', lessonOf({ slides: 2 }), sessionA.token)
    expect(first.ok).toBe(true)

    const second = await storage.saveDraft('l1', lessonOf({ slides: 3 }), sessionB.token)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.reason).toBe('conflict')
  })

  it('the refusal carries the current token so the caller can re-base', async () => {
    const { storage, sessionA, sessionB } = await twoSessions()
    const first = await storage.saveDraft('l1', lessonOf({ slides: 2 }), sessionA.token)
    const second = await storage.saveDraft('l1', lessonOf({ slides: 3 }), sessionB.token)
    expect(second.ok).toBe(false)
    if (second.ok || first.ok === false) return
    expect((second as { currentToken: string }).currentToken).toBe(first.token)
  })

  it('the newer version is never modified by the refused save', async () => {
    const { storage, sessionA, sessionB } = await twoSessions()
    const winner = lessonOf({ slides: 2 })
    await storage.saveDraft('l1', winner, sessionA.token)
    await storage.saveDraft('l1', lessonOf({ slides: 3 }), sessionB.token)

    const loaded = await storage.loadDraft('l1')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.manifest.slides).toHaveLength(2)
  })

  it('re-basing on the current token succeeds', async () => {
    const { storage, sessionA, sessionB } = await twoSessions()
    await storage.saveDraft('l1', lessonOf({ slides: 2 }), sessionA.token)
    const refused = await storage.saveDraft('l1', lessonOf({ slides: 3 }), sessionB.token)
    expect(refused.ok).toBe(false)
    if (refused.ok || refused.reason !== 'conflict') return

    const retried = await storage.saveDraft('l1', lessonOf({ slides: 3 }), refused.currentToken)
    expect(retried.ok).toBe(true)
  })

  it('refuses 100% of stale attempts, not merely usually', async () => {
    for (let i = 0; i < 20; i++) {
      const { storage, sessionA, sessionB } = await twoSessions()
      await storage.saveDraft('l1', lessonOf(), sessionA.token)
      const stale = await storage.saveDraft('l1', lessonOf(), sessionB.token)
      expect(stale.ok).toBe(false)
    }
  })
})
