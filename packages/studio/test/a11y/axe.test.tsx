import { act, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import axe from 'axe-core'
import { renderEditor } from '../harness/editor.js'
import { element, hidden, lessonWith, notYet, oneOfEachType } from '../harness/corpus.js'
import { fakePorts } from '../harness/editor.js'
import { timelineLesson } from '../harness/timeline.js'
import { gatedLesson, multiSlideLesson, oneSlideLesson, unreachableLesson } from '../harness/preview.js'
import { runFrames } from '../harness/editor.js'

/**
 * T105 — SC-006, Constitution III.
 *
 * axe at WCAG 2.2 AA over the editor's states, not just its resting one. A canvas with nothing
 * selected is the easy case; the states worth checking are the ones an affordance appears in.
 *
 * **What this does not prove.** Automated checking catches roughly half of real accessibility
 * defects, and the half it catches is the half that regresses silently — a missing accessible
 * name is invisible to someone who can see the screen. It cannot tell whether a focus order
 * makes sense or whether an announcement is intelligible. Feature 004's manual sweep found the
 * player's progress bar announcing a position with no subject, and no automated check had
 * flagged it. The nine-step manual pass in quickstart.md is where that class lives.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * Unmount between tests, which this workspace does not do by default.
 *
 * RTL's auto-cleanup needs `globals: true` or an explicit hook, and this repo has neither —
 * so every rendered tree stays in `document.body` for the whole file. Harmless for a scoped
 * query; **not** harmless for axe, because React's `useId` is per-root and several mounted
 * roots eventually mint the same id, which axe correctly reports as a duplicate. That is an
 * artefact of the environment rather than a defect in the editor, and unmounting removes it
 * at the source rather than by excluding a rule.
 */
afterEach(cleanup)

async function violations(node: HTMLElement): Promise<axe.Result[]> {
  const results = await axe.run(node, { runOnly: { type: 'tag', values: TAGS } })
  return results.violations
}

const describeViolations = (found: axe.Result[]): string =>
  found.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`).join('\n')

describe('the editor has no WCAG 2.2 AA violations', () => {
  it('at rest, with every element type on the slide', async () => {
    const { container } = renderEditor(lessonWith(oneOfEachType()))
    const found = await violations(container)
    expect(describeViolations(found)).toBe('')
  })

  it('with a selection active', async () => {
    const { handle, container } = renderEditor(lessonWith(oneOfEachType()))
    act(() => handle.session.select([handle.session.draft.slides[0]!.elements[0]!.id]))
    expect(describeViolations(await violations(container))).toBe('')
  })

  it('with several elements selected', async () => {
    const { handle, container } = renderEditor(lessonWith([element(), element(), element()]))
    act(() => handle.session.select(handle.session.draft.slides[0]!.elements.map((e) => e.id)))
    expect(describeViolations(await violations(container))).toBe('')
  })

  it('with a ghost present — out of window and hidden', async () => {
    const { container } = renderEditor(lessonWith([element(), notYet(), hidden()]))
    expect(describeViolations(await violations(container))).toBe('')
  })

  it('with the text surface open', async () => {
    const { handle, container } = renderEditor(lessonWith([element()]))
    const id = handle.session.draft.slides[0]!.elements[0]!.id
    act(() => handle.session.select([id]))
    act(() => handle.session.beginTextEdit(id))
    expect(describeViolations(await violations(container))).toBe('')
  })

  it('with the delete confirmation open', async () => {
    const { handle, container } = renderEditor(lessonWith([element()]))
    act(() => handle.session.select([handle.session.draft.slides[0]!.elements[0]!.id]))
    act(() => void fireEvent.click(container.querySelector('[data-cs-delete]')!))

    expect(container.querySelector('[data-cs-confirm="delete"]')).not.toBeNull()
    expect(describeViolations(await violations(container))).toBe('')
  })

  it('in read-only mode', async () => {
    const { container } = renderEditor(lessonWith(oneOfEachType()), { mode: 'read-only' })
    expect(describeViolations(await violations(container))).toBe('')
  })

  it('on an empty slide, which is where a teacher starts', async () => {
    const { container } = renderEditor(lessonWith([]))
    expect(describeViolations(await violations(container))).toBe('')
  })
})

describe('the surfaces feature 006 adds', () => {
  /**
   * The timeline, the sequence view, and the effect controls — in the states an affordance
   * appears in, not only at rest.
   *
   * The same caveat as above applies with more force here: axe cannot check a focus
   * indicator, cannot judge whether "at 2.40s" is intelligible next to a relationship, and
   * cannot tell whether tabbing through fifty-five tracks to reach the transport is
   * reasonable. `keyboard/focus.test.tsx` covers the first; the manual pass covers the rest.
   */
  const full = () =>
    timelineLesson([
      element({
        startMs: 0,
        endMs: 4000,
        effects: [{ id: 'fx-1', type: 'fade', phase: 'enter', startMs: 0, durationMs: 400, order: 0 }],
      }),
      element({ startMs: 2000, endMs: 6000 }),
    ])

  it('reports nothing on the timeline', async () => {
    const { container } = renderEditor(full(), { timeline: true, ports: fakePorts() })
    expect(await violations(container)).toEqual([])
  })

  it('reports nothing on the sequence view', async () => {
    const { container } = renderEditor(full(), { sequence: true })
    expect(await violations(container)).toEqual([])
  })

  it('reports nothing on the effect controls, with an effect present', async () => {
    const { handle, container } = renderEditor(full(), { inspector: true })
    act(() => handle.session.select([handle.session.draft.slides[0]!.elements[0]!.id]))
    expect(await violations(container)).toEqual([])
  })

  it('reports nothing with the Custom confirmation open', async () => {
    /**
     * Two overlapping elements and nothing else, so exactly one row is Custom.
     *
     * `full()` will not do: its second element starts 1 600 ms after the fade ends, which
     * classifies as a *delay* and applies without asking. That fixture passed this assertion
     * before `afterEach(cleanup)` was added — the dialog it found belonged to a previous
     * test's tree. Cleanup is what made the suite honest about it.
     */
    const { container } = renderEditor(
      timelineLesson([element({ startMs: 0, endMs: 4000 }), element({ startMs: 2000, endMs: 6000 })]),
      { sequence: true },
    )
    act(() =>
      void fireEvent.change(container.querySelector('.cs-sequence select')!, {
        target: { value: 'after-previous' },
      }),
    )
    expect(container.querySelector('[role="alertdialog"]')).toBeTruthy()
    expect(
      (await violations(container)).map((v) => `${v.id} | ${v.nodes[0]?.html?.slice(0, 120)}`),
    ).toEqual([])
  })

  it('reports nothing with an overrun panel showing', async () => {
    const { container } = renderEditor(
      timelineLesson([element({ startMs: 0, endMs: 12_000 })]),
      { timeline: true, ports: fakePorts() },
    )
    expect(container.querySelector('.cs-timeline-problems')).toBeTruthy()
    expect(await violations(container)).toEqual([])
  })

  it('reports nothing while playing', async () => {
    const ports = fakePorts()
    const { handle, container } = renderEditor(full(), { timeline: true, ports })
    act(() => handle.playback.play())
    expect(await violations(container)).toEqual([])
  })
})

/**
 * The preview, in each of the states it has (feature 007).
 *
 * The resting state is the easy one; the states worth checking are the ones an affordance
 * only appears in — the override indicator, the reachability report, the completion state.
 *
 * **One assertion here is deliberately not axe's.** The dialog's own accessible name is
 * checked directly, because `aria-dialog-name` is tagged `best-practice` and the tag list
 * above runs only the WCAG tags. An unnamed modal passes every rule that runs and is
 * announced to a screen-reader user as "dialog" and nothing else. Widening the tag set for
 * one rule would be the wrong fix — the list is deliberate.
 */
describe('the preview has no WCAG 2.2 AA violations', () => {
  const preview = (container: HTMLElement): HTMLElement =>
    container.querySelector('.cs-preview') as HTMLElement

  it('at rest, with its controls', async () => {
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const found = await violations(preview(container))
    expect(describeViolations(found)).toBe('')
  })

  it('with the override on and its indicator showing', async () => {
    const { container } = renderEditor(gatedLesson(), { preview: 'beginning' })
    const toggle = preview(container).querySelector('[data-cs-preview-override]') as HTMLElement
    act(() => void fireEvent.click(toggle))
    expect(preview(container).querySelector('[data-cs-override-on]')).not.toBeNull()
    const found = await violations(preview(container))
    expect(describeViolations(found)).toBe('')
  })

  it('with a reachability problem reported', async () => {
    const { container } = renderEditor(unreachableLesson(), { preview: 'beginning' })
    expect(preview(container).querySelector('[data-cs-preview-unreachable]')).not.toBeNull()
    const found = await violations(preview(container))
    expect(describeViolations(found)).toBe('')
  })

  it('at the completion state', async () => {
    const { handle, container } = renderEditor(oneSlideLesson(), { preview: 'beginning' })
    await runFrames(handle.previewPorts, 5000)
    expect(preview(container).querySelector('.cs-complete')).not.toBeNull()
    const found = await violations(preview(container))
    expect(describeViolations(found)).toBe('')
  })

  it('names the dialog itself, which axe will not ask for', async () => {
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    expect(preview(container).getAttribute('aria-label')).toBeTruthy()
  })
})
