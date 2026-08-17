import type { ReactNode } from 'react'
import type { Playback } from '../session/usePlayback.js'

export interface TransportControlsProps {
  readonly playback: Playback
  readonly durationMs: number
}

const seconds = (ms: number): string => (ms / 1000).toFixed(1)

/**
 * Play, pause, restart, and the current moment — spoken with a subject.
 *
 * Real buttons, so activation and focus come from the platform. The time is a live region
 * rather than a decoration: a teacher operating by keyboard has no other way to learn where
 * the playhead reached (FR-008, NFR-ACC-002).
 */
export function TransportControls({ playback, durationMs }: TransportControlsProps): ReactNode {
  const playing = playback.state === 'playing'
  return (
    <div className="cs-transport">
      <button type="button" onClick={() => (playing ? playback.pause() : playback.play())}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <button type="button" onClick={() => playback.restart()}>
        Restart
      </button>
      <output className="cs-transport-time" aria-live="off">
        {`Authoring time, ${seconds(playback.atMs)} of ${seconds(durationMs)} seconds`}
      </output>
    </div>
  )
}
