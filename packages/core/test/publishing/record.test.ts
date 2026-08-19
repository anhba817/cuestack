import { describe, expect, it } from 'vitest'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import { lessonOf } from '../harness/lesson.js'

/**
 * The record is append-only, and "append-only" is asserted by trying to break it.
 *
 * An interface that can rewrite history can be asked to, which is the same argument that keeps
 * `updatePublished` out of the adapter. Here the guarantee has to survive one more hop: the array
 * a caller receives must not be a live handle on the framework's own (FR-034).
 */
describe('the publication record', () => {
  const publishing = () => createMemoryPublishing({ now: () => 1_700_000_000_000 })

  it('appends one entry per action, oldest first', async () => {
    const p = publishing()
    await p.publish('l1', lessonOf(), 'teacher-a')
    await p.withdraw('l1', 'head-of-department')
    await p.restore('l1', 'teacher-a')

    const record = await p.readRecord('l1')
    expect(record.map((e) => e.action)).toEqual(['published', 'withdrawn', 'restored'])
    expect(record.map((e) => e.actor)).toEqual(['teacher-a', 'head-of-department', 'teacher-a'])
  })

  it('refuses to be added to', async () => {
    const p = publishing()
    await p.publish('l1', lessonOf(), 'teacher-a')
    const record = await p.readRecord('l1')
    expect(() => (record as unknown as RecordEntryArray).push({} as never)).toThrow()
  })

  it('refuses to have an entry replaced', async () => {
    const p = publishing()
    await p.publish('l1', lessonOf(), 'teacher-a')
    const record = await p.readRecord('l1')
    expect(() => {
      ;(record as unknown as RecordEntryArray)[0] = { action: 'withdrawn' } as never
    }).toThrow()
  })

  it('refuses to have an entry edited in place', async () => {
    const p = publishing()
    await p.publish('l1', lessonOf(), 'teacher-a')
    const record = await p.readRecord('l1')
    expect(() => {
      ;(record[0] as { actor: string }).actor = 'somebody-else'
    }).toThrow()
  })

  it('is empty rather than absent for a lesson nobody published', async () => {
    expect(await publishing().readRecord('never-published')).toEqual([])
  })

  it('does not grow when an action is refused', async () => {
    // A refusal is not a thing that happened to the lesson. Recording attempts would make the
    // record a log of intentions rather than of changes.
    const p = publishing()
    const refused = await p.withdraw('never-published', 'teacher-a')
    expect(refused.ok).toBe(false)
    expect(await p.readRecord('never-published')).toEqual([])
  })
})

/**
 * The double cast is the honest way to say what is being tested.
 *
 * `readonly RecordEntry[]` is the type precisely so a caller cannot do this, and what is under
 * test is what happens when somebody defeats the type and tries anyway — because the guarantee
 * is a runtime freeze, not a compile-time annotation.
 */
type RecordEntryArray = Array<Record<string, unknown>>
