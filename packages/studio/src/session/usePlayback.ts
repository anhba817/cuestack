import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Ports, RenderState, Transport } from '@cuestack/core'
import { createTransport, resolve } from '@cuestack/core'
import { browserPorts, createFrameWriter, useFrameLoop, type FrameWriter } from '@cuestack/react'
import type { EditorSession } from './useEditorSession.js'

export type PlaybackState = 'idle' | 'playing' | 'paused'

export interface Playback {
  readonly state: PlaybackState
  /** The moment the canvas is showing. The transport's while playing, the session's otherwise. */
  readonly atMs: number
  /** The frame's resolved state while playing; `null` when idle, so the canvas resolves itself. */
  readonly frameState: RenderState | null
  readonly writer: FrameWriter
  play(): void
  pause(): void
  restart(): void
  seek(ms: number): void
  /** How many times the writer has been given a state. Test-facing; see `reconcile.test.tsx`. */
  writeCount(): number
}

export interface PlaybackOptions {
  /** Substitutable so a test can hand-advance the clock (Constitution II). */
  readonly ports?: Pick<Ports, 'time' | 'visibility'>
}

/**
 * The editor's playback, which is the player's playback.
 *
 * `createTransport` has been in `@cuestack/core` since Wave 1 with play, pause, seek,
 * restart, a monotonic clock over an injected `TimeSource`, and `visibilitychange` handling
 * that satisfies BR-013 without this module knowing BR-013 exists. Nothing here implements
 * timing; `no-clock-in-studio` makes that a rule with no exemption, which is possible only
 * because `@cuestack/react` exports `browserPorts` and `useFrameLoop`.
 *
 * Six things this module has to get right, and each of them has been got wrong once already
 * in this repository.
 *
 * **1. The writer is created once and handed over from the first render.** Registration runs
 * through a ref on mount, so a writer that only appeared at `play()` would leave already
 * mounted elements unregistered and lose the first frame.
 *
 * **2. The loop runs only while playing.** `useFrameLoop` has no state guard of its own — it
 * ticks from mount for as long as it holds a transport. Right for a player, whose whole job
 * is playing; wrong for an editor, which would then resolve and write every frame while a
 * teacher is merely dragging, against SC-004's budget at 300 elements.
 *
 * **3. React still owns structure, and the render must read the frame's state.** The writer
 * changes a mounted node's appearance; an element entering at 5 000 ms has no node to change
 * and has to *mount*, which is an ordinary render. So `visibleIds` in state re-renders when
 * the element set changes — and `latest.current` supplies the value, because re-rendering
 * while the canvas re-derives from a stale `session.authoringTime` recomputes the same
 * frozen state. Both halves, or neither works. This is Wave 2's defect, and it hid because
 * every test drove `seek()`, which emits.
 *
 * **4. While the writer exists it owns the continuous properties**, so `write()` runs on
 * every authoring-time change as well as every frame. Most values would survive an unguarded
 * gap — reconciling on stop re-renders the moment the writer last wrote, and React takes
 * ownership of those keys. `will-change` would not: it is set imperatively and rendered by
 * nobody, so nothing else could ever clear it.
 *
 * **5. One write path for time.** Every authoring-time change goes through `seek`, never
 * through `session.setAuthoringTime` directly, or the canvas is split between the writer's
 * moment and the session's.
 *
 * **6. A slide change is not a seek.** It rebuilds the transport, so it clears the writer,
 * constructs the new one, and seeks it to that slide's *restored* authoring time — the
 * session has kept time per slide since feature 005, and a transport starting at zero would
 * render 3 000 ms against a clock saying 0.
 */
export function usePlayback(session: EditorSession, options: PlaybackOptions = {}): Playback {
  const { draft, slideId } = session
  const slide = useMemo(
    () => draft.slides.find((s) => s.id === slideId) ?? draft.slides[0]!,
    [draft, slideId],
  )

  // (1) One writer for the component's life. Its identity is also a `useFrameLoop` dependency.
  const writer = useMemo(() => createFrameWriter(), [])
  const writes = useRef(0)

  const [state, setState] = useState<PlaybackState>('idle')
  const [transport, setTransport] = useState<Transport | null>(null)
  /** (3) The trigger. Changes only when the visible set does, never per frame. */
  const [visibleIds, setVisibleIds] = useState('')
  /** (3) The value. What `onFrame` last resolved, read at render without causing one. */
  const latest = useRef<RenderState | null>(null)
  const transportRef = useRef<Transport | null>(null)

  const ports = options.ports
  const resolveAt = useCallback((slideTimeMs: number): RenderState => resolve(slide, slideTimeMs), [slide])

  /** (4) The writer owns the continuous properties, so every time change writes once. */
  const writeAt = useCallback(
    (slideTimeMs: number): void => {
      const next = resolveAt(slideTimeMs)
      latest.current = next
      writes.current += 1
      writer.write(next)
      setVisibleIds(next.elements.map((e) => e.id).join(',') || 'none')
    },
    [resolveAt, writer],
  )

  /**
   * (6) One transport per slide, seeked to that slide's restored time.
   *
   * Keyed on the slide rather than on the draft: rebuilding on every edit would reset the
   * clock the moment a teacher dragged a bar while playing.
   */
  useEffect(() => {
    const active = createTransport(draftOfSlide(session, slide.id), ports ?? browserPorts())
    transportRef.current = active
    setTransport(null)
    setState('idle')

    const restored = session.authoringTime
    if (restored > 0) active.seek(restored)
    latest.current = resolveAt(restored)

    const unsubscribe = active.subscribe((snapshot) => {
      setState(snapshot.state === 'playing' ? 'playing' : snapshot.state === 'paused' ? 'paused' : 'idle')
    })

    return () => {
      unsubscribe()
      transportRef.current = null
      writer.clear()
    }
    // `session` and `resolveAt` are deliberately absent from the dependency list: this must
    // not re-run per edit. Rebuilding the transport whenever the draft changed would reset
    // the clock the moment a teacher dragged a bar while playing. `slide.id` is the thing
    // that legitimately means "a different clock". See (6).
  }, [slide.id, ports, writer])

  // (2) The loop holds a transport only while playing. Idle costs zero writes.
  useFrameLoop(state === 'playing' ? transport : null, writer, resolveAt, (next, slideTimeMs) => {
    latest.current = next
    writes.current += 1
    setVisibleIds(next.elements.map((e) => e.id).join(',') || 'none')
    void slideTimeMs
  })

  const commit = useCallback(
    (snapshotTimeMs: number): void => {
      session.setAuthoringTime(snapshotTimeMs)
      writeAt(snapshotTimeMs)
    },
    [session, writeAt],
  )

  const play = useCallback((): void => {
    const active = transportRef.current
    if (!active) return
    const snapshot = active.play()
    setState('playing')
    setTransport(active)
    void snapshot
  }, [])

  const pause = useCallback((): void => {
    const active = transportRef.current
    if (!active) return
    const snapshot = active.pause()
    setState('paused')
    setTransport(null)
    commit(snapshot.slideTimeMs)
  }, [commit])

  const restart = useCallback((): void => {
    const active = transportRef.current
    if (!active) return
    const snapshot = active.restart()
    commit(snapshot.slideTimeMs)
  }, [commit])

  // (5) The one write path for time.
  const seek = useCallback(
    (ms: number): void => {
      const active = transportRef.current
      if (!active) return
      const snapshot = active.seek(Math.max(0, Math.round(ms)))
      commit(snapshot.slideTimeMs)
    },
    [commit],
  )

  const playing = state === 'playing'

  return {
    state,
    /**
     * Read live from the transport rather than captured at render.
     *
     * The playhead reads the clock; it does not cache it. Capturing this at render would
     * make it change only when the visible set does — which is deliberate for the *canvas*
     * (R-02) and wrong for the playhead, whose whole job is to show the moment.
     */
    get atMs(): number {
      return playing ? (transportRef.current?.slideTimeMs ?? session.authoringTime) : session.authoringTime
    },
    frameState: playing && visibleIds !== '' ? latest.current : null,
    writer,
    play,
    pause,
    restart,
    seek,
    writeCount: () => writes.current,
  }
}

/**
 * A one-slide lesson for the transport to run.
 *
 * The transport manages `slideIndex` and `goToSlide` across a whole lesson; the editor works
 * on one slide and never advances between them — playing across slides is the player's
 * behaviour and belongs to preview (ED-6). Handing it a single slide is what makes
 * `goToSlide` unreachable by construction rather than by convention.
 */
function draftOfSlide(session: EditorSession, slideId: string): Parameters<typeof createTransport>[0] {
  const slide = session.draft.slides.find((s) => s.id === slideId) ?? session.draft.slides[0]!
  return { ...session.draft, slides: [slide] }
}
