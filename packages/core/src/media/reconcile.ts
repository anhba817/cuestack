/**
 * Which clock wins, in one pure function.
 *
 * > **The transport is the only clock. Either side may request a position change; every
 * > change is applied to the transport, and the transport then commands the media.**
 *
 * One direction of authority, both sides able to ask. FR-037 requires that this rule exist
 * once and be applied everywhere, and `one-rule.test.ts` enforces it — every other one-place
 * rule in this repository is machine-checked, and feature 001 found a boundary rule that was
 * green while enforcing nothing.
 *
 * Pure, taking two numbers and a tolerance, so it is testable without a media element, a
 * clock, or a DOM. That is not incidental: real media is approximate, and the *rule* has to
 * be verified exactly even though the thing it governs cannot be.
 */

/**
 * How far a report may sit from the commanded position and still be that command's echo.
 *
 * Bounded on both sides, and both bounds already existed in the codebase:
 *
 * - **Floor, 250 ms** — a playing element reports at roughly 4 Hz, so a report can be one
 *   interval further along than when the seek landed. Below this every playback report reads
 *   as a learner scrub and the loop returns.
 * - **Ceiling, 1000 ms** — the smallest deliberate move a learner can make, since Wave 2
 *   fixed the seek slider's step at one second so an arrow key moves it visibly. Above this
 *   a genuine single-step scrub is swallowed as an echo.
 *
 * 500 is the midpoint. The ceiling is asserted in `@cuestack/react` against the exported
 * `SEEK_STEP_MS`; the floor is pinned behaviourally in `reconcile.test.ts`, because
 * comparing two literals in this file would look like a check and be a tautology.
 */
export const MEDIA_SYNC_TOLERANCE_MS = 500

/**
 * The cadence a playing media element can be relied on to report at.
 *
 * The same figure Wave 1 chose for the clock's delta clamp, for the same physical reason:
 * it is how often a browser can be trusted to tick. If a later wave measures something
 * better, both should move together rather than diverging silently.
 */
export const MEDIA_REPORT_INTERVAL_MS = 250

export interface MediaLink {
  readonly elementId: string
  /** Where the media last said it was. */
  readonly reportedMs: number
  /** Where the lesson last told it to be; null if never commanded. */
  readonly commandedMs: number | null
  /**
   * False while a commanded seek has not yet landed within tolerance.
   *
   * The honesty flag. While it is false the lesson displays `reportedMs` rather than
   * `commandedMs` — FR-035: never claim a position the media is not at.
   */
  readonly following: boolean
}

export function emptyLink(elementId: string): MediaLink {
  return { elementId, reportedMs: 0, commandedMs: null, following: true }
}

/** Record that the lesson has asked the media to move. */
export function commanded(link: MediaLink, positionMs: number): MediaLink {
  return { ...link, commandedMs: positionMs, following: false }
}

export interface Reconciliation {
  readonly link: MediaLink
  /**
   * Where the transport should seek itself, or null to do nothing.
   *
   * Non-null means the learner moved the media directly and the lesson follows (FR-036).
   */
  readonly seekTransportTo: number | null
}

/**
 * Apply a report from the media.
 *
 * Three outcomes, distinguished by arithmetic rather than by bookkeeping:
 *
 * 1. **Echo** — within tolerance of what we commanded. The seek landed; move nothing.
 * 2. **Drift** — the media is roughly where it last said it was. It is playing, or still
 *    buffering toward a seek we asked for. Move nothing.
 * 3. **Jump** — the position changed by more than the tolerance since the last report, and
 *    is not our echo. The learner moved the media; the transport follows (FR-036).
 *
 * **Case 2 is the correction that matters, and it is not what this contract first said.**
 * The original rule was "outside tolerance *and not awaiting a command* → follow", which
 * reintroduces precisely the stall that got the `ignoreNextReport` flag rejected: a seek the
 * platform silently refuses leaves the flag set, and the learner's next genuine scrub is
 * swallowed forever. Its opposite — always follow when outside tolerance — is worse in a
 * commoner case: a media element still buffering reports the position it has *not yet left*,
 * and the transport would chase it backwards, undoing the seek the learner just made.
 *
 * Comparing against the **last reported position** separates them without a clock and
 * without state that can be left set. A playing element creeps by about one report interval
 * per report and never trips the threshold; a learner dragging a scrub bar always does. A
 * refused seek produces no report at all, so nothing is latched waiting for one.
 */
export function reconcile(
  link: MediaLink,
  reportedMs: number,
  toleranceMs: number = MEDIA_SYNC_TOLERANCE_MS,
): Reconciliation {
  const next = { ...link, reportedMs }

  if (link.commandedMs !== null && Math.abs(reportedMs - link.commandedMs) <= toleranceMs) {
    return { link: { ...next, following: true }, seekTransportTo: null }
  }

  const jumped = Math.abs(reportedMs - link.reportedMs) > toleranceMs
  if (!jumped) {
    // Drifting, or buffering toward a seek that has not arrived. Record where the media
    // actually is — the lesson displays that rather than what it asked for — and wait.
    return { link: next, seekTransportTo: null }
  }

  return { link: { ...next, commandedMs: null, following: true }, seekTransportTo: reportedMs }
}
