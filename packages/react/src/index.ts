/**
 * @cuestack/react — the primary adapter. **Client entry.**
 *
 * Empty of features in Wave 0. Wave 2 brings <LessonPlayer>, the RSC/client
 * boundary, and CSS-driven logical-canvas scaling.
 *
 * This entry and `server.ts` export the *same* surface with different
 * implementations — which is what a framework adapter is. Exporting different
 * names from each would make the type layer depend on which condition resolved,
 * and no consumer's tsconfig should have to know that.
 */

/** Which export condition the consumer resolved. */
export type EntryKind = 'client' | 'server'

export const ENTRY_KIND: EntryKind = 'client'

export const REACT_WAVE = 0 as const
