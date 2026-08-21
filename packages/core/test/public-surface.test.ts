import { describe, expect, it } from 'vitest'
import * as core from '../src/index.js'

/**
 * Every name the package claims to export actually resolves.
 *
 * Feature 002 marked its public-surface task complete with two of four capabilities
 * unexported: `createTransport` and `createAdvanceController` were built, tested, and
 * unreachable, because a comment withholding them outlived the condition that justified it.
 * Wave 2 found it only by needing them.
 *
 * A list is checked rather than a count, because a count passes while a name is swapped.
 */
const EXPECTED_VALUES = [
  // Resolution
  'resolve',
  // Time
  'createTransport',
  'createClock',
  // Advancement
  'createAdvanceController',
  // Feature 012: the question a navigation control asks, in a form that changes nothing.
  'learnerMayLeave',
  // Registries
  'createEffectRegistry',
  'createElementRegistry',
  // Adapters
  'memoryAdapters',
  // Publishing (Wave 5). Listed here for the reason this file exists: a capability that is built,
  // tested, and unexported is one a later wave finds by needing it.
  'createMemoryPublishing',
  'builtinElements',
  // Added when the surface check became bidirectional. Each of these was exported and recorded
  // nowhere — the defect this file exists to prevent, pointing the other way.
  'builtinEffects',
  'applyEasing',
  'composeContributions',
  'createMemoryStorage',
  'createMemoryAssets',
  'createMemoryAnalytics',
  'checkLesson',
  'withAssetIssues',
  'severityFor',
  'collectAssetRefs',
  'checkAssets',
  'accessibilityIssues',
  'SEMANTIC_CODES',
  'exportLesson',
  'exportLessonWithFiles',
  'toBase64',
  'fromBase64',
  'PACKAGE_FORMAT_VERSION',
  'comparePackageVersions',
  'isLessonPackage',
  'readPackage',
  'importLesson',
  'remapAssetIds',
  'HARDENING_DEFAULTS',
  // Interactions (Wave 3)
  'isComplete',
  'isUnsatisfiable',
  'COMPLETION_POLICIES',
  'DEFAULT_COMPLETION_POLICY',
  'evaluate',
  'isCorrectResponse',
  'emptyInteractionState',
  'submit',
  // Media (Wave 3)
  'createMediaLink',
  'reconcile',
  'commanded',
  'emptyLink',
  'MEDIA_SYNC_TOLERANCE_MS',
  'MEDIA_REPORT_INTERVAL_MS',
]

/** Names checked by the grouped assertions below rather than by the list above. */
const OTHER_CHECKED = [
  'isComplete',
  'evaluate',
  'emptyInteractionState',
  'submit',
  'createMediaLink',
  'reconcile',
  'commanded',
  'emptyLink',
]

describe('the public surface of @cuestack/core', () => {
  it.each(EXPECTED_VALUES)('exports %s', (name) => {
    expect(core).toHaveProperty(name)
    expect((core as Record<string, unknown>)[name]).toBeDefined()
  })

  it('exports every interactions capability, not merely some of them', () => {
    // The specific shape of feature 002's defect: a module built and partly exported.
    for (const name of ['isComplete', 'evaluate', 'emptyInteractionState', 'submit']) {
      expect(typeof (core as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('exports every media capability, including the rule itself', () => {
    for (const name of ['createMediaLink', 'reconcile', 'commanded', 'emptyLink']) {
      expect(typeof (core as Record<string, unknown>)[name]).toBe('function')
    }
    expect(typeof core.MEDIA_SYNC_TOLERANCE_MS).toBe('number')
  })

  it('records every capability it exports, not merely resolves the ones it records', () => {
    /**
     * **The other direction, which this file did not check for five waves.**
     *
     * `EXPECTED_VALUES` guards *listed-but-missing* — a name this package claims and does not
     * deliver, which is feature 002's defect and the reason the file exists. It said nothing
     * about *exported-but-unlisted*, and nine names had accumulated there: `builtinEffects`,
     * `applyEasing`, `composeContributions` and the three memory-adapter factories among them.
     * A capability nobody records is one a later wave finds by needing it — the same failure,
     * arrived at from the opposite side.
     *
     * **Constants are allowed for explicitly rather than by omission.** A rule reading "every
     * export must be listed" would demand an entry for every threshold and version number, which
     * is the noisy version of this check and the version somebody turns off. Naming them here
     * costs one line each and keeps the list a record of *capabilities*.
     */
    const CONSTANTS = ['CLAMP_CEILING_MS', 'EASINGS', 'RENDER_STATE_VERSION', 'MEDIA_SYNC_TOLERANCE_MS']
    const recorded = new Set([...EXPECTED_VALUES, ...CONSTANTS, ...OTHER_CHECKED])

    const unrecorded = Object.keys(core).filter((name) => !recorded.has(name))
    expect(
      unrecorded,
      'exported by @cuestack/core and recorded nowhere in this file. Add it to EXPECTED_VALUES ' +
        'if it is a capability, or to CONSTANTS if it is a number or a table.',
    ).toEqual([])
  })
})
