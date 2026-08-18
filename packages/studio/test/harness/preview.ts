import { memoryAdapters, type Ports } from '@cuestack/core'
// A relative path into core's test harness, not a package import: `@cuestack/core` resolves
// to `dist`, which contains no test code. `@cuestack/react` does the same for the same
// reason, and the boundary rules that govern `src` do not apply to a fake.
import { fakeMedia, type FakeMedia } from '../../../core/test/harness/media.js'
import { element, lessonOf, slide } from './corpus.js'
import type { Element, LessonManifest, Slide } from '@cuestack/schema'

/**
 * Fixtures and ports for the preview suites.
 *
 * Beside `harness/corpus.ts` rather than inside it: those builders answer *authoring*
 * questions — a locked element, two elements sharing a `zIndex` — and these answer
 * *playback* ones, which is a different subject with a different reason to change. The
 * `fx-` prefix is shared deliberately, so fixture ids never collide with `countingIds()`.
 */

/** A required question, outlasting its slide so the gate is live when the timer fires. */
export function questionElement(overrides: Record<string, unknown> = {}): Element {
  const { payload = {}, ...rest } = overrides as { payload?: Record<string, unknown> }
  return element({
    type: 'question',
    endMs: 60_000,
    payload: {
      interactionType: 'multiple_choice',
      prompt: 'Which of these must be reported?',
      options: [
        { id: 'a', label: 'A near-miss' },
        { id: 'b', label: 'Nothing' },
      ],
      correctResponse: 'a',
      required: true,
      ...payload,
    },
    ...rest,
  })
}

/** An audio element, so `hasAudibleMedia` and the media gate have something to hold. */
export function audioElement(overrides: Record<string, unknown> = {}): Element {
  return element({
    type: 'audio',
    endMs: 60_000,
    payload: {
      asset: { assetId: 'fx_audio_asset', mimeType: 'audio/mpeg', durationMs: 4000 },
      showControls: true,
    },
    ...overrides,
  })
}

/** An image element, for the asset-resolution suites. */
export function imageElement(overrides: Record<string, unknown> = {}): Element {
  return element({
    type: 'image',
    payload: { asset: { assetId: 'fx_image_asset', mimeType: 'image/png' } },
    accessibility: { altText: 'A diagram' },
    ...overrides,
  })
}

/** Three slides that advance on their own, for start points and navigation. */
export function multiSlideLesson(): LessonManifest {
  return lessonOf([
    slide([element({ payload: { text: 'first' } })], { durationMs: 4000 }),
    slide([element({ payload: { text: 'second' } })], { durationMs: 4000 }),
    slide([element({ payload: { text: 'third' } })], { durationMs: 4000 }),
  ])
}

/**
 * A lesson whose second slide cannot be passed without answering.
 *
 * Three gated slides rather than one: FR-017 is not "the override works", it is "one action,
 * not one per gate", and a single gate cannot tell those apart.
 */
export function gatedLesson(): LessonManifest {
  const gate = (): Slide =>
    slide([questionElement()], { durationMs: 2000, advance: { mode: 'after_duration' } })
  return lessonOf([
    slide([element({ payload: { text: 'open' } })], { durationMs: 2000 }),
    gate(),
    gate(),
    gate(),
  ])
}

/** A slide that waits for audio that never ends. */
export function mediaGatedLesson(): LessonManifest {
  const audio = audioElement({ id: 'fx-gate-audio' })
  return lessonOf([
    slide([element({ payload: { text: 'open' } })], { durationMs: 2000 }),
    slide([audio], {
      durationMs: 2000,
      advance: { mode: 'after_media_ends', mediaElementId: audio.id },
    }),
    slide([element({ payload: { text: 'after' } })], { durationMs: 2000 }),
  ])
}

/**
 * A slide whose advance rule names an element that is not there.
 *
 * The kernel has detected this since Wave 1 and has only ever told the learner. FR-021 is
 * about telling the author, and this is the fixture that lets it.
 */
export function unreachableLesson(): LessonManifest {
  return lessonOf([
    slide([element({ payload: { text: 'open' } })], { durationMs: 2000 }),
    slide([element({ payload: { text: 'stuck' } })], {
      durationMs: 2000,
      advance: { mode: 'after_media_ends', mediaElementId: 'fx-not-here' },
    }),
  ])
}

/** A lesson carrying an image, for FR-003. */
export function assetLesson(): LessonManifest {
  return lessonOf([slide([imageElement({ id: 'fx-image' })], { durationMs: 4000 })])
}

/** One slide, so previous and next are both unavailable (US3's edge case). */
export function oneSlideLesson(): LessonManifest {
  return lessonOf([slide([element({ payload: { text: 'only' } })], { durationMs: 4000 })])
}

export interface SyntheticClock {
  (): number
  advance(ms: number): void
}

export interface PlayerPorts extends Ports {
  readonly media: FakeMedia
  readonly clock: SyntheticClock
  readonly events: readonly unknown[]
  advance(ms: number): void
  setHidden(hidden: boolean): void
}

/**
 * A **full** `Ports` for a mounted player, which is not what `fakePorts()` provides.
 *
 * `fakePorts()` in `harness/editor.tsx` returns `Pick<Ports, 'time' | 'visibility'>` and must
 * stay that way: `usePlayback` is typed to exactly that Pick, and widening it in place would
 * change a signature four feature-006 suites depend on. `LessonPlayerClient` needs all six
 * members or it builds `browserPorts()` itself, in which case there is no clock to advance —
 * and Constitution II is non-negotiable about that, in the words `usePlayback`'s own comment
 * uses: "Substitutable so a test can hand-advance the clock."
 *
 * **This one is deliberately whole.** The player merges a caller's ports over its own
 * defaults per member, so a partial would keep the DOM media port — which reads a happy-dom
 * `<audio>` with no decoder behind it. A full object replaces it with the scripted fake,
 * which is what the player's own comment asks for: "a test handing in a scripted media fake
 * must not have it replaced by one reading a DOM that has no decoder behind it." Production
 * passes a partial; tests pass the whole thing.
 *
 * The analytics adapter records rather than discards, so a suite can assert that a preview
 * emitted nothing (FR-031). That assertion is the reason this returns `events` at all.
 */
export function fakePlayerPorts(): PlayerPorts {
  let now = 0
  const clock = (() => now) as SyntheticClock
  clock.advance = (ms) => {
    now += ms
  }

  let hidden = false
  const listeners = new Set<(h: boolean) => void>()
  const events: unknown[] = []
  const adapters = memoryAdapters()

  return {
    ...adapters,
    clock,
    time: clock,
    media: fakeMedia(),
    visibility: {
      isHidden: () => hidden,
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    analytics: {
      record(event: unknown) {
        events.push(event)
      },
    } as Ports['analytics'],
    events,
    advance: (ms) => clock.advance(ms),
    setHidden: (next) => {
      hidden = next
      for (const l of listeners) l(next)
    },
  }
}
