import { describe, expect, it } from 'vitest'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import { correct } from '../harness/faulty.js'

/**
 * FR-029a and FR-031: withdrawal takes a lesson out of learners' hands without destroying it.
 *
 * The distinction that matters is the answer `loadPublished` gives afterwards. **Withdrawn** is not
 * **not found**: one says a decision was made and can be reversed, the other says there is nothing
 * here — and a host that could not tell them apart would show a teacher a broken link where it
 * should show them a lesson they took down.
 */
describe('withdrawal', () => {
  const withOne = async () => {
    let clock = 1_700_000_000_000
    const publishing = createMemoryPublishing({ now: () => (clock += 60_000) })
    await publishing.publish('lesson', correct(), 'teacher')
    return publishing
  }

  it('leaves no version active', async () => {
    const publishing = await withOne()
    expect((await publishing.withdraw('lesson', 'teacher')).ok).toBe(true)

    const loaded = await publishing.loadPublished('lesson')
    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.reason).toBe('withdrawn')
  })

  it('deletes nothing', async () => {
    const publishing = await withOne()
    const before = await publishing.listPublished('lesson')
    await publishing.withdraw('lesson', 'teacher')

    const after = await publishing.listPublished('lesson')
    expect(after).toHaveLength(before.length)
    expect(JSON.stringify(after)).toBe(JSON.stringify(before))

    // And the version itself is still loadable by id — it is unavailable, not gone.
    const byId = await publishing.loadPublished('lesson', after[0]!.id)
    expect(byId.ok).toBe(true)
  })

  it('says withdrawn rather than not found', async () => {
    const publishing = await withOne()
    await publishing.withdraw('lesson', 'teacher')

    const withdrawn = await publishing.loadPublished('lesson')
    const missing = await publishing.loadPublished('never-published')
    expect(withdrawn.ok || missing.ok).toBe(false)
    if (withdrawn.ok || missing.ok) return
    expect(withdrawn.reason).toBe('withdrawn')
    expect(missing.reason).toBe('not_found')
  })

  it('restores without creating a version', async () => {
    const publishing = await withOne()
    await publishing.withdraw('lesson', 'teacher')
    expect((await publishing.restore('lesson', 'teacher')).ok).toBe(true)

    // FR-031: withdrawing changed no version, so restoring has none to make.
    expect(await publishing.listPublished('lesson')).toHaveLength(1)
    const loaded = await publishing.loadPublished('lesson')
    expect(loaded.ok).toBe(true)
  })

  it('restores the newest version, after several publishes', async () => {
    const publishing = await withOne()
    await publishing.publish('lesson', correct(), 'teacher')
    await publishing.withdraw('lesson', 'teacher')
    await publishing.restore('lesson', 'teacher')

    const loaded = await publishing.loadPublished('lesson')
    if (!loaded.ok) throw new Error('unreachable')
    expect(loaded.version.versionNumber).toBe(2)
  })

  it('refuses to withdraw a lesson that was never published', async () => {
    const publishing = createMemoryPublishing()
    const result = await publishing.withdraw('never', 'teacher')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('not_found')
  })
})
