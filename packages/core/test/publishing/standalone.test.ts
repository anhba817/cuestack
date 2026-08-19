import { describe, expect, it } from 'vitest'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import { resolve } from '../../src/resolve/index.js'
import { correct } from '../harness/faulty.js'
import type { Slide } from '@cuestack/schema'

/**
 * FR-021 and FR-023: a published version stands on its own.
 *
 * Standing on its own means two things a host will discover separately. It plays with no draft and
 * no draft storage anywhere in reach — the publishing adapter is a different adapter, and nothing
 * in the playback path asks the other one anything. And it keeps the schema version it was
 * published under rather than being brought forward: migrating it would change what a learner
 * receives, which is the one thing BR-008 forbids.
 */
describe('a published version, alone', () => {
  it('plays with no draft storage present at all', async () => {
    const publishing = createMemoryPublishing({ now: () => 1_700_000_000_000 })
    await publishing.publish('lesson', correct(), 'teacher')

    const loaded = await publishing.loadPublished('lesson')
    if (!loaded.ok) throw new Error('unreachable')

    // No `StorageAdapter` constructed anywhere in this test, and none needed.
    const state = resolve(loaded.version.manifest.slides[0] as Slide, 0)
    expect(state.elements.length).toBeGreaterThan(0)
    expect(state.problems).toEqual([])
  })

  it('resolves from the frozen manifest without needing to write to it', async () => {
    /**
     * The freeze and the renderer meet here. `resolve` builds a new `RenderState` and never
     * writes to the manifest it reads — if it did, this would throw rather than fail an assertion,
     * which is why the freeze is applied on read (research R-05).
     */
    const publishing = createMemoryPublishing()
    await publishing.publish('lesson', correct(), 'teacher')
    const loaded = await publishing.loadPublished('lesson')
    if (!loaded.ok) throw new Error('unreachable')

    expect(() => resolve(loaded.version.manifest.slides[0] as Slide, 4000)).not.toThrow()
  })

  it('keeps the schema version it was published under', async () => {
    const publishing = createMemoryPublishing()
    const manifest = correct()
    await publishing.publish('lesson', manifest, 'teacher')

    const loaded = await publishing.loadPublished('lesson')
    if (!loaded.ok) throw new Error('unreachable')
    expect(loaded.version.schemaVersion).toBe(manifest.schemaVersion)
    expect(loaded.version.manifest.schemaVersion).toBe(manifest.schemaVersion)
  })

  it('records the publisher and the host clock, and nothing about a learner', async () => {
    const publishing = createMemoryPublishing({ now: () => 1_700_000_000_000 })
    await publishing.publish('lesson', correct(), 'ms-okafor')

    const loaded = await publishing.loadPublished('lesson')
    if (!loaded.ok) throw new Error('unreachable')
    expect(loaded.version.publishedBy).toBe('ms-okafor')
    expect(loaded.version.publishedAt).toBe(1_700_000_000_000)
    // Nothing that could go stale relative to the manifest, and no learner identity anywhere.
    expect(Object.keys(loaded.version).sort()).toEqual([
      'id',
      'manifest',
      'publishedAt',
      'publishedBy',
      'schemaVersion',
      'versionNumber',
    ])
  })
})
