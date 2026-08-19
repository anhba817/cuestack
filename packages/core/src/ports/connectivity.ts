/**
 * Whether the network is reachable, as far as the browser will say.
 *
 * Shaped like `VisibilityPort` on purpose — `isOnline`/`subscribe` against
 * `isHidden`/`subscribe` — because it does the same kind of job and a second port that looked
 * different for no reason would cost a reader more than it saved a writer.
 *
 * **Not the source of truth about whether saving works.** `navigator.onLine` reports whether
 * there is a network interface, not whether the host's API answers, so trusting it would show
 * Offline behind a captive portal and Saved-pending against a dead backend. The authority is
 * the save outcome; this port exists to turn "the connection came back" from something
 * discovered up to two minutes later into something discovered at once (research R-09).
 *
 * Like `Scheduler`, declared here and consumed only by adapters — see that file's header.
 */
export interface Connectivity {
  isOnline(): boolean
  /** Returns an unsubscribe function. The listener receives the new state. */
  subscribe(listener: (online: boolean) => void): () => void
}
