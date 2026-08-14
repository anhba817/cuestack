#!/usr/bin/env node
/**
 * Placeholder gate — a11y.
 *
 * FR-017 requires gates whose subject matter does not exist yet to be PRESENT
 * AND PASSING, not absent. The reason is narrow: enabling this later must be a
 * change to one script, not the creation of new CI infrastructure under
 * deadline pressure. A gate that does not exist when its feature lands is a
 * gate that gets postponed.
 *
 * This exits 0 because it checked nothing — not because failures are tolerated.
 * It MUST NOT be marked continue-on-error.
 */
console.log('gate:a11y — placeholder, no components yet. Gains teeth in Wave 2 (NX-3/RC-1), when the first learner-facing component ships.')
