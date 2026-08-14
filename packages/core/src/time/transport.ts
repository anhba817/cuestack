import type { LessonManifest } from '@cuestack/schema'
import type { Ports } from '../ports/index.js'
import { createClock, CLAMP_CEILING_MS, type Clock } from './clock.js'

export { CLAMP_CEILING_MS }

export type TransportState = 'idle' | 'playing' | 'paused' | 'completed'

/**
 * A committed view of playback. Returned synchronously by every operation so a
 * caller never has to guess whether it took effect.
 */
export interface TransportSnapshot {
  readonly state: TransportState
  readonly slideIndex: number
  readonly slideTimeMs: number
  /** Slide id plus visit counter — the single-fire key (research R-05). */
  readonly instanceId: string
}

export interface Transport {
  readonly state: TransportState
  readonly slideIndex: number
  readonly slideTimeMs: number
  readonly instanceId: string
  play(): TransportSnapshot
  pause(): TransportSnapshot
  seek(slideTimeMs: number): TransportSnapshot
  restart(): TransportSnapshot
  goToSlide(index: number): TransportSnapshot
  subscribe(listener: (snapshot: TransportSnapshot) => void): () => void
}

export function createTransport(
  lesson: LessonManifest,
  ports: Pick<Ports, 'time' | 'visibility'>,
): Transport {
  const clock: Clock = createClock(ports.time)
  let state: TransportState = 'idle'
  let slideIndex = 0
  const visits = new Map<number, number>()
  const listeners = new Set<(snapshot: TransportSnapshot) => void>()
  /** Set when visibility forced the pause, so returning resumes automatically. */
  let pausedByVisibility = false

  const bumpVisit = (index: number): void => {
    visits.set(index, (visits.get(index) ?? 0) + 1)
  }
  bumpVisit(0)

  const instanceId = (): string => {
    const slide = lesson.slides[slideIndex]
    return `${slide?.id ?? 'none'}#${visits.get(slideIndex) ?? 1}`
  }

  const snapshot = (): TransportSnapshot => ({
    state,
    slideIndex,
    slideTimeMs: clock.elapsedMs(),
    instanceId: instanceId(),
  })

  /** Listeners are called after the state they describe is already committed, so
   *  a listener always observes a consistent transport. */
  const emit = (): TransportSnapshot => {
    const snap = snapshot()
    for (const listener of listeners) listener(snap)
    return snap
  }

  const startClock = (): void => {
    clock.start()
    state = 'playing'
  }

  const stopClock = (): void => {
    clock.stop()
    state = 'paused'
  }

  // BR-013 / FR-016: while hidden, lesson time does not advance; on returning it
  // continues from the stored position rather than from where wall-clock reached.
  ports.visibility.subscribe((hidden) => {
    if (hidden) {
      if (state === 'playing') {
        stopClock()
        pausedByVisibility = true
        emit()
      }
      return
    }
    if (pausedByVisibility && state === 'paused') {
      pausedByVisibility = false
      startClock()
      emit()
    }
  })

  if (ports.visibility.isHidden()) pausedByVisibility = false

  return {
    get state() {
      return state
    },
    get slideIndex() {
      return slideIndex
    },
    get slideTimeMs() {
      return clock.elapsedMs()
    },
    get instanceId() {
      return instanceId()
    },

    play() {
      if (state === 'playing' || state === 'completed') return snapshot()
      if (ports.visibility.isHidden()) {
        // Starting while hidden would accumulate time the learner never saw.
        pausedByVisibility = true
        state = 'paused'
        return emit()
      }
      pausedByVisibility = false
      startClock()
      return emit()
    },

    pause() {
      if (state !== 'playing') return snapshot()
      pausedByVisibility = false
      stopClock()
      return emit()
    },

    seek(slideTimeMs) {
      clock.set(slideTimeMs < 0 ? 0 : slideTimeMs)
      return emit()
    },

    restart() {
      clock.reset(0)
      return emit()
    },

    goToSlide(index) {
      if (index >= lesson.slides.length) {
        clock.stop()
        state = 'completed'
        return emit()
      }
      slideIndex = index < 0 ? 0 : index
      bumpVisit(slideIndex)
      clock.reset(0)
      return emit()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
