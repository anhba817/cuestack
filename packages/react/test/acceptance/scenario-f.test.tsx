import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { client, server } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { LessonPlayer as ServerPlayer } from '../../src/server.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'
import { resolve } from '@cuestack/core'
import { declarationsFor, resolveValue, rules, stageBox, stylesheet } from '../harness/css.js'
import { stageProperties } from '../../src/theme/tokens.js'

/**
 * **MVP Acceptance Scenario F**, from `docs/Cuestack_Framework.md` §34, verbatim:
 *
 * > Given a learner with reduced motion enabled:
 * >  - Slide and zoom effects shall use a reduced or instant alternative.
 * >  - Content order and timing meaning shall remain understandable.
 * >  - Essential information shall not be lost.
 *
 * The preference itself cannot be *set* in a test: happy-dom has no media-query engine, and
 * the choice is deliberately made by CSS at paint time. So the scenario is asserted where it
 * is actually decided — the kernel emits both answers, the stylesheet selects the reduced
 * one, and the pair is in the server's first frame. Each half is checked against the real
 * artefact rather than against a mock of the preference.
 */

const stageVars = stageProperties(lessonOf([slide([])])) as Record<string, string>

const withEffect = (type: string) =>
  lessonOf([
    slide(
      [
        element({
          id: 'first',
          startMs: 0,
          endMs: 8000,
          effects: [{ id: 'fx1', type, phase: 'enter', startMs: 0, durationMs: 1000, order: 1 }],
        }),
        element({
          id: 'second',
          startMs: 2000,
          endMs: 8000,
          effects: [{ id: 'fx2', type, phase: 'enter', startMs: 2000, durationMs: 1000, order: 1 }],
        }),
      ],
      { durationMs: 8000 },
    ),
  ])

/** What the reduced-motion media block sets on `.cs-element`. */
function reducedBlock(): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const rule of rules(stylesheet('stage.css'))) {
    if (!rule.media?.includes('prefers-reduced-motion')) continue
    if (rule.selectors.includes('.cs-element')) Object.assign(merged, rule.declarations)
  }
  return merged
}

describe('§34 Scenario F — reduced motion', () => {
  describe('slide and zoom use a reduced alternative', () => {
    it.each(['slide', 'zoom'])('%s contributes a fade rather than movement', (type) => {
      const state = resolve(withEffect(type).slides[0]!, 500)
      const el = state.elements.find((e) => e.id === 'first')!
      expect(el.reduced, `${type} emitted no reduced visual`).not.toBeNull()
      expect(el.reduced!.transform).toEqual({
        translateX: 0,
        translateY: 0,
        scaleX: 1,
        scaleY: 1,
        rotate: 0,
      })
      // A fade, not an instant appearance: the element is partway in, as it would have been.
      expect(el.reduced!.opacity).toBeGreaterThan(0)
      expect(el.reduced!.opacity).toBeLessThan(1)
    })

    it('and the stylesheet selects it', () => {
      const block = reducedBlock()
      const vars = { ...stageVars, '--cs-r-tx': '0', '--cs-tx': '64' }
      expect(resolveValue(block['--cs-tx']!, vars, stageBox(1024, stageVars))).toBe(0)
    })
  })

  describe('content order and timing meaning remain understandable', () => {
    it('elements still appear in the authored order', async () => {
      const ports = testPorts()
      const container = await client(
        h(LessonPlayer, { lesson: withEffect('slide'), ports, autoPlay: true }),
      )
      const visible = () =>
        [...container.querySelectorAll('[data-cs-element-id]')].map((n) =>
          n.getAttribute('data-cs-element-id'),
        )

      await runFrames(ports, 600)
      expect(visible()).toEqual(['first'])
      await runFrames(ports, 1600)
      expect(visible()).toEqual(['first', 'second'])
    })

    it('the substitution ends when the effect it replaces would have', () => {
      // Timing meaning is preserved: the reduced form is not a shorter animation, it is a
      // different one over the same interval.
      const slideDef = withEffect('slide').slides[0]!
      const midway = resolve(slideDef, 500).elements.find((e) => e.id === 'first')!
      const done = resolve(slideDef, 1000).elements.find((e) => e.id === 'first')!
      expect(midway.reduced).not.toBeNull()
      expect(done.reduced).toBeNull()
      expect(done.opacity).toBe(1)
    })
  })

  describe('essential information is not lost', () => {
    it.each(['slide', 'zoom'])('%s never reduces an element to invisibility', (type) => {
      for (const at of [0, 250, 500, 750, 999]) {
        const el = resolve(withEffect(type).slides[0]!, at).elements.find((e) => e.id === 'first')
        if (!el?.reduced) continue
        // At progress zero the element has not arrived yet under either treatment — what
        // matters is that the reduced form is never *more* hidden than the original.
        expect(el.reduced.opacity).toBeGreaterThanOrEqual(el.opacity - 1e-9)
      }
    })

    it('every element still renders, with its content', async () => {
      const ports = testPorts()
      const container = await client(
        h(LessonPlayer, { lesson: withEffect('zoom'), ports, autoPlay: true }),
      )
      await runFrames(ports, 3000)
      expect(container.querySelectorAll('[data-cs-element-id]')).toHaveLength(2)
      expect(container.textContent).toContain('content')
    })
  })

  describe('honoured on the first frame, before any script', () => {
    it('the server emits both answers', () => {
      const markup = server(h(ServerPlayer, { lesson: withEffect('slide') }))
      expect(markup).toMatch(/--cs-ty:/)
      expect(markup).toMatch(/--cs-r-opacity:/)
    })

    it('and the element rule consumes what the media block overrides', () => {
      // The indirection is the mechanism. If a later change inlined a transform, the block
      // would silently stop having any effect and this is what would notice.
      const element = declarationsFor('.cs-element')
      expect(element['transform']).toContain('var(--cs-tx')
      expect(element['opacity']).toContain('var(--cs-opacity')
    })
  })
})
