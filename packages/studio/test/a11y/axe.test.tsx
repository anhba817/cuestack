import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import axe from 'axe-core'
import { renderEditor } from '../harness/editor.js'
import { element, hidden, lessonWith, notYet, oneOfEachType } from '../harness/corpus.js'

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
