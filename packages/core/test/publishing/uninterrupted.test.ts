import { describe, expect, it } from 'vitest'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import { resolve } from '../../src/resolve/index.js'
import { correct } from '../harness/faulty.js'
import type { Slide } from '@cuestack/schema'

/**
 * FR-029b: withdrawing does not interrupt a learner who is already playing.
 *
 * The framework cannot know whether this withdrawal is a correction — "that version had the wrong
 * answer marked correct, stop it now" — or an end-of-term tidy-up. Both are ordinary, and they want
 * opposite behaviour, so the framework does neither and makes the state discoverable instead. The
 * host decides, because only the host knows which one this is.
 *
 * Structurally this is nearly free, and that is the point: a session already holds the manifest it
 * loaded. There is no channel through which a withdrawal could reach into it, and adding one to
 * support interruption would be adding the very coupling that makes a published version mutable in
 * practice.
 */
describe('withdrawing while a version is playing', () => {
  it('does not interrupt what is already in hand', async () => {
    const publishing = createMemoryPublishing()
    await publishing.publish('lesson', correct(), 'teacher')

    const loaded = await publishing.loadPublished('lesson')
    if (!loaded.ok) throw new Error('unreachable')
    const playing = loaded.version.manifest

    await publishing.withdraw('lesson', 'teacher')

    // The learner's session keeps resolving from the manifest it holds. Nothing reached into it.
    const state = resolve(playing.slides[0] as Slide, 4000)
    expect(state.elements.length).toBeGreaterThan(0)
    expect(playing.slides[0]!.id).toBe(loaded.version.manifest.slides[0]!.id)
  })

  it('makes the new state discoverable, so a host can decide', async () => {
    const publishing = createMemoryPublishing()
    await publishing.publish('lesson', correct(), 'teacher')
    await publishing.withdraw('lesson', 'teacher')

    /**
     * A host that wants to stop learners mid-lesson polls or subscribes on its own side and finds
     * this. A host that does not, does not ask — and neither behaviour is imposed by the framework.
     */
    const now = await publishing.loadPublished('lesson')
    expect(now.ok).toBe(false)
    if (now.ok) return
    expect(now.reason).toBe('withdrawn')
  })

  it('lets a new learner be turned away while the current one continues', async () => {
    const publishing = createMemoryPublishing()
    await publishing.publish('lesson', correct(), 'teacher')
    const inProgress = await publishing.loadPublished('lesson')
    if (!inProgress.ok) throw new Error('unreachable')

    await publishing.withdraw('lesson', 'teacher')

    const arriving = await publishing.loadPublished('lesson')
    expect(arriving.ok).toBe(false)
    // And the one already playing is unaffected, because they hold a value rather than a handle.
    expect(inProgress.version.manifest.slides).toHaveLength(1)
  })
})
