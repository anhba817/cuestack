import { describe, expect, it } from 'vitest'
import * as core from '../../src/index.js'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import { correct } from '../harness/faulty.js'
import type { PublishingAdapter } from '../../src/publishing/index.js'

/**
 * FR-032 and FR-032a: permission is the host's, discovered by attempting.
 *
 * The framework holds **no roles of its own**. It does not know what a teacher is, what a
 * department head is, or which of them may withdraw somebody else's lesson — those are the host's
 * questions and they differ per institution. So there is no permission model here to get wrong;
 * there is an attempt, and an adapter that may answer no.
 *
 * What the framework *does* owe is the distinction: `permission` is not `unavailable`. One means
 * you are not allowed and retrying will not help; the other means try again shortly.
 */
const refusing = (reason: 'permission' | 'unavailable'): PublishingAdapter => {
  const real = createMemoryPublishing()
  return {
    publish: async () => ({ ok: false, reason }),
    withdraw: async () => ({ ok: false, reason }),
    restore: async () => ({ ok: false, reason }),
    listPublished: (lessonId) => real.listPublished(lessonId),
    loadPublished: async () => ({ ok: false, reason }),
    readRecord: (lessonId) => real.readRecord(lessonId),
  }
}

describe('a refused action', () => {
  it('changes nothing when publishing is refused', async () => {
    const publishing = refusing('permission')
    const result = await publishing.publish('lesson', correct(), 'someone')

    expect(result.ok).toBe(false)
    expect(await publishing.listPublished('lesson')).toEqual([])
    expect(await publishing.readRecord('lesson')).toEqual([])
  })

  it('changes nothing when withdrawal or restoration is refused', async () => {
    const publishing = refusing('permission')
    expect((await publishing.withdraw('lesson', 'someone')).ok).toBe(false)
    expect((await publishing.restore('lesson', 'someone')).ok).toBe(false)
    expect(await publishing.readRecord('lesson')).toEqual([])
  })

  it('says permission is what is missing, not that something broke', async () => {
    const denied = await refusing('permission').publish('lesson', correct(), 'someone')
    const down = await refusing('unavailable').publish('lesson', correct(), 'someone')

    expect(denied.ok || down.ok).toBe(false)
    if (denied.ok || down.ok) return
    expect(denied.reason).toBe('permission')
    expect(down.reason).toBe('unavailable')
    expect(denied.reason).not.toBe(down.reason)
  })

  it('ships no roles, no permissions model, and nothing to configure', () => {
    /**
     * SC-009a, asserted against the exported surface. A `canPublish(user)` here would be the
     * framework guessing at somebody else's institution — and every host whose rules differed
     * would have to work around it rather than simply answer.
     */
    const names = Object.keys(core)
    expect(names.filter((n) => /role|permission|can[A-Z]|authoriz|acl/i.test(n))).toEqual([])
  })
})
