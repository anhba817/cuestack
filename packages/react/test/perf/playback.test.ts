import { act, createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { resolve, type Transport } from '@cuestack/core'
import { LessonPlayer } from '../../src/index.js'
import { createFrameWriter } from '../../src/frame/FrameWriter.js'
import { client } from '../harness/render.js'
import { testPorts } from '../harness/ports.js'
import { heavy, heavyLessonShape } from '../harness/heavy.js'

/**
 * NFR-PERF-003 and NFR-PERF-004, on the Constitution's own fixture.
 *
 * Wave 2 deferred these with a stated reason — there were no frames to drop. There are now,
 * so this is where the second half of the performance gate arms.
 *
 * **What is measured, and what is not.** happy-dom has no compositor, so "60 fps" cannot be
 * observed here at all. What these measure is the work the *player* does per frame — resolve,
 * compose, and the frame writer's property writes — and the work a seek costs up to the point
 * the new state is committed to the DOM. Paint is not in either number and cannot be; a
 * browser-based check is the honest way to get it and this wave does not add one. The gate's
 * output says so, so a pass is not mistaken for a full answer.
 *
 * The measurements are medians over many runs. A single wall-clock reading on a shared CI
 * runner is a coin toss, and a budget that fails at random is a budget that gets deleted.
 */

/** 60 fps. The 30 fps floor is 33.3; failing at the target leaves room to notice first. */
const FRAME_BUDGET_MS = 16.7
/** NFR-PERF-003, whole: resolve, render, commit. */
const SEEK_BUDGET_MS = 100

/**
 * The margin a measurement must keep, so a 10% regression fails rather than lands on the line.
 *
 * Worth being exact about what this is and is not, because "fails on a 10% regression" reads
 * two ways. It is **not** a ratchet against the previous run: that needs a recorded baseline,
 * and a baseline taken on one machine and enforced on another produces failures that are
 * about hardware rather than about code — the first kind of gate anybody disables. What it is
 * instead is a margin against the *budget*: a run that has consumed more than 10/11ths of its
 * allowance fails now, while there is still room, rather than passing at 99% and failing the
 * next time somebody adds a property to write.
 */
const REGRESSION_MARGIN = 1.1

function median(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

describe('playback performance on the 50-slide fixture', () => {
  it('is the fixture the Constitution asks for', () => {
    // Asserted rather than assumed: a budget met on a fixture that quietly shrank is not a
    // budget met. SC-008 is specifically about seeking a lesson that has media and questions
    // in it, so the composition is part of the measurement.
    const shape = heavyLessonShape()
    expect(shape.slides).toBe(50)
    expect(shape.elements).toBe(300)
    expect(shape.media).toBeGreaterThan(0)
    expect(shape.questions).toBeGreaterThan(0)
  })

  it('does less than one frame of work per frame', async () => {
    const lesson = heavy()
    const ports = testPorts()
    const container = await client(h(LessonPlayer, { lesson, ports }))

    /*
     * The loop's own work, reproduced against the real rendered nodes.
     *
     * Not driven through `useFrameLoop`, because a frame there is bounded by
     * `requestAnimationFrame` and would measure how fast happy-dom schedules callbacks. What
     * the budget is about is what happens *inside* one tick, which is exactly these two
     * calls — and running them against nodes the player actually rendered keeps the writer's
     * per-element cache honest.
     */
    const writer = createFrameWriter()
    for (const node of container.querySelectorAll<HTMLElement>('[data-cs-element-id]')) {
      writer.register(node.getAttribute('data-cs-element-id')!, node)
    }

    const slide = lesson.slides[0]!
    const tick = (timeMs: number): number => {
      const start = performance.now()
      writer.write(resolve(slide, timeMs))
      return performance.now() - start
    }

    for (let i = 0; i < 20; i += 1) tick(i * 37) // warm the JIT before measuring
    // Times that differ every frame, so the writer's unchanged-frame cache is not what is
    // being timed. A repeated time would measure a cache hit and report near zero.
    const samples = Array.from({ length: 60 }, (_, i) => tick(1000 + i * 41))

    expect(median(samples)).toBeLessThan(FRAME_BUDGET_MS / REGRESSION_MARGIN)
  })

  it('seeks to a rendered state within the budget', async () => {
    const lesson = heavy()
    const ports = testPorts()
    let transport: Transport | undefined
    await client(
      h(LessonPlayer, {
        lesson,
        ports,
        onReady: (t: Transport) => {
          transport = t
        },
      }),
    )

    /*
     * Measured through `act`, so React's commit is inside the number. "Seek to rendered
     * state" is the learner's promise, and a seek that resolves instantly and commits slowly
     * has not kept it.
     *
     * Slides chosen across the lesson including the media-and-question ones — every tenth
     * slide is the rich one, so this hits both kinds.
     */
    const targets = [0, 9, 10, 20, 25, 30, 40, 49]
    const samples: number[] = []
    for (const index of targets) {
      const start = performance.now()
      await act(async () => {
        transport!.goToSlide(index)
      })
      samples.push(performance.now() - start)
    }

    expect(median(samples)).toBeLessThan(SEEK_BUDGET_MS / REGRESSION_MARGIN)
    // The worst single seek matters too: a learner scrubs to one slide, not to the median of
    // eight. Given the headroom the median leaves, twice the budget on the slowest is a
    // generous allowance that still catches one pathological slide.
    expect(Math.max(...samples)).toBeLessThan(SEEK_BUDGET_MS * 2)
  })
})
