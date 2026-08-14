/**
 * Easing is applied to progress *before* an effect's `at` is called, so no effect
 * implements its own. That is what keeps easing authorable per-effect without
 * eight implementations of the same curve drifting apart.
 */
export type EasingFn = (t: number) => number

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)

export const EASINGS: Readonly<Record<string, EasingFn>> = {
  linear: (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => 1 - (1 - t) * (1 - t),
  'ease-in-out': (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  step: (t) => (t < 1 ? 0 : 1),
}

/** Unknown easing names fall back to linear rather than throwing: an authoring
 *  typo should not make a lesson unplayable. */
export function applyEasing(progress: number, easing: string | undefined): number {
  const fn = (easing && EASINGS[easing]) || EASINGS['linear']!
  return clamp01(fn(clamp01(progress)))
}
