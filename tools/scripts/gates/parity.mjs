#!/usr/bin/env node
/**
 * Placeholder gate — parity.
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
console.log('gate:parity — placeholder. Gains teeth in Wave 4 (QA-5), when an editor and a player exist to diverge from each other.')
console.log('  Not guarded, and widened by Wave 3: every moving effect now declares a `reduced`')
console.log('  contribution alongside its `at`, and nothing checks that the two agree about timing.')
console.log('  FR-FWK-013 is "registered elements render consistently in editor preview and learner')
console.log('  playback" — entirely editor-versus-player, and there is no editor, so arming this for')
console.log('  effects would be arming a requirement that is not yet satisfiable. BR-015 covers what')
console.log('  can be checked today: every moving built-in has a substitution that preserves timing')
console.log('  and hides nothing.')
