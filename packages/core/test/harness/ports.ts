import type { MediaStatus, Ports, VisibilityPort } from '../../src/ports/index.js'
import { memoryAdapters } from '../../src/adapters/memory/index.js'
import { createSyntheticClock, type SyntheticClock } from './clock.js'

export interface TestPorts extends Ports {
  clock: SyntheticClock
  setMedia(elementId: string, status: Partial<MediaStatus>): void
  setHidden(hidden: boolean): void
}

const DEFAULT_MEDIA: MediaStatus = {
  positionMs: 0,
  durationMs: null,
  ended: false,
  paused: false,
  failed: false,
}

export function createTestPorts(): TestPorts {
  const clock = createSyntheticClock()
  const media = new Map<string, MediaStatus>()
  const mediaListeners = new Set<(id: string) => void>()
  let hidden = false
  const visibilityListeners = new Set<(h: boolean) => void>()

  const visibility: VisibilityPort = {
    isHidden: () => hidden,
    subscribe(listener) {
      visibilityListeners.add(listener)
      return () => visibilityListeners.delete(listener)
    },
  }

  const ports: TestPorts = {
    clock,
    time: clock,
    media: {
      query: (id) => media.get(id) ?? null,
      subscribe(listener) {
        mediaListeners.add(listener)
        return () => mediaListeners.delete(listener)
      },
    },
    visibility,
    ...memoryAdapters(),
    setMedia(elementId, status) {
      media.set(elementId, { ...DEFAULT_MEDIA, ...media.get(elementId), ...status })
      for (const l of mediaListeners) l(elementId)
    },
    setHidden(next) {
      hidden = next
      for (const l of visibilityListeners) l(next)
    },
  }
  return ports
}

/**
 * Advance time the way a real frame loop does: in small steps, reading between
 * each. A single large jump is indistinguishable from machine sleep — that is the
 * clamp's whole point (research R-03) — so a test that leaps forward and expects
 * the time to land is testing something playback never does.
 */
export function runFrames(
  ports: TestPorts,
  read: () => number,
  totalMs: number,
  frameMs = 16,
): void {
  let remaining = totalMs
  while (remaining > 0) {
    const step = Math.min(frameMs, remaining)
    ports.clock.advance(step)
    read()
    remaining -= step
  }
}
