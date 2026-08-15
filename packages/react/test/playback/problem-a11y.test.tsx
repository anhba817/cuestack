import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, mediaElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { mediaPorts, degenerate } from '../harness/media.js'
import { rules, stylesheet } from '../harness/css.js'

/**
 * FR-031: every error state is announced and keyboard-reachable.
 *
 * The learner who most needs to be told the lesson has stopped is the one with no visual cue
 * to notice it by — a slide that never moves looks exactly like a slide that is still going.
 */

async function blocked() {
  const ports = mediaPorts()
  degenerate.fails(ports.media, 'v')
  return client(
    h(LessonPlayer, {
      lesson: lessonOf([
        slide([mediaElement({ id: 'v', payload: { volume: 0 } })], {
          durationMs: 4000,
          advance: { mode: 'after_media_ends', mediaElementId: 'v' },
        }),
        slide([element({ id: 'after', endMs: 60_000, effects: [] })], { durationMs: 4000 }),
      ]),
      ports,
      autoPlay: true,
    }),
  )
}

describe('an error state', () => {
  it('is announced as an interruption, not as a status', async () => {
    // `alert` rather than `status`: the lesson has *stopped*. Question feedback reports on
    // something the learner just did and can wait for a pause; this cannot.
    const container = await blocked()
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
  })

  it('gives every control an accessible name', async () => {
    const container = await blocked()
    const buttons = [...container.querySelectorAll('.cs-problem button')]
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) expect(button.textContent?.trim()).toBeTruthy()
  })

  it('keeps every control in the tab order', async () => {
    const container = await blocked()
    for (const button of container.querySelectorAll('.cs-problem button')) {
      expect(button.getAttribute('tabindex')).not.toBe('-1')
      expect(button.hasAttribute('disabled')).toBe(false)
    }
  })

  it('states the action as well as the problem', async () => {
    // NFR-USA-004 wants three things, and the one most often dropped is what to do next.
    const container = await blocked()
    const alert = container.querySelector('[role="alert"]')!
    expect(alert.querySelector('.cs-problem-message')?.textContent?.trim()).toBeTruthy()
    expect(alert.querySelector('.cs-problem-action')?.textContent?.trim()).toBeTruthy()
  })

  it('leaves the slide rendered behind it', async () => {
    // The learner should still see what they are stuck on.
    const container = await blocked()
    expect(container.querySelector('.cs-stage')).not.toBeNull()
  })

  it('sizes its controls as chrome rather than as stage content', () => {
    /*
     * The same WCAG 2.2 2.5.8 floor the playback controls take, and for a sharper reason:
     * these two buttons are the only thing standing between a learner and a lesson that has
     * stopped. A control sized in container units would be smallest on the smallest stage,
     * which is where it matters most.
     */
    const css = stylesheet()
    const problem = rules(css).filter((r) =>
      r.selectors.some((s) => s.startsWith('.cs-problem')),
    )
    expect(problem.length).toBeGreaterThan(0)
    for (const rule of problem) {
      for (const value of Object.values(rule.declarations)) {
        expect(value).not.toMatch(/cq[wh]\b/)
      }
    }
    const button = problem.find((r) => r.selectors.includes('.cs-problem-button'))!
    expect(Number(/(\d+)px/.exec(button.declarations['min-height'] ?? '')?.[1])).toBeGreaterThanOrEqual(24)
  })

  it('never suppresses the focus outline on a control the learner needs', () => {
    const focus = rules(stylesheet()).find((r) =>
      r.selectors.includes('.cs-problem-button:focus-visible'),
    )
    expect(focus?.declarations['outline']).toBeDefined()
    expect(focus!.declarations['outline']).not.toMatch(/^(none|0)\b/)
  })
})
