import { describe, expect, it } from 'vitest'
import {
  reconcile,
  commanded,
  emptyLink,
  MEDIA_SYNC_TOLERANCE_MS,
  MEDIA_REPORT_INTERVAL_MS,
  type MediaLink,
} from '../../src/media/reconcile.js'

/**
 * The authority rule, as one pure function of two positions and a tolerance.
 *
 * > The transport is the only clock. Either side may request a position change; every
 * > change is applied to the transport, and the transport then commands the media.
 *
 * Two clocks are now unavoidable — a media element owns its playback position and no design
 * removes that. What is avoidable is two *policies* for reconciling them, which is what
 * arises if each call site decides for itself whom to trust. FR-037 forbids that, and this
 * is the one place to read.
 */

const link = (over: Partial<MediaLink> = {}): MediaLink => ({ ...emptyLink('el'), ...over })

describe('a report after a commanded seek', () => {
  it('is an echo when it lands within tolerance, and moves nothing', () => {
    const after = reconcile(commanded(link(), 4000), 4000 + MEDIA_SYNC_TOLERANCE_MS / 2)
    expect(after.seekTransportTo).toBeNull()
    expect(after.link.following).toBe(true)
  })

  it('is an echo when it lands exactly on the commanded position', () => {
    const after = reconcile(commanded(link(), 4000), 4000)
    expect(after.seekTransportTo).toBeNull()
    expect(after.link.following).toBe(true)
  })

  it('is an echo one report interval late, because a playing element has moved on', () => {
    // The floor, pinned behaviourally rather than by comparing two literals. A playing
    // element reports at roughly 4 Hz, so by the time a seek is acknowledged it can be one
    // interval further along. Below this the rule would read every playback report as a
    // learner scrub and the loop would return.
    const after = reconcile(commanded(link(), 4000), 4000 + MEDIA_REPORT_INTERVAL_MS)
    expect(after.seekTransportTo).toBeNull()
  })

  it('is a learner scrub once it lands outside tolerance', () => {
    const after = reconcile(commanded(link(), 4000), 9000)
    expect(after.seekTransportTo).toBe(9000)
  })
})

describe('a report with no commanded position', () => {
  it('is the learner moving the media, and the transport follows', () => {
    // FR-036: the lesson follows rather than fighting them back to where it thought they
    // were. Nothing was commanded, so nothing can be an echo.
    const after = reconcile(link({ following: true }), 7000)
    expect(after.seekTransportTo).toBe(7000)
  })

  it('does not chase a media element that is merely drifting', () => {
    // A playing element creeps by about one report interval per report. Treating that as a
    // learner scrub would have the transport chasing playback it is already driving.
    const after = reconcile(link({ reportedMs: 6800 }), 7000)
    expect(after.seekTransportTo).toBeNull()
  })

  it('does not chase a media element still buffering toward a commanded seek', () => {
    // The case that rules out "always follow when outside tolerance". We asked for 9000; the
    // element is at 1200 and has not left yet. Following would undo the learner's own seek.
    const state = { ...commanded(link({ reportedMs: 1200 }), 9000) }
    const after = reconcile(state, 1300)
    expect(after.seekTransportTo).toBeNull()
  })
})

describe('a seek the media never honours (FR-035)', () => {
  it('leaves the link not following, so the lesson knows it is not there', () => {
    const state = commanded(link(), 4000)
    expect(state.following).toBe(false)
  })

  it('reports the media’s actual position rather than the commanded one', () => {
    // The lesson never claims a position the media is not at. `reportedMs` is what a
    // consumer displays while `following` is false.
    const after = reconcile(commanded(link(), 4000), 1200)
    expect(after.link.reportedMs).toBe(1200)
  })

  /**
   * **Negative control for the flag that was rejected.**
   *
   * The obvious echo suppressor is an `ignoreNextReport` flag. It was rejected because a
   * flag is state that can be left set: a seek the platform silently refuses never produces
   * the report that would clear it, and the learner's next genuine scrub is swallowed
   * forever. Comparing two numbers has no such failure mode, and this is the case that
   * distinguishes them.
   */
  it('does not swallow the learner’s next genuine scrub', () => {
    const state = commanded(link(), 4000)
    // The platform refuses; no report ever arrives at 4000. The learner then scrubs.
    const after = reconcile(state, 12_000)
    expect(after.seekTransportTo).toBe(12_000)
  })
})

describe('the loop the rule exists to prevent', () => {
  /**
   * **Negative control.** Without the tolerance check every echo reads as a scrub, the
   * transport seeks itself, commands the media again, and the exchange never terminates.
   * A rule never observed preventing its failure is not known to prevent it.
   */
  const withoutTolerance = (state: MediaLink, reportedMs: number): number | null =>
    state.commandedMs === null ? reportedMs : reportedMs === state.commandedMs ? null : reportedMs

  it('terminates with the tolerance', () => {
    let state = commanded(link(), 4000)
    let exchanges = 0
    // The media settles a little past the commanded point, as a playing element does.
    let position = 4000 + MEDIA_REPORT_INTERVAL_MS
    while (exchanges < 10) {
      const after = reconcile(state, position)
      if (after.seekTransportTo === null) break
      state = commanded(after.link, after.seekTransportTo)
      position = after.seekTransportTo + MEDIA_REPORT_INTERVAL_MS
      exchanges += 1
    }
    expect(exchanges).toBe(0)
  })

  it('does not terminate without it', () => {
    let state = commanded(link(), 4000)
    let exchanges = 0
    let position = 4000 + MEDIA_REPORT_INTERVAL_MS
    while (exchanges < 10) {
      const next = withoutTolerance(state, position)
      if (next === null) break
      state = commanded(state, next)
      position = next + MEDIA_REPORT_INTERVAL_MS
      exchanges += 1
    }
    expect(exchanges).toBe(10)
  })
})
