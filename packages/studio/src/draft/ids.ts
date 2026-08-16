/**
 * Where a new element's identity comes from.
 *
 * Injectable for the reason the clock is injectable (Wave 1's `TimeSource`): a test that
 * cannot predict its own output cannot assert on it. SC-016 replays an edit sequence and
 * demands a byte-identical manifest, which is impossible if every `add-element` reaches for
 * a global random source.
 *
 * The schema constrains ids to 1–128 characters with no pattern, so a UUID and a test's
 * `el-1` are equally valid and no format negotiation is needed (research R-08).
 */
export type IdSource = () => string

/**
 * Collision-resistant, and deliberately carrying no meaning.
 *
 * Deriving ids from content — slide id plus index — was considered and rejected: it makes
 * an id mean something, so reordering renames elements and every reference to them breaks.
 */
export const randomIds: IdSource = () => crypto.randomUUID()
