import { afterEach, describe, expect, it, vi } from 'vitest'
import { adaptersFor } from './behaviour.js'
import { flatShape } from './harness/shapes.js'
import { lesson } from './harness/lesson.js'
import type { LessonEvent } from '@cuestack/core'

const event = (): LessonEvent => ({ kind: 'lesson_started', lessonId: 'lesson', schemaVersion: '1.0' })
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('analytics over HTTP', () => {
  const unhandled: unknown[] = []
  const listener = (reason: unknown): void => {
    unhandled.push(reason)
  }
  process.on('unhandledRejection', listener)
  afterEach(() => {
    unhandled.length = 0
  })

  it('reports an event without waiting for it', async () => {
    const { analytics, server } = adaptersFor(flatShape, lesson())
    analytics.record(event())
    await settle()
    expect(server.events).toHaveLength(1)
  })

  it('swallows a failure rather than surfacing it', async () => {
    const { analytics, transport } = adaptersFor(flatShape, lesson())
    transport.failWith(new Error('the network is down'))
    expect(() => analytics.record(event())).not.toThrow()
    await settle()
  })

  it('produces no unhandled rejection when the transport rejects', async () => {
    /**
     * `AnalyticsAdapter.record(event): void` is synchronous, so an HTTP implementation must start a
     * promise and drop it — fire-and-forget is forced by the signature rather than chosen. An
     * unhandled rejection is a process warning or a crash depending on flags, in the one operation
     * whose whole purpose is never to interrupt a lesson. Asserted by listening for one.
     */
    const { analytics, transport } = adaptersFor(flatShape, lesson())
    transport.failWith(new Error('boom'))

    analytics.record(event())
    analytics.record(event())
    await settle()
    await settle()

    expect(unhandled).toEqual([])
  })

  it('never lets a reader that throws escape either', async () => {
    const { analytics, transport } = adaptersFor(flatShape, lesson())
    transport.replyWith({ status: 200 }) // unreadable body
    analytics.record(event())
    await settle()
    expect(unhandled).toEqual([])
    vi.restoreAllMocks()
  })
})
