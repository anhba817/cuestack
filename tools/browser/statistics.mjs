/**
 * The two statistics Constitution IV's two numbers are compared against, and nothing else.
 *
 * **This module exists separately so the ordinary suite can test the arithmetic.** `measure.mjs`
 * drives Playwright; a unit test importing *it* would pull a browser driver into every `pnpm test`
 * — the suite feature 013 took from 77s to 10s, and the one FR-006 says this feature must not join.
 * Nothing here imports anything.
 */

/** The typical frame, for the 60 fps target. */
export function medianFrameMs(frames) {
  if (frames.length === 0) throw new Error('statistics: no frames were collected')
  const sorted = [...frames].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Frames slower than the floor, for the 30 fps floor.
 *
 * A count rather than a rate, and separate from the median on purpose: **a mean would pass a
 * lesson that holds 60 fps and stalls once per slide**, which reads as broken to the person
 * watching. The repository already reasons this way — the playback budget takes medians over many
 * runs and adds a worst-case bound beside them, because "a learner scrubs to one slide, not to the
 * median of eight".
 */
export function framesOverFloor(frames, floorMs) {
  if (frames.length === 0) throw new Error('statistics: no frames were collected')
  return frames.filter((ms) => ms > floorMs).length
}

/** 60 fps and 30 fps, as frame times. Constitution IV states the rates; these are the same numbers. */
export const TARGET_MS = 1000 / 60
export const FLOOR_MS = 1000 / 30

/** Both statistics, with the sample count that makes them readable. */
export function summarise(frames) {
  return {
    frames: frames.length,
    medianMs: medianFrameMs(frames),
    overFloor: framesOverFloor(frames, FLOOR_MS),
    targetMs: TARGET_MS,
    floorMs: FLOOR_MS,
  }
}
