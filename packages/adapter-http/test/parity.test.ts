import { describe, expect, it } from 'vitest'
import { createMemoryPublishing, createMemoryStorage } from '@cuestack/core'
import { adaptersFor } from './behaviour.js'
import { flatShape } from './harness/shapes.js'
import { lesson } from './harness/lesson.js'

/**
 * SC-006: the editor behaves identically against the HTTP adapter and against the in-memory
 * reference.
 *
 * A difference here means a host swapping adapters gets different behaviour, which is exactly what
 * the interfaces exist to prevent. So the same scenarios run twice and the *outcomes* are compared,
 * not the implementations.
 */
const scenarios = {
  async saveAndReload(storage: ReturnType<typeof createMemoryStorage>) {
    const opened = await storage.loadDraft('lesson')
    if (!opened.ok) return ['load-failed']
    const saved = await storage.saveDraft('lesson', lesson(), opened.token)
    if (!saved.ok) return ['save-failed', saved.reason]
    const again = await storage.loadDraft('lesson')
    return ['ok', String(again.ok), String(saved.token !== opened.token)]
  },
  async conflict(storage: ReturnType<typeof createMemoryStorage>) {
    const opened = await storage.loadDraft('lesson')
    if (!opened.ok) return ['load-failed']
    await storage.saveDraft('lesson', lesson(), opened.token)
    const stale = await storage.saveDraft('lesson', lesson(), opened.token)
    return stale.ok ? ['unexpectedly-ok'] : ['refused', stale.reason]
  },
  async history(storage: ReturnType<typeof createMemoryStorage>) {
    const opened = await storage.loadDraft('lesson')
    if (!opened.ok) return ['load-failed']
    const marked = await storage.saveDraft('lesson', lesson(), opened.token, { checkpoint: {} })
    if (!marked.ok) return ['save-failed']
    await storage.saveDraft('lesson', lesson(), marked.token)
    const versions = await storage.listVersions('lesson')
    return ['ok', String(versions.length)]
  },
}

describe('the HTTP adapter and the in-memory reference', () => {
  for (const [name, scenario] of Object.entries(scenarios)) {
    it(`agree on ${name}`, async () => {
      const memory = createMemoryStorage({ now: () => 1_700_000_000_000 })
      memory.seed('lesson', lesson())
      const overHttp = adaptersFor(flatShape, lesson()).storage

      expect(await scenario(overHttp as never)).toEqual(await scenario(memory))
    })
  }

  it('agree on publishing', async () => {
    const run = async (publishing: ReturnType<typeof createMemoryPublishing>) => {
      const first = await publishing.publish('lesson', lesson(), 'teacher')
      const listed = await publishing.listPublished('lesson')
      const withdrawn = await publishing.withdraw('lesson', 'teacher')
      const afterward = await publishing.loadPublished('lesson')
      return [
        String(first.ok),
        String(listed.length),
        String(withdrawn.ok),
        afterward.ok ? 'active' : afterward.reason,
      ]
    }

    const memory = createMemoryPublishing({ now: () => 1_700_000_000_000 })
    const overHttp = adaptersFor(flatShape, lesson()).publishing
    expect(await run(overHttp as never)).toEqual(await run(memory))
  })
})
