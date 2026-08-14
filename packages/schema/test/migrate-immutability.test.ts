import { describe, expect, it } from 'vitest'
import { migrate } from '../src/migrate/index.js'
import { loadFixture } from './helpers.js'

/**
 * FR-011 / US4 #4 / SC-010: upgrades are forward-only and never touch the
 * caller's object. A migration that mutated its input would corrupt whatever
 * the host still holds a reference to — the draft the teacher is editing.
 */
describe('migration immutability', () => {
  it('leaves the input byte-identical after a successful upgrade', () => {
    const input = loadFixture('legacy/v0_9-supported.json')
    const before = JSON.stringify(input)
    migrate(input)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('returns a new value, not the input', () => {
    const input = loadFixture('legacy/v0_9-supported.json')
    const result = migrate(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.manifest).not.toBe(input)
  })

  it('leaves the input untouched on every failure path too', () => {
    for (const name of ['newer-than-supported', 'version-absent', 'unsupported-old']) {
      const input = loadFixture(`legacy/${name}.json`)
      const before = JSON.stringify(input)
      migrate(input)
      expect(JSON.stringify(input)).toBe(before)
    }
  })

  it('does not share nested structure with the input', () => {
    const input = loadFixture('legacy/v0_9-supported.json') as Record<string, any>
    const result = migrate(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.manifest.slides[0]).not.toBe(input.slides[0])
  })
})
