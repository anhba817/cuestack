/**
 * Turning a response into one of exactly four meanings.
 *
 * **This is not a route mapping, and FR-019b's ban does not reach it.** It names no path, no method,
 * and no resource — it encodes the published HTTP status vocabulary, which is a standard rather than
 * our opinion about somebody's API. The ban is on prescribing *where things live*; a host whose API
 * signals a conflict differently replaces this and nothing else (research R-07).
 *
 * The four exist because a caller that cannot tell them apart cannot say anything useful to a
 * teacher. Feature 009's publish flow branches on exactly this distinction.
 */

export type Outcome = 'permission' | 'not-found' | 'conflict' | 'unavailable'

export interface ResponseView {
  readonly status: number
  readonly body: unknown
}

/** `null` means success. Everything else is one of the four. */
export type Classifier = (view: ResponseView) => Outcome | null

export const classify: Classifier = ({ status }) => {
  if (status >= 200 && status < 300) return null
  if (status === 401 || status === 403) return 'permission'
  if (status === 404 || status === 410) return 'not-found'
  if (status === 409 || status === 412) return 'conflict'
  /**
   * Everything else is `unavailable`, including 4xx statuses that are really the caller's fault.
   *
   * Deliberate: the alternative is a fifth meaning, and FR-022 says there are four. "Try again
   * shortly" is the least wrong thing to tell a teacher about a response nobody anticipated — it
   * neither sends them hunting through their lesson nor claims they lack permission they may have.
   */
  return 'unavailable'
}
