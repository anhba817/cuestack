import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePorts, renderEditor } from '../harness/editor.js'
import { element, hidden, lessonWith, notYet } from '../harness/corpus.js'
import { timelineLesson } from '../harness/timeline.js'
import { multiSlideLesson as previewLesson } from '../harness/preview.js'

/**
 * T104 — SC-007, FR-044: editor state never reaches the manifest.
 *
 * The line this measures is the feature's central invariant. `draft` is authored data and the
 * single source of truth; selection, hover, authoring time, text-edit mode, and the clipboard
 * are things the teacher is currently doing and nothing a learner ever receives.
 *
 * Checked by byte comparison rather than by inspecting fields, because the failure mode is a
 * field nobody thought to look for.
 */
function setup() {
  const { handle, container } = renderEditor(
    lessonWith([element(), element({ x: 700 }), notYet(), hidden()]),
  )
  return { s: handle, container }
}

describe('a session of pure navigation leaves the manifest byte-identical', () => {
  it('after selecting, traversing, scrubbing, and copying', () => {
    const { s, container } = setup()
    const before = JSON.stringify(s.session.draft)
    const ids = s.session.draft.slides[0]!.elements.map((e) => e.id)

    act(() => s.session.select([ids[0]!]))
    act(() => s.session.select([ids[0]!, ids[1]!]))
    act(() => s.session.setAuthoringTime(4321))
    act(() => s.session.copy(ids))
    act(() => s.session.select([]))
    act(() =>
      void fireEvent.keyDown(container.querySelector('[data-cs-overlay]')!, { key: 'Tab' }),
    )

    expect(JSON.stringify(s.session.draft)).toBe(before)
  })

  it('holds none of the session’s vocabulary in the serialized lesson', () => {
    const { s } = setup()
    act(() => s.session.select(s.session.draft.slides[0]!.elements.map((e) => e.id)))
    act(() => s.session.setAuthoringTime(1234))

    const serialized = JSON.stringify(s.session.draft)
    for (const leak of ['selection', 'authoringTime', 'clipboard', 'textEditing', 'hover', '1234']) {
      expect(serialized).not.toContain(leak)
    }
  })

  it('keeps the authoring time out even after it has been moved and read back', () => {
    const { s } = setup()
    act(() => s.session.setAuthoringTime(2500))
    expect(s.session.authoringTime).toBe(2500)
    expect(JSON.stringify(s.session.draft)).not.toContain('2500')
  })

  it('keeps the clipboard out, even holding a copy of a real element', () => {
    const { s } = setup()
    const before = JSON.stringify(s.session.draft)
    act(() => s.session.copy([s.session.draft.slides[0]!.elements[0]!.id]))

    expect(s.session.clipboard).toHaveLength(1)
    expect(JSON.stringify(s.session.draft)).toBe(before)
  })

  it('changes the manifest only when an edit is applied', () => {
    const { s } = setup()
    const before = JSON.stringify(s.session.draft)

    act(() => s.session.select([s.session.draft.slides[0]!.elements[0]!.id]))
    expect(JSON.stringify(s.session.draft)).toBe(before)

    // And the control: an actual edit does change it, so the comparison above is not vacuous.
    act(() => void s.session.apply({ kind: 'add-element', type: 'text' }))
    expect(JSON.stringify(s.session.draft)).not.toBe(before)
  })
})

describe('feature 006 adds four more values that must not reach a manifest (SC-014)', () => {
  /**
   * Time scale, scroll position, which view is open, and the authoring time. Feature 005
   * established the invariant; this feature is not the one that breaks it.
   */
  const open = () =>
    renderEditor(timelineLesson([element({ startMs: 0, endMs: 4000 })]), {
      timeline: true,
      sequence: true,
      ports: fakePorts(),
    })

  it('leaves the manifest byte-identical after a session of pure navigation', () => {
    const { handle, container } = open()
    const before = JSON.stringify(handle.session.draft)

    act(() => void fireEvent.change(container.querySelector('.cs-playhead')!, { target: { value: '2500' } }))
    act(() => void fireEvent.change(container.querySelector('.cs-timeline-scale input')!, { target: { value: '300' } }))
    act(() => handle.playback.play())
    act(() => handle.playback.pause())

    expect(JSON.stringify(handle.session.draft)).toBe(before)
  })

  it('writes no time scale, scroll, open view, or transport state', () => {
    const { handle, container } = open()
    act(() => void fireEvent.change(container.querySelector('.cs-timeline-scale input')!, { target: { value: '300' } }))

    const serialized = JSON.stringify(handle.session.draft)
    for (const leak of ['pxPerSecond', 'scroll', 'openView', 'transport', 'authoringTime', 'playing']) {
      expect(serialized, leak).not.toContain(leak)
    }
  })

  it('writes nothing sequence-specific when a sequence is applied (SC-008)', () => {
    // The mode's whole claim: relationships are derived, so applying one changes timing and
    // nothing else. If anything else appeared, Simple Sequence would have grown storage —
    // which Constitution III forbids outright.
    const { handle, container } = renderEditor(
      timelineLesson([element({ startMs: 0, endMs: 1000 }), element({ startMs: 5000, endMs: 6000 })]),
      { sequence: true },
    )
    const before = JSON.parse(JSON.stringify(handle.session.draft)) as unknown

    act(() =>
      void fireEvent.change(container.querySelector('.cs-sequence select')!, {
        target: { value: 'after-previous' },
      }),
    )

    const strip = (m: unknown) =>
      JSON.stringify(m, (key, value) => (key === 'startMs' || key === 'endMs' ? undefined : value))
    expect(strip(handle.session.draft)).toBe(strip(before))
    for (const leak of ['relationship', 'sequence', 'withPrevious', 'afterPrevious', 'custom']) {
      expect(JSON.stringify(handle.session.draft), leak).not.toContain(leak)
    }
  })
})

/**
 * Preview state (feature 007).
 *
 * Four more values join this invariant: where a preview started, whether the override was on,
 * which viewport preset was chosen, and whether a preview was open at all. Features 005 and
 * 006 each added values here; this one must not be the feature that breaks it.
 *
 * The values are held by `usePreviewSession`, which dies with the preview — so the assertion
 * is that they never reach the *session* in the first place, rather than that they are
 * cleaned up afterwards. Those are different guarantees and only one of them survives a crash.
 */
describe('nothing about a preview reaches the manifest', () => {
  const preview = (container: HTMLElement): HTMLElement =>
    container.querySelector('.cs-preview') as HTMLElement

  it('leaves the draft byte-identical through a whole preview session', async () => {
    const lesson = previewLesson()
    const before = JSON.stringify(lesson)
    const { handle, container } = renderEditor(lesson, { preview: 'position', timeline: true })

    // Everything a teacher can do to a preview, in one go.
    act(() => void fireEvent.click(preview(container).querySelector('[data-cs-preview-override]')!))
    act(() =>
      void fireEvent.click(
        preview(container).querySelector('input[name="cs-preview-preset"][value="mobile"]')!,
      ),
    )
    act(() => void fireEvent.click(preview(container).querySelector('[data-cs-preview-restart]')!))
    // Restart remounts the player, so its transport is null until the mount effect runs and
    // `PreviewControls` renders nothing in between — one commit, one frame in a browser. The
    // await is what lets that effect run; a synchronous `act` does not reach it. Settling here
    // rather than reordering the actions, because the order is what a teacher would do.
    await act(async () => undefined)
    act(() => void fireEvent.click(preview(container).querySelector('[data-cs-preview-next]')!))
    act(() => void fireEvent.click(preview(container).querySelector('[data-cs-preview-close]')!))

    expect(JSON.stringify(handle.session.draft)).toBe(before)
  })

  it('names none of the preview’s own vocabulary anywhere in the manifest', () => {
    const { handle, container } = renderEditor(previewLesson(), { preview: 'beginning' })
    act(() => void fireEvent.click(preview(container).querySelector('[data-cs-preview-override]')!))
    const serialised = JSON.stringify(handle.session.draft)
    for (const leak of ['preview', 'override', 'preset', 'startPoint', 'viewport', 'generation']) {
      expect(serialised, leak).not.toContain(leak)
    }
  })
})
