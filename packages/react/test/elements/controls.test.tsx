import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer, PlaybackControls } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import { rules, stylesheet } from '../harness/css.js'

/**
 * FR-020 — play, pause, and seek — with the accessibility obligations of any control.
 *
 * The controls live inside the player, not beside it, because they need the transport and
 * the transport must stay singular. A host wanting its own passes `controls: 'none'` and
 * calls `usePlayer()`; what must not happen is two objects holding two ideas of the time.
 */
describe('playback controls', () => {
  const lesson = lessonOf([
    slide([element({ id: 'a', startMs: 0, endMs: 8000, effects: [] })], { durationMs: 8000 }),
  ])

  const mount = async () => {
    const ports = testPorts()
    const container = await client(
      h(LessonPlayer, { lesson, ports }, h(PlaybackControls, null)),
    )
    return { container, ports }
  }

  it('renders a labelled group of real controls', async () => {
    const { container } = await mount()
    const group = container.querySelector('[role="group"]')
    expect(group?.getAttribute('aria-label')).toBe('Playback')
    expect(container.querySelectorAll('button').length).toBeGreaterThanOrEqual(3)
    expect(container.querySelector('input[type="range"]')).not.toBeNull()
  })

  it('names every control for assistive technology', async () => {
    const { container } = await mount()
    const controls = [...container.querySelectorAll('button, input')]
    const unnamed = controls.filter((el) => !el.getAttribute('aria-label')?.trim())
    expect(unnamed.map((el) => el.outerHTML.slice(0, 60))).toEqual([])
  })

  it('does not pause playback merely by being rendered', async () => {
    // The initialiser trap: `transport.pause()` is the obvious way to obtain a snapshot and
    // it stops the lesson. The controls read the transport instead of calling it.
    const ports = testPorts()
    const container = await client(
      h(LessonPlayer, { lesson, ports, autoPlay: true }, h(PlaybackControls, null)),
    )
    const toggle = container.querySelector('button')!
    expect(toggle.getAttribute('aria-label')).toBe('Pause')
  })

  it('toggles between play and pause, saying what pressing it will do', async () => {
    const { container } = await mount()
    const toggle = container.querySelector('button')!
    expect(toggle.getAttribute('aria-label')).toBe('Play')
    await act(async () => {
      toggle.click()
    })
    // The name describes the action, not the state: a learner needs to know what the button
    // accomplishes, and "Playing" would be a status message on a control.
    expect(toggle.getAttribute('aria-label')).toBe('Pause')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
  })

  it('seeks in whole seconds, so an arrow key moves visibly', async () => {
    // A step of 1ms leaves the slider focusable and useless — present, operable in theory,
    // and incapable of moving anywhere a learner can perceive.
    const { container } = await mount()
    const seek = container.querySelector('input[type="range"]') as HTMLInputElement
    expect(Number(seek.step)).toBeGreaterThanOrEqual(1000)
    expect(Number(seek.max)).toBe(8000)
  })

  it('announces the seek position in seconds rather than milliseconds', async () => {
    const { container } = await mount()
    const seek = container.querySelector('input[type="range"]')!
    // "4000" read aloud is meaningless. `aria-valuetext` is the only way to fix that.
    expect(seek.getAttribute('aria-valuetext')).toMatch(/\d+ of \d+ seconds/)
  })

  it('follows the transport rather than keeping its own time', async () => {
    // Driven by seeking, not by advancing the clock. A clock advance alone moves nothing:
    // the transport only samples time when a frame asks it to, which is what makes a
    // blocked thread and a slept tab indistinguishable — the design feature that the 250 ms
    // delta clamp exists for. This asserts the controls follow the transport, so the
    // transport is told to move.
    const { container } = await mount()
    const seek = container.querySelector('input[type="range"]') as HTMLInputElement
    expect(Number(seek.value)).toBe(0)
    const forward = container.querySelectorAll('button')[2]!
    await act(async () => {
      forward.click()
    })
    expect(Number(seek.value)).toBe(5000)
    expect(container.querySelector('.cs-controls-time')?.textContent).toContain('5s')
  })
})

describe('the controls stylesheet', () => {
  it('is scoped, like the rest', () => {
    const offenders = rules(stylesheet('../player/controls/controls.css'))
      .flatMap((r) => r.selectors)
      .filter((s) => !/\.cs-/.test(s))
    expect(offenders).toEqual([])
  })

  it('gives targets a floor of at least 24px, and never scales them away', () => {
    // WCAG 2.2 2.5.8. Chrome, not content: a control sized in container units would shrink
    // with a small stage, becoming unusable exactly where a large target matters most.
    const css = stylesheet('../player/controls/controls.css')
    expect(css).not.toContain('cqw')
    expect(css).not.toContain('cqh')
    for (const match of css.matchAll(/min-(?:width|height):\s*(\d+)px/g)) {
      expect(Number(match[1])).toBeGreaterThanOrEqual(24)
    }
    expect(css).toMatch(/min-height:\s*44px/)
  })

  it('never suppresses the focus outline', () => {
    const css = stylesheet('../player/controls/controls.css')
    expect(css).toMatch(/:focus-visible/)
    expect(css).not.toMatch(/outline:\s*(?:none|0)\b/)
  })
})
