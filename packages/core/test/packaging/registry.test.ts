import { describe, expect, it } from 'vitest'
import { exportLesson, importLesson, readPackage } from '../../src/packaging/index.js'
import { createElementRegistry } from '../../src/elements/registry.js'
import { builtinElements } from '../../src/elements/builtin/index.js'
import { withAddress } from '../harness/packages.js'
import type { ElementPlugin } from '../../src/elements/contract.js'

const read = () => {
  const r = readPackage(JSON.stringify(exportLesson(withAddress(), { kind: 'draft' })))
  if (!r.ok) throw new Error('unreachable')
  return r.package
}

/**
 * FR-017a, and the reachable half of it.
 *
 * An earlier draft justified this option with a *custom* element type being reported unknown. That
 * cannot happen: the format's element union is closed, `migrate` ends with an unconditional
 * `validate`, and a lesson carrying an unregistered type is therefore refused before any registry is
 * consulted. Checking settled it.
 *
 * What is reachable is the cliff feature 009 documented: a supplied registry **replaces** the
 * default rather than extending it, so a host that passes only its own plugins has every other MVP
 * type reported unknown. That is the failure this option exists to let a host avoid, and composing
 * `[...builtinElements, mine]` is how.
 */
describe('import against a host registry', () => {
  it('reports nothing unknown when the registry holds the types the lesson uses', () => {
    const elements = createElementRegistry([...builtinElements])
    const result = importLesson(read(), { lessonId: 'mine', elements })
    if (!result.ok) throw new Error('unreachable')

    expect(result.issues.filter((i) => i.code === 'UNKNOWN_ELEMENT_TYPE')).toEqual([])
  })

  it('reports the cliff when a registry omits a type the lesson uses', () => {
    // Only `text` registered; the lesson has a button. This is what a host passing solely its own
    // plugins would see for all seven MVP types.
    const onlyText = builtinElements.filter((p) => p.type === 'text') as ElementPlugin[]
    const result = importLesson(read(), {
      lessonId: 'mine',
      elements: createElementRegistry(onlyText),
    })
    if (!result.ok) throw new Error('unreachable')

    expect(result.issues.some((i) => i.code === 'UNKNOWN_ELEMENT_TYPE')).toBe(true)
  })

  it("uses each registered plugin's own validate, which is what the option carries", () => {
    /**
     * The other half, and the one a host will actually use: a plugin of its own reports issues core
     * has never heard of. Without the option those never reach the import result at all.
     */
    const strict: ElementPlugin = {
      ...builtinElements.find((p) => p.type === 'button')!,
      validate: () => [{ code: 'HOUSE_STYLE_FORBIDS_LINKS', message: 'This school does not link out.' }],
    }
    const elements = createElementRegistry([
      ...builtinElements.filter((p) => p.type !== 'button'),
      strict,
    ])

    const result = importLesson(read(), { lessonId: 'mine', elements })
    if (!result.ok) throw new Error('unreachable')
    expect(result.issues.map((i) => i.code)).toContain('HOUSE_STYLE_FORBIDS_LINKS')

    // And without the registry, that plugin's opinion is simply absent.
    const bare = importLesson(read(), { lessonId: 'mine' })
    if (!bare.ok) throw new Error('unreachable')
    expect(bare.issues.map((i) => i.code)).not.toContain('HOUSE_STYLE_FORBIDS_LINKS')
  })

  it('never refuses for issues, whichever registry it was given', () => {
    // FR-017: a lesson that arrives with problems is a lesson to be fixed, not one to be refused.
    expect(importLesson(read(), { lessonId: 'mine' }).ok).toBe(true)
  })
})
