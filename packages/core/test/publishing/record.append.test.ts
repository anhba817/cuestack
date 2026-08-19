import { describe, expect, it } from 'vitest'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import { correct } from '../harness/faulty.js'

/**
 * The record: every action, in order, and nothing that removes or alters an entry.
 *
 * Append-only is not a storage optimisation. A record somebody can edit is a record nobody can
 * rely on, and the only reason to keep one at all is that it answers "who took this down, and
 * when" months later, when nobody involved remembers.
 */
describe('the publication record', () => {
  it('appends one entry per action, in order', async () => {
    let clock = 1_700_000_000_000
    const publishing = createMemoryPublishing({ now: () => (clock += 60_000) })

    await publishing.publish('lesson', correct(), 'ms-okafor')
    await publishing.withdraw('lesson', 'mr-adeyemi')
    await publishing.restore('lesson', 'ms-okafor')
    await publishing.publish('lesson', correct(), 'ms-okafor')

    const record = await publishing.readRecord('lesson')
    expect(record.map((e) => e.action)).toEqual(['published', 'withdrawn', 'restored', 'published'])
    expect(record.map((e) => e.actor)).toEqual([
      'ms-okafor',
      'mr-adeyemi',
      'ms-okafor',
      'ms-okafor',
    ])
    // Times only move forward, because they come from the host's clock.
    expect(record.map((e) => e.at)).toEqual([...record.map((e) => e.at)].sort((a, b) => a - b))
  })

  it('names the version each action concerned', async () => {
    const publishing = createMemoryPublishing()
    await publishing.publish('lesson', correct(), 'teacher')
    await publishing.withdraw('lesson', 'teacher')

    const record = await publishing.readRecord('lesson')
    const versions = await publishing.listPublished('lesson')
    expect(record[0]!.versionId).toBe(versions[0]!.id)
    expect(record[1]!.versionId).toBe(versions[0]!.id)
  })

  it('appends nothing for an action that changed nothing', async () => {
    /**
     * Withdrawing an already-withdrawn lesson succeeds and records nothing. An entry per *attempt*
     * would turn the record into a log of button presses, which is a different artefact and a
     * worse one — the question it answers is what happened to this lesson.
     */
    const publishing = createMemoryPublishing()
    await publishing.publish('lesson', correct(), 'teacher')
    await publishing.withdraw('lesson', 'teacher')
    await publishing.withdraw('lesson', 'teacher')

    expect((await publishing.readRecord('lesson')).map((e) => e.action)).toEqual([
      'published',
      'withdrawn',
    ])
  })

  it('hands out a record nothing can edit', async () => {
    const publishing = createMemoryPublishing()
    await publishing.publish('lesson', correct(), 'teacher')

    const record = await publishing.readRecord('lesson')
    expect(() => {
      ;(record as unknown as { push: (e: unknown) => void }).push({ action: 'published' })
    }).toThrow()
    expect(() => {
      ;(record[0] as { actor: string }).actor = 'somebody-else'
    }).toThrow()

    // And the store is unmoved by the attempt.
    expect((await publishing.readRecord('lesson')).map((e) => e.actor)).toEqual(['teacher'])
  })

  it('is empty rather than absent for a lesson never published', async () => {
    expect(await createMemoryPublishing().readRecord('never')).toEqual([])
  })
})
