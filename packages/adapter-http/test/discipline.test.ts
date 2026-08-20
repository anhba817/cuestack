import { describe, expect, it, vi } from 'vitest'
import { perform } from '../src/request.js'
import { stubTransport } from './harness/request.js'

const spec = { method: 'GET', url: '/x' }

describe('what the adapter does exactly once', () => {
  it('attempts a failing request once and stops', async () => {
    /**
     * FR-025. Feature 008's save loop owns retry and backoff, and its research recorded the failure
     * mode plainly: two retry policies over one request is how a save is sent four times.
     */
    const transport = stubTransport()
    transport.failWith(new Error('the network is down'))

    const result = await perform(spec, { request: transport.request, credentials: async () => ({}) })
    expect(result.ok).toBe(false)
    expect(transport.sent).toHaveLength(1)
  })

  it('attempts a 503 once as well — a retryable status is still not the adapter to retry', async () => {
    const transport = stubTransport({ status: 503, json: {} })
    await perform(spec, { request: transport.request, credentials: async () => ({}) })
    expect(transport.sent).toHaveLength(1)
  })
})

describe('credentials', () => {
  it('are asked for on every request and never retained', async () => {
    const transport = stubTransport()
    const credentials = vi.fn(async () => ({ authorization: 'Bearer secret-token' }))
    const options = { request: transport.request, credentials }

    await perform(spec, options)
    await perform(spec, options)

    // FR-020: asked twice for two requests. An adapter that cached would ask once.
    expect(credentials).toHaveBeenCalledTimes(2)
    // And nothing retained: the options object a host holds carries no trace of the answer.
    expect(JSON.stringify(options)).not.toContain('secret-token')
  })

  it('reach the request the host described', async () => {
    const transport = stubTransport()
    await perform(spec, {
      request: transport.request,
      credentials: async () => ({ authorization: 'Bearer t' }),
    })
    expect(transport.sent[0]!.headers['authorization']).toBe('Bearer t')
  })
})

describe('cancellation', () => {
  it('settles rather than leaving the editor reporting Saving forever', async () => {
    // FR-026. A request that never returns is the one failure a save-status word cannot describe.
    const controller = new AbortController()
    controller.abort()
    const transport = stubTransport()

    const result = await perform(spec, {
      request: transport.request,
      credentials: async () => ({}),
      signal: controller.signal,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.outcome).toBe('unavailable')
  })
})

describe('a success that is not one', () => {
  it('treats an unreadable body as a failure', async () => {
    /**
     * FR-024. A save reported as Saved that was not is the single outcome FR-DAT-003 exists to
     * prevent, and a 200 whose body cannot be parsed is exactly that shape.
     */
    const transport = stubTransport({ status: 200 })
    const result = await perform(spec, {
      request: transport.request,
      credentials: async () => ({}),
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.outcome).toBe('unavailable')
  })
})
