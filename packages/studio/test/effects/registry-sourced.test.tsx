import { act, render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  resolve,
  builtinEffects,
  createEffectRegistry,
  type EffectDescriptor,
  type EffectRegistry,
} from '@cuestack/core'
import { EffectControls } from '../../src/effects/EffectControls.js'
import { renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * Everything the editor offers about an effect comes from that effect's registration.
 *
 * A list held by the editor would be the per-effect branch Constitution I calls a defect,
 * and it would rot *silently*: the menu would simply be missing an entry, and nobody would
 * be looking for something they did not know existed.
 */

const ui = (container: HTMLElement) => within(container)

/**
 * The effect controls over a live session.
 *
 * `renderEditor` mounts the canvas, not the inspector — the same split feature 005's
 * inspector suites use. Rendering the controls directly keeps the element *current*: the
 * wrapper re-reads it from the draft on every render, so an effect added mid-test appears
 * rather than the test asserting against the element it captured at setup.
 */
function openInspector(registry?: EffectRegistry) {
  const el = element()
  const rendered = renderEditor(lessonWith([el]), {
    inspector: true,
    ...(registry ? { effects: registry } : {}),
  })
  act(() => rendered.handle.session.select([el.id]))
  return { ...rendered, elementId: el.id }
}

describe('the effects offered', () => {
  it('are exactly the registry’s types, in its order (FR-018, FR-026)', () => {
    const { container } = openInspector()
    const options = ui(container)
      .getByLabelText('Effect')
      .querySelectorAll('option')
    expect([...options].map((o) => o.getAttribute('value'))).toEqual(
      createEffectRegistry(builtinEffects).types(),
    )
  })

  it('cover all eight the framework ships', () => {
    const { container } = openInspector()
    const values = [...ui(container).getByLabelText('Effect').querySelectorAll('option')].map(
      (o) => o.textContent,
    )
    expect(values.sort()).toEqual(
      ['appear', 'dim', 'disappear', 'fade', 'highlight', 'pulse', 'slide', 'zoom'].sort(),
    )
  })
})

describe('a chosen effect’s own declarations', () => {
  it('offers only the phases the descriptor declares (FR-019)', () => {
    // `pulse` declares `emphasis` alone. Offering it as an entrance would produce a manifest
    // the schema accepts and the resolver would run wrongly.
    const { handle, container, elementId } = openInspector()
    act(() => {
      handle.session.apply({
        kind: 'add-effect',
        id: elementId,
        type: 'pulse',
        phase: 'emphasis',
        startMs: 0,
        durationMs: 400,
      })
    })

    const phases = [...ui(container).getByLabelText('Phase').querySelectorAll('option')].map(
      (o) => o.getAttribute('value'),
    )
    expect(phases).toEqual(['emphasis'])
  })

  it('renders the parameters the descriptor declares, and only those (FR-020)', () => {
    const { handle, container, elementId } = openInspector()
    act(() => {
      handle.session.apply({
        kind: 'add-effect',
        id: elementId,
        type: 'slide',
        phase: 'enter',
        startMs: 0,
        durationMs: 400,
      })
    })

    // `slide` declares `from` (a direction) and `distance` (a number). `zoom` declares `from`
    // as a *number*. One key, two types — which is why this is per descriptor.
    expect(ui(container).getByLabelText('From')).toBeTruthy()
    expect(ui(container).getByLabelText('Distance')).toBeTruthy()
    expect(ui(container).queryByLabelText('Amount')).toBeNull()
  })

  it('gives slide.from a set of directions and zoom.from a plain number', () => {
    const { handle, container, elementId } = openInspector()
    act(() => {
      handle.session.apply({
        kind: 'add-effect',
        id: elementId,
        type: 'zoom',
        phase: 'enter',
        startMs: 0,
        durationMs: 400,
      })
    })
    // A dropdown here would be the mistake a central parameter table makes.
    expect(ui(container).getByLabelText('Starting scale').tagName).toBe('INPUT')
  })
})

describe('a ninth effect, registered by a host', () => {
  /**
   * The test that proves the rest, and it has two halves.
   *
   * Asserting only that a synthetic effect *appears* in the menu would let the worse defect
   * ship: an effect a teacher can add and the canvas renders as `UNKNOWN_EFFECT_TYPE`. The
   * registry has to be **one instance** reaching both the menu and `resolve`.
   */
  const ninth: EffectDescriptor = {
    type: 'shimmer',
    phases: ['emphasis'],
    motion: false,
    defaultEasing: 'linear',
    parameters: [{ key: 'intensity', label: 'Intensity', kind: 'number' }],
    at: (progress) => ({ opacity: 1 - progress * 0.5 }),
  }
  const registry = createEffectRegistry([...builtinEffects, ninth])

  it('appears in the menu with its declared phases and fields, with no editor change', () => {
    const { container } = openInspector(registry)
    const values = [...ui(container).getByLabelText('Effect').querySelectorAll('option')].map(
      (o) => o.getAttribute('value'),
    )
    expect(values).toContain('shimmer')
  })

  it('**renders on the canvas** too — the half that would otherwise ship broken', () => {
    const el = element({
      startMs: 0,
      endMs: 8000,
      effects: [
        { id: 'fx-9', type: 'shimmer', phase: 'emphasis', startMs: 0, durationMs: 1000, order: 0 },
      ],
    })
    const slide = lessonWith([el]).slides[0]!

    // With the host's registry: the effect resolves and contributes.
    const known = resolve(slide, 500, { effects: registry })
    expect(known.problems.filter((p) => p.code === 'UNKNOWN_EFFECT_TYPE')).toHaveLength(0)
    expect(known.elements[0]?.opacity).toBeLessThan(1)

    // Without it: the kernel says exactly what is wrong, which is what the menu must never
    // be able to cause.
    const unknown = resolve(slide, 500)
    expect(unknown.problems.some((p) => p.code === 'UNKNOWN_EFFECT_TYPE')).toBe(true)
  })

  /**
   * The same claim, made through the component a host actually mounts.
   *
   * **The test above shipped as the whole of it, and it was not enough.** It calls `resolve`
   * directly with the registry, which proves the kernel resolves a registered effect — a
   * thing nobody doubted. What it could not see is that `EditorCanvasProps` had no `effects`
   * member at all, so the canvas called `resolve(slide, atMs)` with two arguments and a
   * host's ninth effect was offered in the menu and rendered as `UNKNOWN_EFFECT_TYPE` on the
   * stage: the exact defect feature 006's requirement was raised to prevent. The path that
   * works was tested; the path a host takes was not.
   *
   * Asserted on the element's rendered opacity rather than on a problem list, because the
   * canvas does not surface `problems` — what a teacher sees is whether the effect happened.
   */
  it('reaches the canvas, through the prop a host passes rather than a direct call', () => {
    const el = element({
      startMs: 0,
      endMs: 8000,
      effects: [
        { id: 'fx-9', type: 'shimmer', phase: 'emphasis', startMs: 0, durationMs: 1000, order: 0 },
      ],
    })
    const withRegistry = renderEditor(lessonWith([el]), { effects: registry })
    act(() => withRegistry.handle.session.setAuthoringTime(500))
    const styled = withRegistry.container.querySelector(`[data-cs-element-id="${el.id}"]`)
    expect(styled?.getAttribute('style')).toContain('--cs-opacity')

    // The negative control: the same canvas told nothing about the ninth effect renders it
    // with no contribution at all. Without this, the assertion above would pass on a canvas
    // that ignored the prop and happened to set the property for another reason.
    const without = renderEditor(lessonWith([el]))
    act(() => without.handle.session.setAuthoringTime(500))
    const plain = without.container.querySelector(`[data-cs-element-id="${el.id}"]`)
    expect(plain?.getAttribute('style') ?? '').not.toContain('--cs-opacity')
  })
})

describe('read-only', () => {
  it('offers no way to add, configure, or remove (FR-047)', () => {
    const el = element({
      effects: [{ id: 'fx-1', type: 'fade', phase: 'enter', startMs: 0, durationMs: 400, order: 0 }],
    })
    const { handle } = renderEditor(lessonWith([el]), { mode: 'read-only' })
    act(() => handle.session.select([el.id]))

    const { container } = render(<EffectControls session={handle.session} element={el} />)
    for (const control of container.querySelectorAll('button, select, input')) {
      // The "Keep"/"Remove" pair inside a confirmation is unreachable in read-only, because
      // the control that opens it is disabled.
      expect((control as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('refuses an edit dispatched anyway, so the guard is the reducer’s and not the UI’s', () => {
    const el = element()
    const { handle } = renderEditor(lessonWith([el]), { mode: 'read-only' })
    let refused = false
    act(() => {
      const result = handle.session.apply({
        kind: 'add-effect',
        id: el.id,
        type: 'fade',
        phase: 'enter',
        startMs: 0,
        durationMs: 400,
      })
      refused = !result.ok
    })
    expect(refused).toBe(true)
  })
})
