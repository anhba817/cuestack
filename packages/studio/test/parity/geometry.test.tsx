import { render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LessonPlayerStatic } from '@cuestack/react'
import type { LessonManifest } from '@cuestack/schema'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { lessonWith, oneOfEachType } from '../harness/corpus.js'

/**
 * T038 — SC-003, FR-042: what the teacher arranges is where the learner sees it.
 *
 * The comparison is between the *player's* render and the *editor's*, of the same manifest at
 * the same time. It is only meaningful because both go through one renderer: the editing
 * canvas mounts `Stage` and `SlideView` from `@cuestack/react` with the props the player
 * passes, and the overlay sits beside them rather than inside.
 *
 * If this suite ever needs a special case for a type, the render layer has forked and that is
 * a severity-2 defect under Constitution V — not a test to adjust.
 */

/** Every element's identity and geometry, in paint order, from a rendered tree. */
function geometryOf(root: HTMLElement): Array<Record<string, string>> {
  return [...root.querySelectorAll('.cs-element')].map((node) => {
    const el = node as HTMLElement
    return {
      id: el.getAttribute('data-cs-element-id') ?? '',
      type: el.getAttribute('data-cs-element-type') ?? '',
      x: el.style.getPropertyValue('--cs-x'),
      y: el.style.getPropertyValue('--cs-y'),
      width: el.style.getPropertyValue('--cs-w'),
      height: el.style.getPropertyValue('--cs-h'),
      rotation: el.style.getPropertyValue('--cs-rotation'),
      z: el.style.getPropertyValue('--cs-z'),
    }
  })
}

function editorGeometry(lesson: LessonManifest, timeMs = 0): Array<Record<string, string>> {
  const { result } = renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource: countingIds() }),
  )
  if (timeMs > 0) result.current.setAuthoringTime(timeMs)
  const { container, unmount } = render(<EditorCanvas session={result.current} />)
  const geometry = geometryOf(container)
  unmount()
  return geometry
}

function playerGeometry(lesson: LessonManifest): Array<Record<string, string>> {
  const { container, unmount } = render(<LessonPlayerStatic lesson={lesson} />)
  const geometry = geometryOf(container)
  unmount()
  return geometry
}

describe('editor and player agree about geometry', () => {
  it('for every one of the seven MVP element types at once', () => {
    const lesson = lessonWith(oneOfEachType())
    expect(editorGeometry(lesson)).toEqual(playerGeometry(lesson))
  })

  it.each(oneOfEachType().map((e) => [e.type, e] as const))(
    'for a %s on its own',
    (_type, el) => {
      const lesson = lessonWith([el])
      expect(editorGeometry(lesson)).toEqual(playerGeometry(lesson))
    },
  )

  it('including rotation, which the editor writes and the player reads', () => {
    const [text] = oneOfEachType()
    const lesson = lessonWith([{ ...text!, rotation: 37 }])
    const editor = editorGeometry(lesson)
    expect(editor).toEqual(playerGeometry(lesson))
    expect(editor[0]!.rotation).toBe('37')
  })

  it('including paint order, which the kernel resolves once and neither re-sorts', () => {
    const [a, b, c] = oneOfEachType()
    const lesson = lessonWith([
      { ...a!, zIndex: 5 },
      { ...b!, zIndex: 1 },
      { ...c!, zIndex: 3 },
    ])
    const editor = editorGeometry(lesson)
    expect(editor.map((g) => g.z)).toEqual(['1', '3', '5'])
    expect(editor).toEqual(playerGeometry(lesson))
  })

  it('for geometry outside the canvas, which both render identically', () => {
    const [text] = oneOfEachType()
    const lesson = lessonWith([{ ...text!, x: -400, y: -200 }])
    expect(editorGeometry(lesson)).toEqual(playerGeometry(lesson))
  })
})
