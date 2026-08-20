import { describe, it } from 'vitest'
import { assertAssets, assertPublishing } from './behaviour.js'
import { flatShape } from './harness/shapes.js'
import { lesson } from './harness/lesson.js'

describe('publishing over HTTP', () => {
  it('publishes, lists newest first, withdraws, restores, and records', () =>
    assertPublishing(flatShape, lesson()))
})

describe('assets over HTTP', () => {
  it('resolves an address, or reports none', () => assertAssets(flatShape, lesson()))
})
