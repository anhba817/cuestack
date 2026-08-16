import type { LessonManifest } from '@cuestack/schema'

/**
 * Selection algebra — pure, and independent of pointer handling.
 *
 * Separated from the hook so multi-selection is testable with no browser at all. Its suite
 * is named `*.pure.test.ts`, which puts it in the node project where there is no `document`
 * to reach for — the same guarantee `geometry/` gets from its directory (research R-04).
 *
 * Order is preserved throughout. It is what "the selection" means to a teacher who
 * shift-clicked four things, and alignment reports read better when the first thing clicked
 * stays first.
 */

/** Replace the selection outright. */
export const replace = (ids: readonly string[]): readonly string[] => dedupe(ids)

/** Add if absent, remove if present — what a modifier-click does. */
export function toggle(current: readonly string[], id: string): readonly string[] {
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
}

/** Add without removing, for a marquee that sweeps over things already selected. */
export function add(current: readonly string[], ids: readonly string[]): readonly string[] {
  return dedupe([...current, ...ids])
}

export const clear = (): readonly string[] => []

/**
 * Drop any id that is not on the given slide.
 *
 * Invariant 1 from data-model.md §2, enforced at the one place selections are set. Deleting
 * an element must not leave a selection pointing at something the draft no longer contains —
 * every consumer downstream would then have to handle a missing element, and one of them
 * would forget.
 */
export function clampSelection(
  ids: readonly string[],
  draft: LessonManifest,
  slideId: string,
): readonly string[] {
  const slide = draft.slides.find((s) => s.id === slideId) ?? draft.slides[0]
  const present = new Set((slide?.elements ?? []).map((e) => e.id))
  return dedupe(ids).filter((id) => present.has(id))
}

const dedupe = (ids: readonly string[]): readonly string[] => [...new Set(ids)]
