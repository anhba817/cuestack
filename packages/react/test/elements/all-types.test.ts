import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { allTypesSlide, lessonOf } from '../harness/corpus.js'
import { server } from '../harness/render.js'
import { LessonPlayer } from '../../src/server.js'
import { builtinRenderers } from '../../src/elements/builtin/index.js'
import { ELEMENT_TYPES } from './types.js'

/**
 * US4 #1 · SC-007 · FR-013.
 *
 * All seven types produce output, with authored geometry and layer order.
 *
 * Written so a renderer producing nothing fails. That is the whole difficulty: a
 * renderer returning `null` makes the markup shorter and every "does it contain a
 * stage" assertion still pass, so absence has to be asserted against directly.
 */
describe('every element type renders', () => {
  const lesson = lessonOf([allTypesSlide()])
  const markup = server(h(LessonPlayer, { lesson }))

  it('agrees with the schema about what the seven types are', () => {
    // Derived, not restated. The type list lives in a runtime const behind
    // `@cuestack/schema/validate`, and a rendering test has no business pulling Zod in
    // for seven strings — so it is read out of the schema's source instead. An eighth
    // type added to the format then fails here rather than going unrendered.
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'schema', 'src', 'validate', 'element.ts'),
      'utf8',
    )
    const declared = /export const ELEMENT_TYPES = \[([^\]]+)\]/.exec(source)?.[1]
    expect(declared, 'ELEMENT_TYPES not found in the schema source').toBeDefined()
    const fromSchema = [...declared!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
    expect(fromSchema).toEqual([...ELEMENT_TYPES].sort())
  })

  it('registers a renderer for all seven types', () => {
    expect(builtinRenderers.map((r) => r.type).sort()).toEqual([...ELEMENT_TYPES].sort())
  })

  it('gives each renderer a label for assistive technology', () => {
    // The registry rejects a renderer without one; this asserts none is a placeholder
    // string that happens to satisfy it.
    for (const renderer of builtinRenderers) {
      expect(renderer.label.length, renderer.type).toBeGreaterThan(2)
    }
  })

  it.each(ELEMENT_TYPES)('emits a frame for a %s element', (type) => {
    expect(markup).toContain(`data-cs-element-type="${type}"`)
  })

  it.each(ELEMENT_TYPES)('puts content inside the %s frame, not an empty box', (type) => {
    // The assertion that catches a renderer returning null: find this element's frame
    // and require something between its tags.
    const frame = frameFor(markup, type)
    expect(frame, `no frame for ${type}`).toBeDefined()
    expect(frame!.replace(/<[^>]*>/g, '').trim().length + countTags(frame!)).toBeGreaterThan(1)
  })

  it('renders none of them as a placeholder', () => {
    // A registered type falling through to the unavailable-content placeholder would
    // satisfy every assertion above.
    expect(markup).not.toContain('cs-placeholder')
    expect(markup).not.toContain('Content unavailable')
  })

  it('carries authored geometry on every element', () => {
    for (const element of allTypesSlide().elements) {
      const frame = frameFor(markup, element.type)
      expect(frame, element.type).toContain('--cs-x:')
      expect(frame, element.type).toContain('--cs-z:')
    }
  })

  it('emits elements in the kernel\'s paint order', () => {
    // zIndex 1..7 in the corpus. Document order must follow it, because two elements
    // with equal zIndex are separated only by order and the kernel already decided it.
    const order = [...markup.matchAll(/data-cs-element-type="(\w+)"/g)].map((m) => m[1])
    expect(order).toEqual(['text', 'image', 'shape', 'video', 'audio', 'button', 'question'])
  })
})

/** The markup of the first frame whose element type matches, tags included. */
function frameFor(markup: string, type: string): string | undefined {
  const at = markup.indexOf(`data-cs-element-type="${type}"`)
  if (at === -1) return undefined
  const start = markup.lastIndexOf('<div', at)
  const next = markup.indexOf('data-cs-element-id', at + 10)
  const end = next === -1 ? markup.length : markup.lastIndexOf('<div', next)
  return markup.slice(start, end)
}

function countTags(fragment: string): number {
  // The frame's own opening div does not count as content.
  return (fragment.match(/<[a-z]/g) ?? []).length - 1
}
