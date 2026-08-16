import { act, fireEvent, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Inspector } from '../../src/inspector/Inspector.js'
import { builtinElementEditors, createElementEditorRegistry } from '../../src/registry/editors.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T060–T066 — the panels either side of a single selection, and what happens when a value is
 * refused.
 */
const editors = createElementEditorRegistry(builtinElementEditors)

function setup(elements = [element()], select: number[] = []) {
  const lesson = lessonWith(elements)
  const idSource = countingIds()
  const { result } = renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource }),
  )
  if (select.length > 0) {
    act(() => result.current.select(select.map((i) => lesson.slides[0]!.elements[i]!.id)))
  }
  const view = () =>
    render(
      <Inspector session={result.current} slide={result.current.draft.slides[0]!} editors={editors} />,
    )
  return { result, view }
}

describe('nothing selected — the slide’s own settings (FR-024)', () => {
  it('shows the slide panel rather than a blank one', () => {
    const { view } = setup()
    const { container } = view()
    expect(container.querySelector('[data-cs-panel="slide"]')).not.toBeNull()
  })

  it('shows name, duration, background, transition, and accessibility', () => {
    const { view } = setup()
    const keys = [...view().container.querySelectorAll('[data-cs-field]')].map((n) =>
      n.getAttribute('data-cs-field'),
    )
    expect(keys).toEqual(
      expect.arrayContaining([
        'name',
        'durationMs',
        'background',
        'transition.type',
        'accessibility.label',
      ]),
    )
  })

  it('does NOT expose the advance mode — that defers to ED-3/ED-4', () => {
    const keys = [...setup().view().container.querySelectorAll('[data-cs-field]')].map((n) =>
      n.getAttribute('data-cs-field'),
    )
    expect(keys.some((k) => k?.startsWith('advance'))).toBe(false)
  })

  it('writes a background as a whole discriminated object, not a bare colour', () => {
    const { result, view } = setup()
    const input = view().container.querySelector<HTMLInputElement>('[data-cs-field="background"] input')!

    act(() => void fireEvent.change(input, { target: { value: '#123456' } }))

    // `{ color }` alone has no discriminant and the schema refuses it — which is the whole
    // reason the field carries a transform.
    expect(result.current.draft.slides[0]!.background).toEqual({ kind: 'color', color: '#123456' })
  })

  it('changes the slide and nothing else', () => {
    const { result, view } = setup([element(), element()])
    const before = JSON.stringify(result.current.draft.slides[0]!.elements)
    const input = view().container.querySelector<HTMLInputElement>('[data-cs-field="name"] input')!

    act(() => void fireEvent.change(input, { target: { value: 'Renamed' } }))

    expect(result.current.draft.slides[0]!.name).toBe('Renamed')
    expect(JSON.stringify(result.current.draft.slides[0]!.elements)).toBe(before)
  })
})

describe('a rejected value (FR-023)', () => {
  it('states the problem and does not write it', () => {
    const { result, view } = setup([element()], [0])
    const before = JSON.stringify(result.current.draft)
    const width = view().container.querySelector<HTMLInputElement>('[data-cs-field="width"] input')!

    act(() => void fireEvent.change(width, { target: { value: '-40' } }))

    expect(result.current.lastRefusal?.reason).toBe('invalid')
    expect(JSON.stringify(result.current.draft)).toBe(before)
  })

  it('reports it where the teacher is looking, with an alert role', () => {
    const { view } = setup([element()], [0])
    const width = view().container.querySelector<HTMLInputElement>('[data-cs-field="width"] input')!
    act(() => void fireEvent.change(width, { target: { value: '-40' } }))

    const alert = view().container.querySelector('[data-cs-refusal]')
    expect(alert).not.toBeNull()
    expect(alert!.getAttribute('role')).toBe('alert')
    expect(alert!.textContent!.length).toBeGreaterThan(0)
  })
})

describe('cutting a slide’s duration below an element’s end (FR-052)', () => {
  it('leaves the element’s authored values intact', () => {
    const { result, view } = setup([element({ startMs: 0, endMs: 8000 })])
    const duration = view().container.querySelector<HTMLInputElement>('[data-cs-field="durationMs"] input')!

    act(() => void fireEvent.change(duration, { target: { value: '3000' } }))

    // BR-017's warning belongs to validation (PB-1). What must not happen is silent
    // truncation of work the teacher authored.
    expect(result.current.draft.slides[0]!.elements[0]!.endMs).toBe(8000)
    expect(result.current.draft.slides[0]!.durationMs).toBe(3000)
  })

  it('clamps only the authoring time', () => {
    const { result, view } = setup([element()])
    act(() => result.current.setAuthoringTime(7000))
    const duration = view().container.querySelector<HTMLInputElement>('[data-cs-field="durationMs"] input')!

    act(() => void fireEvent.change(duration, { target: { value: '3000' } }))

    expect(result.current.authoringTime).toBeLessThanOrEqual(3000)
  })
})

describe('several elements selected (FR-024)', () => {
  it('shows the common settings only', () => {
    const { view } = setup([element(), element()], [0, 1])
    const { container } = view()
    expect(container.querySelector('[data-cs-panel="multi"]')).not.toBeNull()
    expect(container.querySelector('[data-cs-field="payload.text"]')).toBeNull()
  })

  it('says “Mixed” where the values differ, rather than one member’s value', () => {
    const { view } = setup([element({ x: 10 }), element({ x: 900 })], [0, 1])
    const x = view().container.querySelector('[data-cs-field="x"]')!
    expect(x.textContent).toContain('Mixed')
  })

  it('shows the shared value where they agree', () => {
    const { view } = setup([element({ x: 42 }), element({ x: 42 })], [0, 1])
    const x = view().container.querySelector('[data-cs-field="x"]')!
    expect(x.textContent).toContain('42')
    expect(x.textContent).not.toContain('Mixed')
  })
})

describe('an unregistered element type (FR-026)', () => {
  const unknown = () => element({ type: 'hologram', payload: { text: 'x' } })

  it('is still selectable and still shows the common settings', () => {
    const { view } = setup([unknown()], [0])
    const { container } = view()
    const keys = [...container.querySelectorAll('[data-cs-field]')].map((n) =>
      n.getAttribute('data-cs-field'),
    )
    expect(keys).toContain('x')
    expect(keys).toContain('hidden')
  })

  it('says the type is unrecognised rather than showing an empty panel', () => {
    const { view } = setup([unknown()], [0])
    const note = view().container.querySelector('[data-cs-unrecognised]')
    expect(note).not.toBeNull()
    expect(note!.textContent).toContain('hologram')
  })
})

describe('accessibility metadata (FR-021)', () => {
  it('offers alt text for an image without an advanced section', () => {
    const { view } = setup(
      [element({ type: 'image', payload: { asset: { assetId: 'a', mimeType: 'image/png' } } })],
      [0],
    )
    const { container } = view()
    expect(container.querySelector('[data-cs-field="accessibility.altText"]')).not.toBeNull()
    // No disclosure widget between the teacher and it.
    expect(container.querySelector('details')).toBeNull()
  })

  it('offers a caption for an image', () => {
    const { view } = setup(
      [element({ type: 'image', payload: { asset: { assetId: 'a', mimeType: 'image/png' } } })],
      [0],
    )
    expect(view().container.querySelector('[data-cs-field="payload.caption"]')).not.toBeNull()
  })

  it('writes alt text into the element’s accessibility metadata', () => {
    const { result, view } = setup(
      [element({ type: 'image', payload: { asset: { assetId: 'a', mimeType: 'image/png' } } })],
      [0],
    )
    const input = view().container.querySelector<HTMLInputElement>(
      '[data-cs-field="accessibility.altText"] input',
    )!

    act(() => void fireEvent.change(input, { target: { value: 'A bar chart' } }))

    expect(result.current.draft.slides[0]!.elements[0]!.accessibility?.altText).toBe('A bar chart')
  })
})
