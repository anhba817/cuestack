/**
 * Deferred execution, injected rather than reached for.
 *
 * The editor has to wait — 1.5 s of idle before an autosave, a backoff between retries, a
 * checkpoint interval measured in editing time. It may not do so by itself: the
 * `no-clock-in-studio` lint rule bans `setTimeout`, `setInterval`, `requestAnimationFrame`,
 * `Date`, and `performance.now` across `packages/studio/src/**` with no `ignores`, and its
 * comment says the absence is the point.
 *
 * The rule offers the route this takes: "both primitives the editor needs already live in
 * `@cuestack/react` ... so `usePlayback` imports rather than reimplements." The contract is
 * declared here, the browser implementation ships from `@cuestack/react`, and the studio
 * imports it. Constitution II gets the same thing for free — every delay in the editor is
 * drivable by a test that never waits.
 *
 * **Deliberately not a member of `Ports`.** That interface's comment gives the reason:
 * "adding a port is then a visible change at every construction site, rather than a quiet new
 * obligation." Playback defers nothing, so every player construction site and every test's
 * ports object would be obliged to supply something the player cannot use.
 *
 * **The first port here with no consumer inside core**, alongside `Connectivity` — unlike
 * `MediaPort`, `VisibilityPort`, and `TimeSource`, which the kernel reads itself. That is a
 * consequence of core being the contract package: a second adapter's editor needs this
 * contract and must not import it from `@cuestack/react`, because the arrow points one way
 * (research R-03).
 */
export interface Scheduler {
  /**
   * Milliseconds from some fixed origin, monotonically non-decreasing.
   *
   * For measuring intervals, never for stamping a moment. A checkpoint's `recordedAt` comes
   * from the host's storage, which is the only participant with an authoritative wall clock.
   */
  now(): number
  /**
   * Run `task` after at least `delayMs`. The returned function cancels it if it has not run.
   *
   * Cancelling an already-run task is a no-op rather than an error: an editor unmounting
   * mid-interval should not have to know whether the timer fired first.
   */
  after(delayMs: number, task: () => void): () => void
}
