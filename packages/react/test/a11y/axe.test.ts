import { act, createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import axe from 'axe-core'
import {
  corpus,
  deadEndQuestionLesson,
  mediaGatedLesson,
  requiredQuestionLesson,
  singleSlideLesson,
  transitionLesson,
} from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer, createRendererRegistry } from '../../src/index.js'
import { builtinRenderers } from '../../src/elements/builtin/index.js'
import { testPorts } from '../harness/ports.js'
import { mediaPorts, degenerate } from '../harness/media.js'
import { runFrames } from '../harness/frames.js'

/**
 * SC-010 · Constitution III.
 *
 * axe over every corpus slide, at WCAG 2.2 AA. This is the gate `gates/a11y.mjs` runs,
 * and it is a merge gate from this feature onward.
 *
 * **What this does not prove.** Automated checking catches roughly half of real
 * accessibility defects (research R-05). The half it catches is the half that regresses
 * silently — a missing accessible name is invisible when you can see the screen. It
 * cannot tell whether a focus order makes sense, whether an announcement is intelligible,
 * or whether a lesson is usable. None of this substitutes for a screen-reader review,
 * which belongs in the merge review rather than in CI.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** A host resolver, so images and media render as themselves rather than as fallbacks —
 *  the fallback has its own accessibility obligations and its own assertions below. */
const resolveAsset = (ref: { assetId: string }): string =>
  /^(https?:|\/|\.\/|data:)/.test(ref.assetId) ? ref.assetId : `https://example.test/${ref.assetId}`

async function violations(node: HTMLElement): Promise<axe.Result[]> {
  const result = await axe.run(node, {
    runOnly: { type: 'tag', values: TAGS },
    // Colour contrast needs real layout and painted pixels; happy-dom has neither, so
    // the check would report nothing and look like a pass. Contrast is enforced by the
    // theme's own tokens and belongs in the screen-reader-and-eyes review.
    rules: { 'color-contrast': { enabled: false } },
  })
  return result.violations
}

const describeViolation = (v: axe.Result): string =>
  `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.html).join('\n    ')}`

describe('every corpus slide passes axe at WCAG 2.2 AA', () => {
  for (const entry of corpus()) {
    it(`has no violations: ${entry.name}`, async () => {
      const container = await client(
        h(LessonPlayer, { lesson: entry.lesson, ports: testPorts(), resolveAsset }),
      )
      const found = await violations(container)
      expect(found.map(describeViolation).join('\n'), `${found.length} violation(s)`).toBe('')
    })
  }

  it('checks slides that actually contain content', async () => {
    // An axe sweep over an empty container reports nothing and reads as a pass. The
    // corpus must include a slide with elements in it, or this suite proves nothing.
    const withContent = corpus().find((e) => e.name === 'all element types')!
    const container = await client(
      h(LessonPlayer, { lesson: withContent.lesson, ports: testPorts(), resolveAsset }),
    )
    expect(container.querySelectorAll('[data-cs-element-id]').length).toBeGreaterThan(5)
  })

  it('has no violations when assets fail to resolve', async () => {
    // The fallback state is learner-facing too, and it is the state a lesson reaches
    // when a host misconfigures asset resolution — so more likely to be seen than not.
    const withContent = corpus().find((e) => e.name === 'all element types')!
    const container = await client(h(LessonPlayer, { lesson: withContent.lesson, ports: testPorts() }))
    const found = await violations(container)
    expect(found.map(describeViolation).join('\n')).toBe('')
  })
})

/**
 * SC-011 — the states Wave 3 added, each swept as its own case.
 *
 * The corpus sweep above renders every lesson at time zero, which is precisely the moment
 * none of these exist. A question that has been answered, a verdict, a gesture prompt, two
 * slides mid-crossfade, a progress indicator, an ending, and each of the three ways a lesson
 * can stop are all states a learner reaches and none of them were reachable when the sweep
 * was written. Every one is chrome the learner is expected to read or operate, which is where
 * an unnamed control or an unlabelled region does the most damage.
 *
 * Enumerated rather than generated: each state needs a different route to reach it, and a
 * sweep that quietly failed to reach one would report a pass over an empty container. Each
 * builder therefore asserts it arrived before axe is asked anything.
 */
describe('every state Wave 3 added passes axe at WCAG 2.2 AA', () => {
  async function answered(): Promise<HTMLElement> {
    const container = await client(
      h(LessonPlayer, { lesson: requiredQuestionLesson(), ports: testPorts(), resolveAsset }),
    )
    await act(async () => {
      container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]!.click()
    })
    await act(async () => {
      ;[...container.querySelectorAll('button')]
        .find((b) => /submit|answer/i.test(b.textContent ?? ''))!
        .click()
    })
    return container
  }

  const STATES: Record<string, () => Promise<HTMLElement>> = {
    /* A question nobody has touched: radios, a group label, a submit control. */
    async 'question unanswered'() {
      const container = await client(
        h(LessonPlayer, { lesson: requiredQuestionLesson(), ports: testPorts(), resolveAsset }),
      )
      expect(container.querySelector('input[type="radio"]')).not.toBeNull()
      return container
    },

    /* Answered, which is also the feedback state — the verdict is what answering produces. */
    async 'question answered, with feedback'() {
      const container = await answered()
      expect(container.querySelector('.cs-question-status')?.textContent?.trim()).toBeTruthy()
      return container
    },

    /* BR-014. The one control standing between the learner and the lesson. */
    async 'gesture prompt'() {
      const container = await client(
        h(LessonPlayer, {
          lesson: mediaGatedLesson(),
          ports: mediaPorts(),
          autoPlay: true,
          resolveAsset,
        }),
      )
      expect(container.querySelector('.cs-gesture')).not.toBeNull()
      return container
    },

    /* Two stages on screen at once, which is two of everything for axe to disagree about. */
    async 'mid-transition'() {
      const ports = testPorts()
      const container = await client(
        h(LessonPlayer, { lesson: transitionLesson(), ports, autoPlay: true, resolveAsset }),
      )
      await runFrames(ports, 8100)
      expect(container.querySelectorAll('.cs-stage').length).toBe(2)
      return container
    },

    async 'progress indicator'() {
      const container = await client(
        h(LessonPlayer, {
          lesson: transitionLesson(),
          ports: testPorts(),
          progress: 'slides',
          resolveAsset,
        }),
      )
      expect(container.querySelector('.cs-progress')).not.toBeNull()
      return container
    },

    async 'lesson complete'() {
      const ports = testPorts()
      const container = await client(
        h(LessonPlayer, { lesson: singleSlideLesson(), ports, autoPlay: true, resolveAsset }),
      )
      await runFrames(ports, 5000)
      expect(container.querySelector('.cs-complete')).not.toBeNull()
      return container
    },

    /* ADVANCE_MEDIA_FAILED — the retryable one, so this is the state with two buttons. */
    async 'error: media failed'() {
      const ports = mediaPorts()
      degenerate.fails(ports.media, 'el_video')
      const container = await client(
        h(LessonPlayer, { lesson: mediaGatedLesson(), ports, autoPlay: true, resolveAsset }),
      )
      await runFrames(ports, 1200)
      expect(container.querySelector('.cs-problem')).not.toBeNull()
      return container
    },

    /* ADVANCE_UNSATISFIABLE — one attempt, spent wrongly, on an `on_correct` question. */
    async 'error: dead-end question'() {
      const container = await client(
        h(LessonPlayer, { lesson: deadEndQuestionLesson(), ports: testPorts(), resolveAsset }),
      )
      await act(async () => {
        container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]!.click()
      })
      await act(async () => {
        ;[...container.querySelectorAll('button')]
          .find((b) => /submit|answer/i.test(b.textContent ?? ''))!
          .click()
      })
      expect(container.querySelector('.cs-problem')).not.toBeNull()
      return container
    },

    /* UNKNOWN_REQUIRED_INTERACTION — a renderer set with no question in it. */
    async 'error: unrenderable required question'() {
      const container = await client(
        h(LessonPlayer, {
          lesson: requiredQuestionLesson(),
          ports: testPorts(),
          elements: createRendererRegistry(builtinRenderers.filter((r) => r.type !== 'question')),
          resolveAsset,
        }),
      )
      expect(container.querySelector('.cs-problem')).not.toBeNull()
      return container
    },
  }

  for (const [name, build] of Object.entries(STATES)) {
    it(`has no violations: ${name}`, async () => {
      const container = await build()
      const found = await violations(container)
      expect(found.map(describeViolation).join('\n'), `${found.length} violation(s)`).toBe('')
    })
  }
})
