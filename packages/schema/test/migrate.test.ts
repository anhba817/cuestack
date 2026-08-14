import { describe, expect, it } from 'vitest'
import { migrate, currentVersion, supportedVersions } from '../src/migrate/index.js'
import { resolveChain } from '../src/migrate/chain.js'
import { loadFixture, reference } from './helpers.js'

/** Quickstart Scenario 9's four rows. */
describe('migrate()', () => {
  it('exposes the current version and the supported set', () => {
    expect(currentVersion).toBe('1.0')
    expect(supportedVersions).toContain('1.0')
    expect(supportedVersions).toContain('0.9')
  })

  it('carries a supported older version forward with no content lost', () => {
    const result = migrate(loadFixture('legacy/v0_9-supported.json'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.manifest.schemaVersion).toBe('1.0')
    expect(result.manifest.lesson.title).toBe('Workplace Safety')
    expect(result.manifest.slides).toHaveLength(4)
    expect(result.applied).toEqual(['0.9->1.0'])
  })

  it('refuses a version newer than supported, loading nothing', () => {
    const result = migrate(loadFixture('legacy/newer-than-supported.json'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((i) => i.code)).toContain('SCHEMA_VERSION_UNSUPPORTED')
    expect(result).not.toHaveProperty('manifest')
  })

  it('refuses an absent version rather than assuming it is current', () => {
    const result = migrate(loadFixture('legacy/version-absent.json'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((i) => i.code)).toContain('SCHEMA_VERSION_ABSENT')
  })

  it('refuses an old version it has no record of', () => {
    const result = migrate(loadFixture('legacy/unsupported-old.json'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((i) => i.code)).toContain('SCHEMA_VERSION_UNSUPPORTED')
  })

  it('is a no-op for a manifest already at the current version', () => {
    const result = migrate(reference())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.applied).toEqual([])
    expect(result.manifest).toEqual(reference())
  })

  it('validates the migrated result, not just its shape', () => {
    const broken = loadFixture('legacy/v0_9-supported.json') as Record<string, any>
    broken.slides[0].durationMs = -1
    const result = migrate(broken)
    expect(result.ok).toBe(false)
  })

  it('never throws, whatever it is given', () => {
    for (const input of [undefined, null, 42, 'x', [], {}]) {
      expect(() => migrate(input)).not.toThrow()
      expect(migrate(input).ok).toBe(false)
    }
  })
})

describe('chain resolution', () => {
  const noop = (m: unknown) => m

  it('refuses a chain with a missing step rather than skipping the gap', () => {
    // 0.8 is registered but nothing leads onward from 0.85.
    const broken = [
      { from: '0.8', to: '0.85', up: noop },
      { from: '1.0', to: '1.0', up: noop },
    ]
    const result = resolveChain('0.8', broken)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((i) => i.code)).toContain('MIGRATION_CHAIN_INCOMPLETE')
    expect(result.issues[0]?.message).toContain('gap')
  })

  it('refuses a chain that loops rather than spinning forever', () => {
    const looping = [
      { from: '0.8', to: '0.9', up: noop },
      { from: '0.9', to: '0.8', up: noop },
    ]
    const result = resolveChain('0.8', looping)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((i) => i.code)).toContain('MIGRATION_CHAIN_INCOMPLETE')
  })

  it('walks a multi-step chain in order', () => {
    const chain = [
      { from: '0.7', to: '0.8', up: noop },
      { from: '0.8', to: '0.9', up: noop },
      { from: '0.9', to: '1.0', up: noop },
    ]
    const result = resolveChain('0.7', chain)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.steps.map((s) => `${s.from}->${s.to}`)).toEqual(['0.7->0.8', '0.8->0.9', '0.9->1.0'])
  })
})
