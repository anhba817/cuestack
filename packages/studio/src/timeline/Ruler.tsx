import type { ReactNode } from 'react'
import type { TimeScale } from './scale.js'

export interface RulerProps {
  readonly durationMs: number
  readonly scale: TimeScale
  readonly onSeek: (ms: number) => void
}

/** Roughly one tick per 80 px, rounded to a interval a teacher reads without effort. */
function tickIntervalMs(scale: TimeScale): number {
  const candidates = [100, 250, 500, 1000, 2000, 5000, 10_000, 30_000, 60_000]
  return candidates.find((ms) => scale.toPx(ms) >= 80) ?? candidates[candidates.length - 1]!
}

/**
 * The time axis, and the seek target.
 *
 * Its ends stay visually distinct from a bar sitting on the boundary — an element spanning
 * the whole slide has both handles on the ruler's ends, and two edges that look identical
 * are two edges a teacher cannot tell apart (spec edge case).
 *
 * A slide of zero duration draws no ticks and no width. Legal — `Slide.durationMs` is
 * `msInt`, integer >= 0 — and it must be uneventful rather than a division by zero.
 */
export function Ruler({ durationMs, scale, onSeek }: RulerProps): ReactNode {
  const interval = tickIntervalMs(scale)
  const ticks: number[] = []
  for (let ms = 0; ms <= durationMs; ms += interval) ticks.push(ms)

  return (
    <div
      className="cs-ruler"
      data-testid="cs-ruler"
      style={{ width: `${scale.toPx(durationMs)}px` }}
      onClick={(event) => onSeek(scale.toMs(event.nativeEvent.offsetX))}
    >
      {ticks.map((ms) => (
        <span key={ms} className="cs-ruler-tick" style={{ left: `${scale.toPx(ms)}px` }}>
          {(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s
        </span>
      ))}
    </div>
  )
}
