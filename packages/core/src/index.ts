/**
 * @cuestack/core — the headless kernel.
 *
 * Empty in Wave 0 by design. The package exists now so the workspace graph, the
 * exports map, and the core/UI boundary rule are all real and tested from the
 * first commit, rather than retrofitted onto code that already violates them.
 *
 * Wave 1 fills this in: timeline resolver, monotonic clock, advance controller,
 * element and effect registries, adapter interfaces.
 *
 * This package has zero runtime dependencies and MUST NOT import a UI framework.
 * Enforced by .dependency-cruiser.cjs, not by convention.
 */
export const CORE_WAVE = 0 as const
