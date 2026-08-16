import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Inspector } from '../../src/inspector/Inspector.js'
import { builtinElementEditors, createElementEditorRegistry } from '../../src/registry/editors.js'
import { renderEditor } from '../harness/editor.js'
import { emptySlide } from '../harness/corpus.js'
import { render } from '@testing-library/react'

/**
 * T114 — SC-008, a countable proxy for NFR-USA-001.
 *
 * The original criterion was "an untrained teacher can do this in under two minutes". A
 * first-use timing study is not something this project can run, and a success criterion nothing
 * can check is decoration — so the clarification replaced it with something countable.
 *
 * **The proxy is weaker than the thing it stands for, and deliberately so.** It measures the
 * shortest path, not whether a teacher finds it. What it does catch is the regression that
 * matters: a flow that quietly grows from four steps to nine because each addition seemed
 * small on its own.
 */
const BUDGET = 8
const editors = createElementEditorRegistry(builtinElementEditors)

describe('composing a first element takes no more than eight interactions', () => {
  it('add, type, size, and describe — counted', () => {
    const { handle, container } = renderEditor(emptySlide())
    let interactions = 0
    const interact = (fn: () => void): void => {
      interactions += 1
      act(fn)
    }

    // 1. Add a text element from the menu. It becomes the selection, so no separate click.
    interact(() => void fireEvent.click(container.querySelector('[data-cs-add="text"]')!))
    const id = handle.session.draft.slides[0]!.elements[0]!.id
    expect(handle.session.selection).toEqual([id])

    // 2. Enter text-edit mode. 3. Type. 4. Commit.
    interact(() => handle.session.beginTextEdit(id))
    interact(() => handle.session.setPendingText('Welcome to the lesson'))
    interact(() => handle.session.endTextEdit())

    // 5. Size it.
    interact(() => void handle.session.apply({
      kind: 'transform-elements',
      ids: [id],
      geometry: { width: 800, height: 200 },
    }))

    // 6. Describe it, in the inspector — which is where alt text and the accessible name live.
    const panel = render(
      <Inspector session={handle.session} slide={handle.session.draft.slides[0]!} editors={editors} />,
    )
    const nameField = panel.container.querySelector<HTMLInputElement>(
      '[data-cs-field="accessibility.label"] input',
    )!
    interact(() => void fireEvent.change(nameField, { target: { value: 'Welcome heading' } }))

    // The outcome: a composed, described, valid element.
    const el = handle.session.draft.slides[0]!.elements[0]!
    expect((el.payload as { text: string }).text).toBe('Welcome to the lesson')
    expect(el.width).toBe(800)
    expect(el.accessibility?.label).toBe('Welcome heading')

    expect(interactions).toBeLessThanOrEqual(BUDGET)
  })

  it('needs no submenu to reach any step', () => {
    const { container } = renderEditor(emptySlide())

    // Every element type is offered directly, not behind a category or a “more” affordance.
    for (const type of ['text', 'image', 'shape', 'video', 'audio', 'button', 'question']) {
      expect(container.querySelector(`[data-cs-add="${type}"]`)).not.toBeNull()
    }
    expect(container.querySelector('details')).toBeNull()
    expect(container.querySelector('[aria-haspopup]')).toBeNull()
  })

  it('needs no settings dialog — accessibility metadata sits in the main panel', () => {
    const { handle } = renderEditor(emptySlide())
    act(() => void handle.session.apply({ kind: 'add-element', type: 'image' }))
    act(() => handle.session.select([handle.session.draft.slides[0]!.elements[0]!.id]))

    const { container } = render(
      <Inspector session={handle.session} slide={handle.session.draft.slides[0]!} editors={editors} />,
    )

    expect(container.querySelector('[data-cs-field="accessibility.altText"]')).not.toBeNull()
    expect(container.querySelector('dialog')).toBeNull()
    expect(container.querySelector('details')).toBeNull()
  })

  it('records the budget as a named constant, so a regression is a visible diff', () => {
    expect(BUDGET).toBe(8)
  })
})
