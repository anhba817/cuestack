import { useEffect, useRef, type ReactNode } from 'react'
import type { TimeScale } from './scale.js'

export interface PlayheadProps {
  readonly atMs: number
  readonly durationMs: number
  readonly scale: TimeScale
  readonly playing: boolean
  readonly onSeek: (ms: number) => void
}

const seconds = (ms: number): string => (ms / 1000).toFixed(1)

/**
 * The authoring time, drawn — one value, and the only control that writes it (FR-006).
 *
 * A real `<input type="range">`, so focus, keyboard operation, and the slider role come from
 * the platform rather than from an imitation. Feature 005's overlay took the same decision
 * and its focus suite records why.
 *
 * **Its position is written imperatively while playing.** React re-renders only when the
 * visible element set changes (research R-02), so a value bound through props would step
 * once per appearance rather than once per frame. `aria-valuenow` follows the same value, so
 * assistive technology hears the moment rather than the last render.
 *
 * The announcement carries a subject. Feature 004's manual sweep found a progress bar
 * announcing a position with no subject and no automated check had flagged it (FR-008).
 */
export function Playhead({ atMs, durationMs, scale, playing, onSeek }: PlayheadProps): ReactNode {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.style.setProperty('--cs-playhead-x', `${scale.toPx(atMs)}px`)
  }, [atMs, scale])

  return (
    <input
      ref={ref}
      className="cs-playhead"
      type="range"
      min={0}
      max={Math.max(durationMs, 0)}
      step={1}
      value={atMs}
      aria-label="Authoring time"
      aria-valuetext={`Authoring time, ${seconds(atMs)} of ${seconds(durationMs)} seconds`}
      data-playing={playing ? 'true' : 'false'}
      onChange={(event) => onSeek(Number(event.currentTarget.value))}
    />
  )
}
