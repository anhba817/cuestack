import { act, render, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { LessonPlayerStatic } from '@cuestack/react'
import { validate } from '@cuestack/schema/validate'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { emptySlide } from '../harness/corpus.js'

/**
 * US1's Independent Test, kept as a suite member rather than run once by hand.
 *
 * "Start from an empty slide and compose one" is the story's whole claim, and it is the first
 * point in this project's history where a lesson can be *authored* rather than hand-written
 * as TypeScript or a JSON fixture. It ends by rendering the result through the learner
 * player, because composing something the player cannot load would not be composing a lesson.
 */
it('composes a slide from empty, and the player renders what was authored', () => {
  const lesson = emptySlide()
  const idSource = countingIds()
  const { result } = renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource }),
  )
  act(() => void result.current.apply({ kind: 'add-element', type: 'text' }))
  act(() => void result.current.apply({ kind: 'add-element', type: 'shape' }))
  act(() => void result.current.apply({ kind: 'add-element', type: 'image' }))
  const ids = result.current.draft.slides[0]!.elements.map((e) => e.id)

  act(() => void result.current.apply({ kind: 'set-text', id: ids[0]!, text: 'Composed in the editor' }))
  act(() => void result.current.apply({ kind: 'transform-elements', ids: [ids[1]!], geometry: { x: 700, y: 300 } }))
  act(() => void result.current.apply({ kind: 'transform-elements', ids: [ids[2]!], geometry: { rotation: 15 } }))

  const draft = result.current.draft
  expect(validate(draft).ok).toBe(true)
  expect(draft.slides[0]!.elements).toHaveLength(3)

  const { container } = render(<LessonPlayerStatic lesson={draft} />)
  expect(container.textContent).toContain('Composed in the editor')
  expect((container.querySelector(`[data-cs-element-id="${ids[1]}"]`) as HTMLElement).style.getPropertyValue('--cs-x')).toBe('700')
  expect((container.querySelector(`[data-cs-element-id="${ids[2]}"]`) as HTMLElement).style.getPropertyValue('--cs-rotation')).toBe('15')
})
