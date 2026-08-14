import { describe, expect, it } from 'vitest'
import { migrate } from '../src/migrate/index.js'
import { loadFixture } from './helpers.js'

/** Re-running a step on the same input must be byte-identical (research R-07). */
describe('migration determinism', () => {
  const fixtures = ['v0_9-supported', 'newer-than-supported', 'version-absent', 'unsupported-old']

  it.each(fixtures)('produces byte-identical output for %s', (name) => {
    const input = loadFixture(`legacy/${name}.json`)
    expect(JSON.stringify(migrate(input))).toBe(JSON.stringify(migrate(input)))
  })

  it('adds no timestamp while upgrading', () => {
    const result = migrate(loadFixture('legacy/v0_9-supported.json'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const serialized = JSON.stringify(result.manifest)
    expect(serialized).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
    expect(serialized).not.toMatch(/updatedAt|migratedAt|createdAt/)
  })
})
