#!/usr/bin/env node
/**
 * Placeholder gate — perf.
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
console.log('gate:perf — placeholder, no playback yet. Gains teeth in Wave 3 (QA-4), when playback exists to regress.')
