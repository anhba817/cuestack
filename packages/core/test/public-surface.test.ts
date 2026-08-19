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
  // Registries
  'createEffectRegistry',
  'createElementRegistry',
  // Adapters
  'memoryAdapters',
  // Publishing (Wave 5). Listed here for the reason this file exists: a capability that is built,
  // tested, and unexported is one a later wave finds by needing it.
  'createMemoryPublishing',
  'builtinElements',
  'checkLesson',
  'withAssetIssues',
  'severityFor',
  'collectAssetRefs',
  'checkAssets',
  'accessibilityIssues',
  'SEMANTIC_CODES',
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
})
