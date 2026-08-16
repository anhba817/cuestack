import { act, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith, locked } from '../harness/corpus.js'

/**
 * BR-011 — locked elements render normally but are not transformable until unlocked.
 *
 * **The editor half.** The kernel's half is covered in `packages/core/test/rules/BR-011.test.ts`
 * and amounts to "locking changes nothing about rendering". The half that needed an editor is
 * everything else: that a locked element is still *selectable*, that transforms refuse, that
 * text edits refuse too — and the trap, that it can still be unlocked.
 *
 * That last one is the case worth naming. The locked guard sits in the reducer frame and would
 * naturally apply to every edit; applied to `set-flag` it would make locking irreversible, and
 * a teacher who locked something would have lost it.
 */
function session(elements = [locked()]) {
  const lesson = lessonWith(elements)
  const idSource = countingIds()
  return renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource }),
  )
}

describe('BR-011: a locked element renders, resists transforms, and can be unlocked', () => {
  it('renders exactly as an unlocked one does', () => {
    const { result } = session()
    const { container } = render(<EditorCanvas session={result.current} />)
    const node = container.querySelector('.cs-element')!

    expect(node).not.toBeNull()
    // Locking is authoring state. Nothing about it reaches the rendered element.
    expect(node.getAttribute('data-cs-locked')).toBeNull()
  })

  it('is selectable', () => {
    const { result } = session()
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => result.current.select([id]))
    expect(result.current.selection).toEqual([id])
  })

  it('refuses a transform', () => {
    const { result } = session()
    const id = result.current.draft.slides[0]!.elements[0]!.id
    const before = result.current.draft.slides[0]!.elements[0]!.x

    act(() => void result.current.apply({ kind: 'transform-elements', ids: [id], geometry: { x: 999 } }))

    expect(result.current.lastRefusal?.reason).toBe('locked')
    expect(result.current.draft.slides[0]!.elements[0]!.x).toBe(before)
  })

  it('refuses a text edit — locked means not text-editable either (FR-008)', () => {
    const { result } = session()
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => void result.current.apply({ kind: 'set-text', id, text: 'changed' }))

    expect(result.current.lastRefusal?.reason).toBe('locked')
    expect((result.current.draft.slides[0]!.elements[0]!.payload as { text: string }).text).toBe(
      'content',
    )
  })

  it('CAN be unlocked — the exception that keeps locking reversible', () => {
    const { result } = session()
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => void result.current.apply({ kind: 'set-flag', ids: [id], flag: 'locked', value: false }))
    expect(result.current.draft.slides[0]!.elements[0]!.locked).toBe(false)

    // And is transformable again, which is what "until unlocked" means.
    act(() => void result.current.apply({ kind: 'transform-elements', ids: [id], geometry: { x: 500 } }))
    expect(result.current.draft.slides[0]!.elements[0]!.x).toBe(500)
  })

  it('does not veto the unlocked members of a mixed selection', () => {
    const { result } = session([element({ x: 0 }), locked(), element({ x: 0 })])
    const ids = result.current.draft.slides[0]!.elements.map((e) => e.id)

    act(() => void result.current.apply({ kind: 'transform-elements', ids, geometry: { x: 400 } }))

    expect(result.current.draft.slides[0]!.elements.map((e) => e.x)).toEqual([400, 100, 400])
  })
})
