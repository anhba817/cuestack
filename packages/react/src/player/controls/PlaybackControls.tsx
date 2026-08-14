'use client'

import { useContext, useEffect, useState, type ReactNode } from 'react'
import type { TransportSnapshot } from '@cuestack/core'
import { PlayerContext } from '../usePlayer.js'

export interface PlaybackControlsProps {
  /** Seconds a step moves. Small enough to be useful, large enough to be reachable. */
  readonly stepSeconds?: number
}

/**
 * Play, pause, and seek (FR-020).
 *
 * Real `<button>` elements and a real `<input type="range">`, not styled divs — keyboard
 * operability, focus behaviour, and the correct roles come with them, and every substitute
 * has to earn all three back.
 *
 * The slider is the seek control, and it is the interesting one. It shows lesson time, so it
 * must follow playback — but it must not fight the learner who is dragging it. It therefore
 * reads the transport's own time rather than keeping its own, and the transport is the single
 * source either way: a `seek` while playing and a `seek` while paused go through the same
 * call, so scrubbing cannot drift from playing.
 *
 * No separate "current time" state. That would be a second clock, and two clocks disagree.
 *
 * The state comes from the transport's subscription, not from a frame loop. Sixty updates a
 * second through React is exactly what the frame loop exists to avoid, and a slider position
 * does not need per-frame resolution to look continuous.
 */
export function PlaybackControls({ stepSeconds = 5 }: PlaybackControlsProps): ReactNode {
  /**
   * The context directly, rather than `usePlayer()`, which throws when it is absent.
   *
   * Absent is a legitimate state here and not a mistake: the transport is created in a mount
   * effect, so there is none during the server render or during the hydration pass. Throwing
   * would make the player unrenderable on a server the moment a host added controls, and
   * rendering them early would make the hydration pass disagree with the server. Returning
   * nothing until the transport exists is what keeps both true.
   */
  const player = useContext(PlayerContext)
  // Read, never called. `transport.pause()` would have been the obvious way to get a
  // snapshot and would have stopped playback on mount — an initialiser with a side effect,
  // in a component whose job is to not fight the transport.
  const [snapshot, setSnapshot] = useState<TransportSnapshot | null>(null)

  useEffect(() => player?.transport.subscribe(setSnapshot), [player])

  if (!player) return null

  const { transport, slideDurationMs: durationMs } = player
  // Read, never called. `transport.pause()` would have been the obvious way to obtain a
  // snapshot and would have stopped playback on mount — a side effect in an initialiser, in
  // a component whose whole job is not to fight the transport.
  const current: TransportSnapshot = snapshot ?? {
    state: transport.state,
    slideIndex: transport.slideIndex,
    slideTimeMs: transport.slideTimeMs,
    instanceId: transport.instanceId,
  }
  const playing = current.state === 'playing'

  return (
    <div className="cs-controls" role="group" aria-label="Playback">
      <button
        className="cs-controls-button"
        type="button"
        onClick={() => setSnapshot(playing ? transport.pause() : transport.play())}
        // The accessible name says what the button does, not what the state is. "Playing"
        // would be a status; a learner needs to know what pressing it will accomplish.
        aria-label={playing ? 'Pause' : 'Play'}
        aria-pressed={playing}
      >
        {playing ? 'Pause' : 'Play'}
      </button>

      <button
        className="cs-controls-button"
        type="button"
        onClick={() => setSnapshot(transport.seek(Math.max(0, current.slideTimeMs - stepSeconds * 1000)))}
        aria-label={`Back ${stepSeconds} seconds`}
      >
        −{stepSeconds}s
      </button>

      <button
        className="cs-controls-button"
        type="button"
        onClick={() =>
          setSnapshot(transport.seek(Math.min(durationMs, current.slideTimeMs + stepSeconds * 1000)))
        }
        aria-label={`Forward ${stepSeconds} seconds`}
      >
        +{stepSeconds}s
      </button>

      <input
        className="cs-controls-seek"
        type="range"
        min={0}
        max={durationMs}
        // Whole seconds. A step of 1ms makes an arrow key move imperceptibly, so a keyboard
        // learner cannot seek at all — the control is present, focusable, and useless.
        step={1000}
        value={current.slideTimeMs}
        onChange={(event) => setSnapshot(transport.seek(Number(event.target.value)))}
        aria-label="Seek within this slide"
        aria-valuetext={`${Math.round(current.slideTimeMs / 1000)} of ${Math.round(durationMs / 1000)} seconds`}
      />

      <span className="cs-controls-time">
        {Math.round(current.slideTimeMs / 1000)}s / {Math.round(durationMs / 1000)}s
      </span>
    </div>
  )
}
