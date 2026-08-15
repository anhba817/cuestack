import { act } from 'react'
import type { TestPorts } from './ports.js'

/**
 * Advance the *lesson* clock, then let real animation frames fire.
 *
 * Lesson time stays virtual and hand-advanced — Constitution II forbids a timing test that
 * waits out real durations, and nothing here does: a four-second slide is crossed in forty
 * synthetic steps, instantly. What is real is only the *scheduling*, because happy-dom
 * implements `requestAnimationFrame` on a timer and the frame loop is the one thing that
 * runs as time passes.
 *
 * Extracted from three copies in `test/playback/`. A helper duplicated three times is a
 * helper that will be fixed in two of them.
 */
export async function runFrames(ports: TestPorts, ms: number, stepMs = 100): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
    ports.clock.advance(stepMs)
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
  }
}

/** One frame, with no lesson time passing. For settling a render rather than moving time. */
export async function frame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}
