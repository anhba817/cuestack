import { act, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LessonPlayerStatic } from '@cuestack/react'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith, withMarkup } from '../harness/corpus.js'

/**
 * T037 — FR-046, NFR-SEC-007.
 *
 * A lock rather than a sanitizer, and this suite is what keeps the lock honest. The property
 * already holds by construction: every renderer passes text as a React child, which escapes
 * it, and `dangerouslySetInnerHTML` appears nowhere in the workspace (verified in research
 * R-11 and now banned by lint). What this feature adds is a new *source* of author-supplied
 * strings — a teacher typing on the canvas — not a new way of rendering them.
 *
 * SSR sharpens the stake: server-rendered markup ships inside the HTML document, so it runs
 * before any client-side guard could. There is no second chance on that path.
 */
const PAYLOAD = '<img src=x onerror="alert(1)">bold</img>'

function session(elements = [withMarkup()]) {
  const lesson = lessonWith(elements)
  return renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource: countingIds() }),
  )
}

describe('text carrying markup stays text', () => {
  it('renders as characters on the editing canvas, not as elements', () => {
    const { result } = session()
    const { container } = render(<EditorCanvas session={result.current} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain(PAYLOAD)
  })

  it('renders as characters on the player path too', () => {
    const lesson = lessonWith([withMarkup()])
    const { container } = render(<LessonPlayerStatic lesson={lesson} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain(PAYLOAD)
  })

  it('stays text after a teacher types it through the canvas text surface', () => {
    const { result } = session([element({ payload: { text: 'safe' } })])
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => void result.current.apply({ kind: 'set-text', id, text: PAYLOAD }))
    const { container } = render(<EditorCanvas session={result.current} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain(PAYLOAD)
  })

  it('stays text after a teacher types it through an inspector field', () => {
    const { result } = session([element({ payload: { text: 'safe' } })])
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => void result.current.apply({ kind: 'set-field', id, path: ['payload', 'text'], value: PAYLOAD }))
    const { container } = render(<EditorCanvas session={result.current} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain(PAYLOAD)
  })

  it('carries markup through a ghost’s label without executing it', () => {
    const { result } = session([element({ hidden: true, payload: { text: PAYLOAD } })])
    const { container } = render(<EditorCanvas session={result.current} />)

    expect(container.querySelector('[data-cs-ghost]')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('puts the markup in the manifest verbatim — the format stores text, not escaped text', () => {
    const { result } = session([element({ payload: { text: 'safe' } })])
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => void result.current.apply({ kind: 'set-text', id, text: PAYLOAD }))

    // Escaping at write time would be the wrong fix: it corrupts the author's content and
    // double-escapes on the next edit. Escaping belongs at render, where React does it.
    expect((result.current.draft.slides[0]!.elements[0]!.payload as { text: string }).text).toBe(
      PAYLOAD,
    )
  })
})
