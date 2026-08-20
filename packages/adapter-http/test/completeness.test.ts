import { describe, expect, it } from 'vitest'
import { createHttpAdapters, OPERATIONS } from '../src/index.js'
import { mappingFor } from './harness/mapping.js'
import { flatShape } from './harness/shapes.js'
import { stubTransport } from './harness/request.js'

const full = () => mappingFor(flatShape)

describe('an incomplete mapping', () => {
  it('is refused at construction, not at first use', () => {
    /**
     * FR-019a. A mapping discovered to be incomplete an hour into somebody's work is the worst
     * moment to discover it — the editor would have nothing to offer them.
     */
    const { publish, ...rest } = full()
    void publish
    expect(() => createHttpAdapters({ mapping: rest, request: stubTransport().request })).toThrow(
      /publish/,
    )
  })

  it('names every missing operation rather than the first', () => {
    // SC-008a. A host fixing them one build at a time learns the same lesson twelve times.
    const { publish, withdraw, restore, ...rest } = full()
    void [publish, withdraw, restore]

    let message = ''
    try {
      createHttpAdapters({ mapping: rest, request: stubTransport().request })
    } catch (cause) {
      message = cause instanceof Error ? cause.message : ''
    }

    expect(message).toContain('publish')
    expect(message).toContain('withdraw')
    expect(message).toContain('restore')
  })

  it('refuses an entry missing only its reader, not only its request builder', () => {
    const mapping = { ...full(), listVersions: { request: () => ({ method: 'GET', url: '/x' }) } }
    expect(() =>
      createHttpAdapters({ mapping: mapping as never, request: stubTransport().request }),
    ).toThrow(/listVersions/)
  })

  it('accepts a mapping that describes everything', () => {
    expect(() => createHttpAdapters({ mapping: full(), request: stubTransport().request })).not.toThrow()
  })

  it('declares every operation the contract lists', () => {
    expect(OPERATIONS).toHaveLength(12)
    expect(new Set(OPERATIONS).size).toBe(12)
  })
})
