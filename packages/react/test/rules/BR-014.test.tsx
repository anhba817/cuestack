import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { lessonOf, mediaElement, element, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import type { Transport } from '@cuestack/core'

/**
 * BR-014 / FR-PLY-007: video and audio autoplay with sound requires a user gesture.
 *
 * One latch per lesson, not per element and not per slide (research R-08). The requirement
 * says "an initial user action"; per-element would ask on every slide with sound, which is
 * the behaviour learners already resent from the browsers that do it. Browsers grant
 * autoplay permission at document scope anyway, so a second prompt asks for something
 * already granted.
 */

async function mount(lesson: ReturnType<typeof lessonOf>, autoPlay = true) {
  const ports = testPorts()
  let transport: Transport | null = null
  const container = await client(
    h(LessonPlayer, {
      lesson,
      ports,
      autoPlay,
      onReady: (t: Transport) => {
        transport = t
      },
    }),
  )
  const start = () =>
    [...container.querySelectorAll('button')].find((b) => /start/i.test(b.textContent ?? ''))
  return { container, ports, start, transport: () => transport! }
}

const audible = () => lessonOf([slide([mediaElement({ id: 'v' })], { durationMs: 8000 })])
const silent = () =>
  lessonOf([slide([mediaElement({ id: 'v', payload: { volume: 0 } })], { durationMs: 8000 })])
const noMedia = () => lessonOf([slide([element({ id: 'text', effects: [] })], { durationMs: 8000 })])

describe('BR-014', () => {
  it('does not begin playback for a lesson with audible media', async () => {
    const { transport } = await mount(audible())
    expect(transport().state).not.toBe('playing')
  })

  it('tells the learner how to start it', async () => {
    // A lesson that silently refuses to play is indistinguishable from a broken one.
    const { container, start } = await mount(audible())
    expect(start()).toBeDefined()
    expect(container.textContent).toMatch(/start/i)
  })

  it('begins playback once the learner acts', async () => {
    const { start, transport } = await mount(audible())
    await act(async () => {
      start()!.click()
    })
    expect(transport().state).toBe('playing')
  })

  it('does not ask again for the rest of the lesson (FR-015)', async () => {
    const { start, transport } = await mount(audible())
    await act(async () => {
      start()!.click()
    })
    await act(async () => {
      transport().goToSlide(0)
    })
    expect(start()).toBeUndefined()
  })

  it('does not ask for a lesson whose media is muted', async () => {
    // `volume: 0` is an authored intent to be silent. Blocking it would stop lessons that
    // need no permission at all.
    const { start, transport } = await mount(silent())
    expect(start()).toBeUndefined()
    expect(transport().state).toBe('playing')
  })

  it('does not ask for a lesson with no media', async () => {
    const { start, transport } = await mount(noMedia())
    expect(start()).toBeUndefined()
    expect(transport().state).toBe('playing')
  })

  it('does not ask when the learner did not request autoplay', async () => {
    // Pressing play is itself a gesture. A player that waits to be started needs no prompt.
    const { start } = await mount(audible(), false)
    expect(start()).toBeUndefined()
  })
})
