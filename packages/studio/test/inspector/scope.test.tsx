import { act, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElementRegistry, type ElementPlugin } from '@cuestack/core'
import { Inspector } from '../../src/inspector/Inspector.js'
import { builtinElementEditors, createElementEditorRegistry } from '../../src/registry/editors.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T065 — FR-025, FR-FWK-011: a plugin sees its own element and nothing else.
 *
 * The interesting part is *how* this holds. `inspector` is a declaration on the registration,
 * not a function the inspector calls with the lesson — so there is no argument through which a
 * plugin could reach the draft, its siblings, the selection, or the learner. The restriction
 * is a property of the shape rather than of anyone's discipline, which is the same argument
 * `ElementResolveInput` makes in the kernel.
 *
 * A test that only checked "we do not pass the lesson today" would pass and then fail silently
 * the first time someone added a convenience argument.
 */
const editors = createElementEditorRegistry(builtinElementEditors)

describe('a plugin supplying inspector fields', () => {
  it('declares fields as data — there is no call site to hand it the lesson', () => {
    const plugin: ElementPlugin = {
      type: 'text',
      schema: (p): p is unknown => Boolean(p),
      resolve: () => ({ visible: true }),
      inspector: { fields: [{ key: 'payload.text', label: 'Body', kind: 'text' }] },
      validate: () => [],
      renderStateVersion: 1,
    }

    // `inspector` is a value, not a function. Nothing can be passed to it.
    expect(typeof plugin.inspector).toBe('object')
    expect(typeof (plugin.inspector as unknown as () => void)).not.toBe('function')
  })

  it('renders a plugin’s fields without the plugin observing anything', () => {
    let observed = 0
    const lesson = lessonWith([element({ payload: { text: 'x' } }), element({ payload: { text: 'sibling' } })])
    const idSource = countingIds()
    const { result } = renderHook(() =>
      useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource }),
    )
    act(() => result.current.select([lesson.slides[0]!.elements[0]!.id]))

    const plugins = createElementRegistry([
      {
        type: 'text',
        // If the inspector ever called into the plugin to build fields, this would fire.
        schema: (p): p is unknown => {
          observed += 1
          return Boolean(p)
        },
        resolve: () => {
          observed += 1
          return { visible: true }
        },
        inspector: { fields: [{ key: 'payload.text', label: 'Body', kind: 'text' }] },
        validate: () => {
          observed += 1
          return []
        },
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

    expect(container.textContent).toContain('Body')
    expect(observed).toBe(0)
  })

  it('shows one element’s values, never a sibling’s', () => {
    const lesson = lessonWith([
      element({ payload: { text: 'mine' } }),
      element({ payload: { text: 'not mine' } }),
    ])
    const idSource = countingIds()
    const { result } = renderHook(() =>
      useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource }),
    )
    act(() => result.current.select([lesson.slides[0]!.elements[0]!.id]))

    const { container } = render(
      <Inspector session={result.current} slide={result.current.draft.slides[0]!} editors={editors} />,
    )
    const text = container.querySelector<HTMLInputElement>('[data-cs-field="payload.text"] input')!

    expect(text.value).toBe('mine')
    expect(container.innerHTML).not.toContain('not mine')
  })
})
