import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Slide } from '@cuestack/schema'
import { resolve } from '@cuestack/core'
import type { EditorSession } from '../session/useEditorSession.js'
import type { Playback } from '../session/usePlayback.js'
import { MAX_PX_PER_SECOND, MIN_PX_PER_SECOND } from './constants.js'
import { clampPxPerSecond, createScale } from './scale.js'
import { snapTargetsFor, type TimeRange } from './timing.js'
import { overrunsOf } from './overrun.js'
import { TimelineProblems } from './TimelineProblems.js'
import { buildTracks } from './tracks.js'
import { Playhead } from './Playhead.js'
import { Ruler } from './Ruler.js'
import { Track } from './Track.js'
import { TransportControls } from './TransportControls.js'
import { Announcer } from '../canvas/Announcer.js'

export interface TimelineProps {
  readonly session: EditorSession
  readonly playback: Playback
}

const DEFAULT_PX_PER_SECOND = 100

/**
 * The timeline for the selected slide (FR-001).
 *
 * It replaces feature 005's authoring-time scrub rather than sitting beside it. Two controls
 * writing one value disagree the moment one is dragged during playback, which is the
 * obligation that feature recorded against this one (FR-006).
 *
 * **Every time change goes through `playback.seek`**, never through
 * `session.setAuthoringTime`. While the writer exists it owns the canvas's continuous
 * properties, and a caller that moved one without the other would split the canvas between
 * two moments (research R-02).
 *
 * The time scale lives here and is never serialized (FR-044). Changing it preserves the
 * moment rather than the pixel: the playhead's time is the stored value and its position is
 * computed from it.
 */
export function Timeline({ session, playback }: TimelineProps): ReactNode {
  const [pxPerSecond, setPxPerSecond] = useState(DEFAULT_PX_PER_SECOND)
  const scale = useMemo(() => createScale(pxPerSecond), [pxPerSecond])

  const slide = (session.draft.slides.find((s) => s.id === session.slideId) ??
    session.draft.slides[0]!) as Slide
  const tracks = useMemo(() => buildTracks(slide), [slide])
  const selected = new Set(session.selection)
  const [announcement, setAnnouncement] = useState('')

  /**
   * Every re-time goes through `applyEdit`, so read-only refusal and post-edit validation
   * hold here without restatement (FR-042).
   *
   * A refused drag has to *say* so. Doing nothing visible is the worst answer for a locked
   * element: it looks like the editor is broken rather than like the element is protected
   * (FR-016, NFR-USA-004).
   */
  const retime = useCallback(
    (elementId: string, range: TimeRange): void => {
      const result = session.apply({
        kind: 'set-timing',
        id: elementId,
        startMs: range.startMs,
        endMs: range.endMs,
      })
      setAnnouncement(
        result.ok
          ? `Re-timed to ${(range.startMs / 1000).toFixed(1)}–${(range.endMs / 1000).toFixed(1)} seconds.`
          : result.message,
      )
    },
    [session],
  )

  /**
   * The kernel's own findings, filtered — not detected here (research R-08).
   *
   * `collectProblems` runs on every resolve and does not depend on the moment, so resolving
   * at zero is enough: an overrun is a property of the authored data, not of where the
   * playhead happens to be.
   */
  const problems = useMemo(() => overrunsOf(resolve(slide, 0)), [slide])

  return (
    <section className="cs-timeline" aria-label="Timeline">
      <TransportControls playback={playback} durationMs={slide.durationMs} />

      <div className="cs-timeline-scale">
        <label>
          Time scale
          <input
            type="range"
            min={MIN_PX_PER_SECOND}
            max={MAX_PX_PER_SECOND}
            step={10}
            value={pxPerSecond}
            onChange={(event) => setPxPerSecond(clampPxPerSecond(Number(event.currentTarget.value)))}
          />
        </label>
      </div>

      <div className="cs-timeline-body">
        <Ruler durationMs={slide.durationMs} scale={scale} onSeek={playback.seek} />
        <Playhead
          atMs={playback.atMs}
          durationMs={slide.durationMs}
          scale={scale}
          playing={playback.state === 'playing'}
          onSeek={playback.seek}
        />
        {/* Scrolls rather than laying every track out at once — SC-012 at the dense slide. */}
        <ol className="cs-tracks">
          {tracks.map((track) => (
            <Track
              key={track.elementId}
              track={track}
              scale={scale}
              selected={selected.has(track.elementId)}
              snapTargets={snapTargetsFor(slide, track.elementId)}
              onSelect={(id) => session.select([id])}
              onRetime={retime}
            />
          ))}
        </ol>
      </div>
      <TimelineProblems
        slide={slide}
        problems={problems}
        disabled={session.mode === 'read-only'}
        onExtend={() => {
          const result = session.apply({ kind: 'extend-slide' })
          setAnnouncement(result.ok ? 'The slide now contains everything on it.' : result.message)
        }}
      />
      <Announcer message={announcement} />
    </section>
  )
}
