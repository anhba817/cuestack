import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { createElementRegistry, builtinElements } from '@cuestack/core'
import { Inspector } from '../../src/inspector/Inspector.js'
import { builtinElementEditors, createElementEditorRegistry } from '../../src/registry/editors.js'
import { useEditorSession, type EditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'
import * as React from 'react'

/**
 * Registering seven plugins changes nothing a teacher sees while authoring.
 *
 * `resolve` was not the only plugin member with a side effect — `Inspector` reads a registered
 * plugin's `inspector` spec, so seven new plugins could have replaced the panel for all seven
 * types inside a feature about adding checks. FR-006b covers both halves of that neutrality, and
 * this file is the authoring half (SC-001a).
 *
 * The second describe is the one a cast would have hidden. `EditorField extends InspectorField` by
 * adding `itemDefaults` and the value transforms, and the plugin path is cast rather than
 * converted — so a spec lacking them, taking precedence, would silently break a control.
 */
afterEach(cleanup)

const editors = createElementEditorRegistry(builtinElementEditors)
const plugins = createElementRegistry(builtinElements)

function panel(type: string, withPlugins: boolean) {
  const lesson = lessonWith([element({ id: 'e1', type, effects: [] })])
  let session!: EditorSession
  function Host(): React.ReactNode {
    session = useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource: countingIds() })
    React.useEffect(() => session.select(['e1']), [])
    return (
      <Inspector
        session={session}
        slide={session.draft.slides[0]!}
        editors={editors}
        {...(withPlugins ? { plugins } : {})}
      />
    )
  }
  const { container } = render(<Host />)
  return container
}

const fieldKeys = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-cs-field]')].map((n) => n.getAttribute('data-cs-field') ?? '')

describe('the panel is identical with and without the plugin registry', () => {
  for (const type of ['text', 'image', 'shape', 'video', 'audio', 'button', 'question']) {
    it(`shows the same fields for ${type}`, () => {
      const without = fieldKeys(panel(type, false))
      cleanup()
      const withPlugins = fieldKeys(panel(type, true))
      expect(withPlugins).toEqual(without)
      expect(withPlugins.length).toBeGreaterThan(0)
    })
  }
})

describe('field-level extras survive the derivation', () => {
  it('a question’s options list still offers to add one', () => {
    // `itemDefaults` is a function core's `InspectorField` cannot carry. Lose it and "Add option"
    // mints an item of blank strings, which the schema refuses — so the button appears to do
    // nothing, which is precisely the failure its own comment records.
    const container = panel('question', true)
    // `data-cs-list-add` rather than the accessible name: the panel legitimately carries more than
    // one "add" control, and this assertion is about the options list specifically.
    expect(container.querySelector('[data-cs-list-add]')).not.toBeNull()

    // And the extra itself survived the derivation — the function core cannot carry.
    const derived = editors.get('question')!.inspector.find((f) => f.key === 'payload.options')
    expect(typeof derived?.itemDefaults).toBe('function')
    expect(derived!.itemDefaults!(1)).toEqual({ id: 'option-2', label: 'Option 2' })
  })

  it('the derived list keeps the declaration core owns', () => {
    // The other direction: the studio adds to core's fields rather than replacing them.
    const declared = builtinElements.find((p) => p.type === 'question')!.inspector.fields.map((f) => f.key)
    const derived = editors.get('question')!.inspector.map((f) => f.key)
    expect(derived).toEqual(declared)
  })
})

describe('a type the studio has never heard of still shows its plugin’s fields', () => {
  it('keeps the original intent of the precedence', () => {
    const custom = createElementRegistry([
      {
        ...builtinElements[0]!,
        type: 'gauge',
        inspector: { fields: [{ key: 'payload.max', label: 'Maximum', kind: 'number' }] },
      },
    ])
    const lesson = lessonWith([element({ id: 'e1', type: 'gauge', effects: [] })])
    let session!: EditorSession
    function Host(): React.ReactNode {
      session = useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource: countingIds() })
      React.useEffect(() => session.select(['e1']), [])
      return <Inspector session={session} slide={session.draft.slides[0]!} editors={editors} plugins={custom} />
    }
    const { container } = render(<Host />)
    expect(fieldKeys(container)).toContain('payload.max')
  })
})
