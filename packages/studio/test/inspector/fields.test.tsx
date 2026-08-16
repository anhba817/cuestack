import { act, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElementRegistry } from '@cuestack/core'
import { ELEMENT_TYPES } from '@cuestack/schema/validate'
import { Inspector } from '../../src/inspector/Inspector.js'
import { builtinElementEditors, createElementEditorRegistry } from '../../src/registry/editors.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith, oneOfEachType } from '../harness/corpus.js'

/**
 * T058 — FR-018, SC-010: the panel is a declaration, not a switch.
 *
 * The check that matters is negative: selecting a text element must show no field belonging
 * to a video. A panel assembled by branching on type passes the positive half of that and
 * fails the negative half the first time a branch falls through.
 */
const editors = createElementEditorRegistry(builtinElementEditors)

function panel(elements = oneOfEachType(), selectIndex = 0) {
  const lesson = lessonWith(elements)
  const idSource = countingIds()
  const { result } = renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource }),
  )
  if (selectIndex >= 0) act(() => result.current.select([lesson.slides[0]!.elements[selectIndex]!.id]))
  const view = render(
    <Inspector session={result.current} slide={result.current.draft.slides[0]!} editors={editors} />,
  )
  return { result, view }
}

const fieldKeys = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('[data-cs-field]')].map((n) => n.getAttribute('data-cs-field')!)

describe('the inspector shows the selected type’s fields', () => {
  it.each(ELEMENT_TYPES.map((t, i) => [t, i] as const))(
    'shows only %s fields for a %s',
    (type, index) => {
      const { view } = panel(oneOfEachType(), index)
      const keys = fieldKeys(view.container)
      const own = editors.get(type)!.inspector.map((f) => f.key)

      for (const key of own) expect(keys).toContain(key)

      // Nothing from any other type. The negative half.
      for (const other of ELEMENT_TYPES) {
        if (other === type) continue
        const foreign = editors
          .get(other)!
          .inspector.map((f) => f.key)
          .filter((k) => !own.includes(k))
        for (const key of foreign) expect(keys).not.toContain(key)
      }
    },
  )

  it('shows the common fields alongside, for every type', () => {
    for (let i = 0; i < ELEMENT_TYPES.length; i += 1) {
      const { view } = panel(oneOfEachType(), i)
      const keys = fieldKeys(view.container)
      expect(keys).toContain('x')
      expect(keys).toContain('startMs')
      expect(keys).toContain('hidden')
      view.unmount()
    }
  })

  it('labels every control, so the panel is announceable and keyboard-navigable', () => {
    const { view } = panel()
    const controls = view.container.querySelectorAll('input, select')
    expect(controls.length).toBeGreaterThan(0)
    for (const control of controls) {
      const id = control.getAttribute('id')
      if (!id) {
        // List items label by wrapping, which is equally valid.
        expect(control.closest('label')).not.toBeNull()
        continue
      }
      expect(view.container.querySelector(`label[for="${id}"]`)).not.toBeNull()
    }
  })

  it('prefers a registered core plugin’s spec over the built-in fallback (FR-018)', () => {
    const lesson = lessonWith([element({ type: 'text', payload: { text: 'x' } })])
    const idSource = countingIds()
    const { result } = renderHook(() =>
      useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource }),
    )
    act(() => result.current.select([lesson.slides[0]!.elements[0]!.id]))

    const plugins = createElementRegistry([
      {
        type: 'text',
        schema: (p): p is unknown => Boolean(p),
        resolve: () => ({ visible: true }),
        inspector: { fields: [{ key: 'payload.text', label: 'Body copy', kind: 'text' }] },
        validate: () => [],
        renderStateVersion: 1,
      },
    ])

    const { container } = render(
      <Inspector
        session={result.current}
        slide={result.current.draft.slides[0]!}
        editors={editors}
        plugins={plugins}
      />,
    )
    // The plugin's label, not the built-in registration's.
    expect(container.textContent).toContain('Body copy')
  })

  it('has no branch on element type — every type renders through the same path', () => {
    // SC-010, checked structurally: the seven panels differ only in the declared fields, so
    // the count of rendered fields equals declared type fields plus the common set.
    for (let i = 0; i < ELEMENT_TYPES.length; i += 1) {
      const type = ELEMENT_TYPES[i]!
      const { view } = panel(oneOfEachType(), i)
      const declared = editors.get(type)!.inspector.length
      const rendered = fieldKeys(view.container).length
      expect(rendered).toBe(declared + 12)
      view.unmount()
    }
  })
})
