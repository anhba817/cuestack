import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderEditor, runFrames } from '../harness/editor.js'
import { oneSlideLesson } from '../harness/preview.js'

/**
 * The ending, which is the part of a lesson a teacher can least otherwise check.
 *
 * What a lesson says after its final slide is a thing teachers get wrong and have no other
 * way to see. The completion state itself is the *player's* — rendering one here would be a
 * second implementation of the thing Constitution V forbids two of. What the preview owes at
 * that moment is that its own frame is still reachable.
 */

afterEach(cleanup)

const preview = (container: HTMLElement): HTMLElement =>
  container.querySelector('.cs-preview') as HTMLElement

async function playToTheEnd(): Promise<{ container: HTMLElement; ports: { advance(ms: number): void } }> {
  const { handle, container } = renderEditor(oneSlideLesson(), { preview: 'beginning' })
  await runFrames(handle.previewPorts, 5000)
  return { container, ports: handle.previewPorts }
}

describe('reaching the end', () => {
  it('shows the lesson’s own completion state', async () => {
    const { container } = await playToTheEnd()
    expect(preview(container).querySelector('.cs-complete')).not.toBeNull()
  })

  it('stays open until the teacher closes it', async () => {
    // Closing on the teacher's behalf would make the ending the one part of a lesson a
    // preview refuses to show.
    const { container } = await playToTheEnd()
    expect(preview(container)).not.toBeNull()
    expect((preview(container) as HTMLDialogElement).open).toBe(true)
  })
})

describe('the frame survives the completion state', () => {
  it('keeps close reachable there', async () => {
    // The player replaces `children` at this moment, so a close button passed as `children`
    // would be gone at exactly the point a teacher needs it — leaving one control, Review,
    // which replays the lesson.
    const { container } = await playToTheEnd()
    expect(preview(container).querySelector('[data-cs-preview-close]')).not.toBeNull()
  })

  it('keeps restart reachable there, and it replays from the preview’s start', async () => {
    // The assertion that catches a restart placed in `children`: it would be absent at
    // exactly the moment this exercises it — the same defect close nearly shipped with, one
    // control later.
    const { container, ports } = await playToTheEnd()
    const restart = preview(container).querySelector('[data-cs-preview-restart]') as HTMLElement
    expect(restart).not.toBeNull()

    act(() => restart.click())
    await runFrames(ports, 100)
    expect(preview(container).querySelector('.cs-complete')).toBeNull()
    expect(preview(container).querySelector('.cs-stage')).not.toBeNull()
  })

  it('keeps the override switch reachable there', async () => {
    const { container } = await playToTheEnd()
    expect(preview(container).querySelector('[data-cs-preview-override]')).not.toBeNull()
  })
})
