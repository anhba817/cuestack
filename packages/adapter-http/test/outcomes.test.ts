import { describe, expect, it } from 'vitest'
import { classify, type ResponseView } from '../src/classify.js'

const view = (status: number, body: unknown = {}): ResponseView => ({ status, body })

/**
 * FR-022 and SC-007: every response lands in exactly one of four meanings, and none falls through.
 *
 * A caller that cannot tell these apart cannot say anything useful to a teacher — feature 009's
 * publish flow branches on precisely this distinction, and "something went wrong" sends somebody
 * looking through their slides for a network fault.
 */
describe('the default classifier', () => {
  it('calls 2xx a success', () => {
    for (const status of [200, 201, 202, 204]) expect(classify(view(status))).toBeNull()
  })

  const table: [number, string][] = [
    [400, 'unavailable'],
    [401, 'permission'],
    [403, 'permission'],
    [404, 'not-found'],
    [409, 'conflict'],
    [410, 'not-found'],
    [412, 'conflict'],
    [418, 'unavailable'],
    [429, 'unavailable'],
    [500, 'unavailable'],
    [502, 'unavailable'],
    [503, 'unavailable'],
  ]

  for (const [status, outcome] of table) {
    it(`calls ${status} ${outcome}`, () => {
      expect(classify(view(status))).toBe(outcome)
    })
  }

  it('sweeps the whole status space with nothing falling through', () => {
    const allowed = new Set([null, 'permission', 'not-found', 'conflict', 'unavailable'])
    for (let status = 100; status < 600; status += 1) {
      expect(allowed.has(classify(view(status)) as string | null)).toBe(true)
    }
  })

  it('names no path and no resource, which is why it is not a route mapping', () => {
    /**
     * FR-019b forbids shipping a default *mapping* presented as correct. This is not one: it
     * encodes the published HTTP status vocabulary and nothing about where anything lives. A host
     * whose API signals differently replaces it (research R-07).
     */
    expect(classify.length).toBe(1)
    expect(classify(view(409, { anything: 'at all' }))).toBe('conflict')
  })
})
