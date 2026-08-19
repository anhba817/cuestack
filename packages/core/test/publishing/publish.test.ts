import { describe, expect, it } from 'vitest'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import { lessonOf } from '../harness/lesson.js'

/**
 * Publishing produces a version, and the version says who and when.
 *
 * The time is the host's. ED-5 established the rule for checkpoints and it holds here for the
 * same reason: the host's storage is the only participant with an authoritative clock, and the
 * editor is forbidden from reading one at all. A framework-side stamp would disagree between two
 * browsers and could be moved by a system clock adjustment.
 */
describe('publishing a lesson', () => {
  const at = (ms: number) => createMemoryPublishing({ now: () => ms })

  it('returns a version carrying its publisher and its time', async () => {
    const publishing = at(1_700_000_000_000)
    const result = await publishing.publish('l1', lessonOf({ slides: 1 }), 'teacher-a')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.version.publishedBy).toBe('teacher-a')
    expect(result.version.publishedAt).toBe(1_700_000_000_000)
  })

  it('takes the time from the injected clock and never from the framework', async () => {
    let clock = 1_000
    const publishing = createMemoryPublishing({ now: () => clock })
    const first = await publishing.publish('l1', lessonOf(), 'teacher-a')
    clock = 5_000
    const second = await publishing.publish('l1', lessonOf({ slides: 2 }), 'teacher-a')

    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect([first.version.publishedAt, second.version.publishedAt]).toEqual([1_000, 5_000])
  })

  it('numbers versions in the order they were published', async () => {
    const publishing = at(0)
    const numbers: number[] = []
    for (let i = 1; i <= 3; i++) {
      const r = await publishing.publish('l1', lessonOf({ slides: i }), 'teacher-a')
      if (r.ok) numbers.push(r.version.versionNumber)
    }
    expect(numbers).toEqual([1, 2, 3])
  })

  it('gives each version a stable id, distinct from every other', async () => {
    const publishing = at(0)
    const a = await publishing.publish('l1', lessonOf(), 'teacher-a')
    const b = await publishing.publish('l1', lessonOf({ slides: 2 }), 'teacher-a')
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.version.id).not.toBe(b.version.id)
  })

  it('records the format it was published under, so it can be honoured rather than upgraded', async () => {
    const publishing = at(0)
    const lesson = lessonOf()
    const result = await publishing.publish('l1', lesson, 'teacher-a')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.version.schemaVersion).toBe(lesson.schemaVersion)
  })

  it('appends one record entry, naming who and when', async () => {
    const publishing = at(1_700_000_000_000)
    await publishing.publish('l1', lessonOf(), 'teacher-a')
    const record = await publishing.readRecord('l1')

    expect(record).toHaveLength(1)
    expect(record[0]).toMatchObject({ action: 'published', actor: 'teacher-a', at: 1_700_000_000_000 })
  })
})
