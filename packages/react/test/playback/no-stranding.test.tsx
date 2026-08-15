import { createElement as h } from 'react'

import { describe, expect, it } from 'vitest'
import { corpus, element, lessonOf, mediaElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'
import type { Transport } from '@cuestack/core'

/**
 * SC-010: no corpus lesson reaches a state where the learner can neither progress nor be
 * told why.
 *
 * A sweep rather than a case, because the failure it guards is *emergent*: any of the
 * conditions this wave added — a gate, a media rule, a dead end — can strand a learner if it
 * combines with something the individual test did not have. Asserting the invariant across
 * every corpus lesson is the only form that survives a lesson nobody thought of.
 *
 * The invariant is a disjunction on purpose. Progressing is the good outcome; being *told*
 * is the acceptable one. What is forbidden is neither.
 */

async function stateAfter(lesson: ReturnType<typeof corpus>[number]['lesson']) {
  const ports = testPorts()
  let transport: Transport | null = null
  const container = await client(
    h(LessonPlayer, {
      lesson,
      ports,
      autoPlay: true,
      onReady: (t: Transport) => {
        transport = t
      },
    }),
  )
  // Long enough for every corpus lesson to have run out of anything to do on its own.
  await runFrames(ports, 30_000, 200)
  return { container, transport: transport!, ports }
}

describe('no corpus lesson strands the learner', () => {
  for (const entry of corpus()) {
    it(`${entry.name}: progresses, completes, or explains itself`, async () => {
      const { container, transport } = await stateAfter(entry.lesson)

      const finished = container.querySelector('.cs-complete') !== null
      const explained = container.querySelector('[role="alert"]') !== null
      const atLastSlide = transport.slideIndex === entry.lesson.slides.length - 1
      /**
       * Anything the learner can press.
       *
       * A first version counted only answerable questions and reported the reference lesson
       * as stranded — it was waiting on the gesture prompt, which is a way forward and the
       * one BR-014 requires. "Can progress" is not "can answer"; it is "has something to do".
       */
      const actionable = [...container.querySelectorAll('button, input')].some(
        (el) => el.getAttribute('aria-disabled') !== 'true' && !el.hasAttribute('disabled'),
      )

      expect(
        finished || explained || actionable || atLastSlide,
        'no completion, no explanation, nothing to press, and not at the last slide',
      ).toBe(true)
    })
  }

  it('explains a media-gated slide whose media never attaches', async () => {
    /**
     * The stranding the sweep actually found, kept as a case of its own so it cannot regress
     * quietly behind the disjunction above.
     *
     * `reachability` catches media that reports failed, is the wrong type, or is absent from
     * the manifest. It cannot catch this: the port returns null — "no media for that id" —
     * which at slide entry is indistinguishable from "not mounted yet", and the kernel has no
     * clock to tell them apart. A host with no asset resolver hits it on the first slide with
     * a video, because the element renders a reserved-space fallback and there is no `<video>`
     * behind it at all.
     */
    const lesson = lessonOf([
      slide([mediaElement({ id: 'v', payload: { volume: 0 } })], {
        durationMs: 8000,
        advance: { mode: 'after_media_ends', mediaElementId: 'v' },
      }),
      slide([element({ id: 'after', endMs: 60_000, effects: [] })], { durationMs: 4000 }),
    ])
    // Ports whose media port knows about nothing, which is what a slide with no `<video>`
    // behind it looks like from the kernel's side.
    const { container } = await stateAfter(lesson)
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
  })

  it('offers a way out of every explained state', async () => {
    // Being told is only acceptable if there is something to do about it. An alert with no
    // control is a more articulate dead end.
    for (const entry of corpus()) {
      const { container } = await stateAfter(entry.lesson)
      const alert = container.querySelector('[role="alert"]')
      if (!alert) continue
      const buttons = container.querySelectorAll('.cs-problem button')
      expect(buttons.length, `${entry.name} explains itself but offers nothing`).toBeGreaterThan(0)
    }
  })
})
