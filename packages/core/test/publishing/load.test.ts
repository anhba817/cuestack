import { describe, expect, it } from 'vitest'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import { lessonOf } from '../harness/lesson.js'

/**
 * Active, withdrawn, and not found are three answers.
 *
 * The third is the one hosts get wrong, and the cost is concrete: a host that cannot tell
 * `withdrawn` from `not_found` shows a learner "this lesson does not exist" about a lesson that
 * plainly does, which produces a support ticket rather than an understanding (FR-029a).
 */
describe('reading a published lesson', () => {
  const publishing = () => createMemoryPublishing({ now: () => 0 })

  it('returns the active version when no id is given', async () => {
    const p = publishing()
    await p.publish('l1', lessonOf({ slides: 1 }), 'teacher-a')
    await p.publish('l1', lessonOf({ slides: 3 }), 'teacher-a')

    const loaded = await p.loadPublished('l1')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.version.manifest.slides).toHaveLength(3)
  })

  it('returns the named version when one is given', async () => {
    const p = publishing()
    const first = await p.publish('l1', lessonOf({ slides: 1 }), 'teacher-a')
    await p.publish('l1', lessonOf({ slides: 3 }), 'teacher-a')
    if (!first.ok) throw new Error('setup')

    const loaded = await p.loadPublished('l1', first.version.id)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.version.manifest.slides).toHaveLength(1)
  })

  it('answers not_found for a lesson nobody published', async () => {
    const loaded = await publishing().loadPublished('never-published')
    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.reason).toBe('not_found')
  })

  it('answers withdrawn — not not_found — once it has been withdrawn', async () => {
    const p = publishing()
    await p.publish('l1', lessonOf(), 'teacher-a')
    await p.withdraw('l1', 'teacher-a')

    const loaded = await p.loadPublished('l1')
    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.reason).toBe('withdrawn')
  })

  it('still serves a named version while the lesson is withdrawn', async () => {
    // Withdrawal changes availability, not existence. A host reconciling what a learner is
    // part-way through needs to be able to read the version they are playing.
    const p = publishing()
    const published = await p.publish('l1', lessonOf(), 'teacher-a')
    await p.withdraw('l1', 'teacher-a')
    if (!published.ok) throw new Error('setup')

    const loaded = await p.loadPublished('l1', published.version.id)
    expect(loaded.ok).toBe(true)
  })

  it('answers not_found for an id this lesson never had', async () => {
    const p = publishing()
    await p.publish('l1', lessonOf(), 'teacher-a')
    const loaded = await p.loadPublished('l1', 'v-nonexistent')
    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.reason).toBe('not_found')
  })

  it('lists versions newest first', async () => {
    const p = publishing()
    for (let i = 1; i <= 3; i++) await p.publish('l1', lessonOf({ slides: i }), 'teacher-a')
    const listed = await p.listPublished('l1')
    expect(listed.map((v) => v.versionNumber)).toEqual([3, 2, 1])
  })
})
