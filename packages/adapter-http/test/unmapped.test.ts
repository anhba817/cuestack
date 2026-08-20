import { describe, expect, it } from 'vitest'
import { adaptersFor } from './behaviour.js'
import { flatShape } from './harness/shapes.js'
import { lesson } from './harness/lesson.js'

/**
 * A response the mapping does not describe produces a failure the caller can act on — never a
 * success. An adapter that treated an unrecognised answer as "fine" would report a save as Saved
 * that was not, which is the one outcome FR-DAT-003 exists to prevent.
 */
describe('a response nobody described', () => {
  it('is a failure when the reader cannot make sense of it', async () => {
    const { storage, transport } = adaptersFor(flatShape, lesson())
    // A 200 whose body has none of the fields the mapping's reader expects.
    transport.replyWith({ status: 200, json: { surprise: true } })

    const result = await storage.loadDraft('lesson')
    expect(result.ok).toBe(false)
  })

  it('is a failure when the status is one the classifier has never seen', async () => {
    const { storage, transport } = adaptersFor(flatShape, lesson())
    transport.replyWith({ status: 599, json: {} })

    const result = await storage.loadDraft('lesson')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unavailable')
  })

  it('routes a request the stub server does not recognise to a failure, not a success', async () => {
    // The stub 404s anything its shape did not declare, which is how a mapping that sends somewhere
    // the shape never described is caught rather than quietly accepted.
    const { storage, transport } = adaptersFor(flatShape, lesson())
    transport.replyWith({ status: 404, json: { error: 'no such route' } })

    const result = await storage.loadDraft('lesson')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('not_found')
  })
})
