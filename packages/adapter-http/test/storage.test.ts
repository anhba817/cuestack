import { describe, expect, it } from 'vitest'
import { assertConflict, assertRestoreToken, assertSaveHandshake, adaptersFor } from './behaviour.js'
import { flatShape } from './harness/shapes.js'
import { lesson } from './harness/lesson.js'

describe('storage over HTTP', () => {
  it('advances the token on every save, checkpoint or not', () => assertSaveHandshake(flatShape, lesson()))
  it('reports a conflict rather than overwriting', () => assertConflict(flatShape, lesson()))
  it('returns the current draft token when loading a version', () =>
    assertRestoreToken(flatShape, lesson()))

  it('sends what the mapping described and nothing more', async () => {
    const { storage, transport } = adaptersFor(flatShape, lesson())
    await storage.loadDraft('lesson')

    const sent = transport.sent[0]!
    expect(sent.url).toBe('/lessons/lesson/draft')
    expect(sent.method).toBe('GET')
    expect(sent.headers['authorization']).toBe('Bearer test')
  })

  it('does not report Saved when the server did not acknowledge', async () => {
    const { storage, transport } = adaptersFor(flatShape, lesson())
    const opened = await storage.loadDraft('lesson')
    if (!opened.ok) throw new Error('unreachable')

    transport.replyWith({ status: 200 }) // a body that cannot be read
    const result = await storage.saveDraft('lesson', lesson(), opened.token)
    expect(result.ok).toBe(false)
  })

  it('says the history is unreachable rather than saying it is empty', async () => {
    const { storage, transport } = adaptersFor(flatShape, lesson())
    transport.replyWith({ status: 503, json: {} })
    await expect(storage.listVersions('lesson')).rejects.toThrow()
  })
})
