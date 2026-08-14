import { describe, expect, it } from 'vitest'
import { act, createElement as h } from 'react'
import { client } from '../harness/render.js'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import type { Transport } from '@cuestack/core'

/**
 * plan.md Complexity Tracking row 1.
 *
 * Playback updates opacity and transform up to sixty times a second. Routing that
 * through React means a reconciliation pass per frame per element, which would put the
 * 60fps budget out of reach before Wave 3 even adds transitions. So the frame loop
 * writes custom properties directly and React renders only on visibility change.
 *
 * This test is the guard on that decision. Without it, a well-meaning refactor to
 * "just use state" would pass every other test in the suite and quietly cost the
 * budget.
 */
describe('frame cost', () => {
  let renders = 0

  function CountingText({ element: el }: { element: { payload: unknown } }) {
    renders++
    const payload = el.payload as { text?: string }
    return h('div', null, payload?.text ?? '')
  }

  const lesson = lessonOf([
    slide([
      element({
        id: 'animated',
        startMs: 0,
        endMs: 8000,
        payload: { text: 'Moving' },
        effects: [
          { id: 'fx', type: 'fade', phase: 'enter', startMs: 0, durationMs: 8000, order: 1, easing: 'linear' },
        ],
      }),
    ]),
  ])

  it('does not re-render an element for every time change', async () => {
    const { createRendererRegistry } = await import('../../src/index.js')
    const elements = createRendererRegistry([
      { type: 'text', Component: CountingText as never, label: 'Text' },
    ])
    const ports = testPorts()
    let transport: Transport | undefined
    await client(
      h(LessonPlayer, { lesson, ports, elements, onReady: (t: Transport) => { transport = t } }),
    )

    renders = 0
    // Twenty time changes, none of which alters which elements are visible.
    for (let i = 1; i <= 20; i++) {
      await act(async () => { transport!.seek(i * 100) })
    }

    // Visibility never changed, so React had no structural work to do. A handful of
    // renders is tolerable; twenty would mean the frame loop is going through React.
    expect(renders).toBeLessThan(10)
  })

  it('does re-render when visibility changes, because that is structural', async () => {
    const twoElement = lessonOf([
      slide([
        element({ id: 'a', startMs: 0, endMs: 1000, effects: [], payload: { text: 'A' } }),
        element({ id: 'b', startMs: 1000, endMs: 2000, effects: [], payload: { text: 'B' } }),
      ]),
    ])
    const { createRendererRegistry } = await import('../../src/index.js')
    const elements = createRendererRegistry([
      { type: 'text', Component: CountingText as never, label: 'Text' },
    ])
    const ports = testPorts()
    let transport: Transport | undefined
    const container = await client(
      h(LessonPlayer, { lesson: twoElement, ports, elements, onReady: (t: Transport) => { transport = t } }),
    )

    renders = 0
    await act(async () => { transport!.seek(1500) })
    expect(renders).toBeGreaterThan(0)
    expect(container.textContent).toContain('B')
  })
})
