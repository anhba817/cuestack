import { describe, expect, it } from 'vitest'
import { resolve } from '../../../src/resolve/index.js'
import { createElementRegistry } from '../../../src/elements/registry.js'
import { builtinElements } from '../../../src/elements/builtin/index.js'
import { countdownPlugin } from './plugin.js'
import { correct } from '../../harness/faulty.js'
import type { Slide } from '@cuestack/schema'

/**
 * Registering the example changes nothing about what an existing lesson renders.
 *
 * Feature 009 made the same assertion for the seven builtins, and it is what makes an example safe
 * to ship inside the test corpus: a fixture that altered rendered output would be teaching by side
 * effect, and every parity suite in the repository would be measuring it.
 */
describe('the guide example is inert', () => {
  it('leaves an existing slide identical', () => {
    const slide = correct().slides[0] as Slide
    const without = resolve(slide, 4000, { elements: createElementRegistry([...builtinElements]) })
    const with_ = resolve(slide, 4000, {
      elements: createElementRegistry([...builtinElements, countdownPlugin]),
    })
    expect(JSON.stringify(with_)).toBe(JSON.stringify(without))
  })

  it('contributes nothing when it does resolve', () => {
    // `{ visible: true }` and no contribution — exactly what the resolver already does with no
    // plugin at all, which is why adding one changes nothing.
    expect(countdownPlugin.resolve({ payload: { seconds: 30 } } as never)).toEqual({ visible: true })
  })
})
