import { act, fireEvent, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TextEditSurface } from '../../src/canvas/TextEditSurface.js'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T036 — the bound on the one declared Constitution V deviation.
 *
 * The claim being defended is narrow and worth restating: while editing, two DOM nodes carry
 * the element's text, and that is acceptable *only* because there is one styling authority —
 * the `.cs-element-text` rule in `stage.css`. If the surface ever grows its own typography,
 * the deviation stops being bounded and a teacher sees their heading reflow on commit. This
 * suite is what notices (research R-05, plan.md Complexity Tracking).
 */
function session(text = 'before') {
  const lesson = lessonWith([element({ payload: { text } })])
  return renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource: countingIds() }),
  )
}

describe('the text-edit surface', () => {
  it('carries the renderer’s class, so typography comes from the stylesheet', () => {
    const el = element({ payload: { text: 'x' } })
    const { container } = render(
      <TextEditSurface element={el} value="x" onInput={() => {}} onCommit={() => {}} />,
    )
    const surface = container.querySelector('[data-cs-text-surface]')!

    // The same rule the renderer resolves through. Not a copy of its declarations.
    expect(surface.classList.contains('cs-element-text')).toBe(true)
  })

  it('positions from the same custom properties the element does', () => {
    const el = element({ x: 250, y: 125, width: 300, height: 90, payload: { text: 'x' } })
    const { container } = render(
      <TextEditSurface element={el} value="x" onInput={() => {}} onCommit={() => {}} />,
    )
    const surface = container.querySelector<HTMLElement>('[data-cs-text-surface]')!

    expect(surface.style.getPropertyValue('--cs-x')).toBe('250')
    expect(surface.style.getPropertyValue('--cs-y')).toBe('125')
    expect(surface.style.getPropertyValue('--cs-w')).toBe('300')
    expect(surface.style.getPropertyValue('--cs-h')).toBe('90')
  })

  it('shares no component code with the renderer — it is a textarea, not a TextElement', () => {
    const el = element({ payload: { text: 'x' } })
    const { container } = render(
      <TextEditSurface element={el} value="x" onInput={() => {}} onCommit={() => {}} />,
    )
    expect(container.querySelector('textarea')).not.toBeNull()
  })

  it('has an accessible name naming what is being edited', () => {
    const el = element({ payload: { text: 'x' } })
    const { container } = render(
      <TextEditSurface element={el} value="x" onInput={() => {}} onCommit={() => {}} />,
    )
    expect(
      container.querySelector('[data-cs-text-surface]')!.getAttribute('aria-label'),
    ).toContain('Edit text')
  })

  it('commits on blur and reports the text', () => {
    let committed = false
    const el = element({ payload: { text: 'x' } })
    const { container } = render(
      <TextEditSurface element={el} value="x" onInput={() => {}} onCommit={() => (committed = true)} />,
    )
    fireEvent.blur(container.querySelector('textarea')!)
    expect(committed).toBe(true)
  })

  it('commits on Escape but not on a plain Enter, which is a line break', () => {
    let commits = 0
    const el = element({ payload: { text: 'x' } })
    const { container } = render(
      <TextEditSurface element={el} value="x" onInput={() => {}} onCommit={() => (commits += 1)} />,
    )
    const area = container.querySelector('textarea')!

    fireEvent.keyDown(area, { key: 'Enter' })
    expect(commits).toBe(0)

    fireEvent.keyDown(area, { key: 'Escape' })
    expect(commits).toBe(1)
  })

  it('stops keystrokes reaching the canvas, so typing “d” does not duplicate (FR-016)', () => {
    let sawOnCanvas = false
    const el = element({ payload: { text: 'x' } })
    const { container } = render(
      <div onKeyDown={() => (sawOnCanvas = true)}>
        <TextEditSurface element={el} value="x" onInput={() => {}} onCommit={() => {}} />
      </div>,
    )
    fireEvent.keyDown(container.querySelector('textarea')!, { key: 'd' })
    expect(sawOnCanvas).toBe(false)
  })
})

describe('committed text renders as the surface showed it', () => {
  it('resolves to the same typography class after commit', () => {
    const { result } = session('before')
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => void result.current.apply({ kind: 'set-text', id, text: 'after' }))
    const { container } = render(<EditorCanvas session={result.current} />)
    const rendered = container.querySelector('.cs-element-text')!

    expect(rendered.textContent).toBe('after')
    // Same rule, same class — which is the whole of the bound.
    expect(rendered.classList.contains('cs-element-text')).toBe(true)
  })

  it('keeps the element’s box unchanged by the edit, so nothing reflows on commit', () => {
    const { result } = session('before')
    const el = result.current.draft.slides[0]!.elements[0]!
    const box = { x: el.x, y: el.y, width: el.width, height: el.height }

    act(() => void result.current.apply({ kind: 'set-text', id: el.id, text: 'a much longer string' }))

    expect(result.current.draft.slides[0]!.elements[0]).toMatchObject(box)
  })
})
