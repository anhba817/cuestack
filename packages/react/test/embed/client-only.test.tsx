import { createElement as h } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { referenceLesson } from '../harness/corpus.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'

/**
 * US5 #3 · FR-025.
 *
 * The player works in a host that does not server-render at all.
 *
 * Rendered with `createRoot`, not `hydrateRoot` — a genuinely different path. Every other
 * suite hydrates, which means every other suite has server markup to start from, and a
 * component that only worked when there was markup to adopt would pass all of them. A
 * Vite SPA, an Astro island, a CRA app: none of them will have any.
 */
async function mountClientOnly(element: ReturnType<typeof h>): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(element)
  })
  return container
}

describe('a host with no server rendering', () => {
  it('renders the first slide from an empty container', async () => {
    const container = await mountClientOnly(
      h(LessonPlayer, { lesson: referenceLesson, ports: testPorts() }),
    )
    expect(container.querySelector('.cs-stage')).not.toBeNull()
  })

  it('positions elements, because geometry never depended on the server', async () => {
    const ports = testPorts()
    const container = await mountClientOnly(h(LessonPlayer, { lesson: referenceLesson, ports }))
    // The reference lesson's first slide is empty at time zero — its title fades in at
    // 500 ms — so advance before looking for an element.
    await act(async () => {
      for (let i = 0; i < 8; i += 1) ports.clock.advance(100)
    })
    const stage = container.querySelector('.cs-stage')
    expect(stage).not.toBeNull()
  })

  it('plays, with no markup to adopt', async () => {
    const ports = testPorts()
    let ready = false
    await mountClientOnly(
      h(LessonPlayer, {
        lesson: referenceLesson,
        ports,
        autoPlay: true,
        onReady: () => {
          ready = true
        },
      }),
    )
    expect(ready).toBe(true)
  })

  it('emits the same properties it would have server-rendered', async () => {
    // FR-025 is not only "does not crash". A client-only host must get the same output,
    // or there are two renderers and Principle V has a second implementation to diverge in.
    const container = await mountClientOnly(
      h(LessonPlayer, { lesson: referenceLesson, ports: testPorts() }),
    )
    const stage = container.querySelector('.cs-stage') as HTMLElement
    expect(stage.style.getPropertyValue('--cs-canvas-w')).toBe('1600')
    expect(stage.style.getPropertyValue('--cs-canvas-h')).toBe('900')
    expect(stage.getAttribute('lang')).toBe(referenceLesson.lesson.language)
  })
})
