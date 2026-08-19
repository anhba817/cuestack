import { describe, expect, it } from 'vitest'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import { correct } from '../harness/faulty.js'
import type { LessonManifest } from '@cuestack/schema'

const at = (durationMs: number): LessonManifest => {
  const lesson = correct()
  return { ...lesson, slides: [{ ...lesson.slides[0]!, durationMs }] } as LessonManifest
}

/**
 * Publishing again, which is what makes publishing a habit rather than a demonstration.
 *
 * The last assertion is the one that earns its place: comparing the earlier versions byte for byte
 * after the third publish is what catches an adapter that stores one version and overwrites it —
 * a defect every other assertion here passes over, because a count of one is still a count.
 */
describe('publishing three times', () => {
  const thrice = async () => {
    let clock = 1_700_000_000_000
    const publishing = createMemoryPublishing({ now: () => (clock += 60_000) })
    await publishing.publish('lesson', at(8000), 'teacher')
    await publishing.publish('lesson', at(9000), 'teacher')
    await publishing.publish('lesson', at(10_000), 'teacher')
    return publishing
  }

  it('produces three versions with sequential numbers', async () => {
    const versions = await (await thrice()).listPublished('lesson')
    expect(versions).toHaveLength(3)
    expect(versions.map((v) => v.versionNumber)).toEqual([3, 2, 1])
  })

  it('makes exactly one active, and it is the newest', async () => {
    const publishing = await thrice()
    const active = await publishing.loadPublished('lesson')
    if (!active.ok) throw new Error('unreachable')

    const versions = await publishing.listPublished('lesson')
    expect(active.version.id).toBe(versions[0]!.id)
    expect(active.version.versionNumber).toBe(3)
    expect(active.version.manifest.slides[0]!.durationMs).toBe(10_000)
  })

  it('leaves the earlier two exactly as they were', async () => {
    const publishing = await thrice()
    const versions = await publishing.listPublished('lesson')

    const second = await publishing.loadPublished('lesson', versions[1]!.id)
    const first = await publishing.loadPublished('lesson', versions[2]!.id)
    if (!second.ok || !first.ok) throw new Error('unreachable')

    expect(first.version.manifest.slides[0]!.durationMs).toBe(8000)
    expect(second.version.manifest.slides[0]!.durationMs).toBe(9000)
    expect(first.version.versionNumber).toBe(1)
    expect(second.version.versionNumber).toBe(2)
  })

  it('gives each version its own identity, and never reuses one', async () => {
    const versions = await (await thrice()).listPublished('lesson')
    expect(new Set(versions.map((v) => v.id)).size).toBe(3)
  })
})
