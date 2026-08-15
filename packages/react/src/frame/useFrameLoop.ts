import { useEffect, useRef } from 'react'
import type { RenderState, Transport } from '@cuestack/core'
import type { FrameWriter } from './FrameWriter.js'

/**
 * Drive the writer from animation frames while playback is running.
 *
 * Client-only by construction — this module is reached from the client entry alone,
 * and the effect never runs on a server because effects do not.
 *
 * **This loop is the only thing that happens as time passes.** The transport emits a
 * snapshot when it is *commanded* — play, pause, seek, goToSlide — and not on a timer, so
 * anything that must react to time elapsing has to react here. Wave 2 wrote only style
 * properties from this loop, which meant an element entering at 500 ms never appeared
 * during playback: React had no reason to re-render, and an element with no node has
 * nothing for the writer to write to. Every player test drove `seek()`, which does emit, so
 * the one path a learner takes was the one path untested.
 *
 * `onFrame` is held in a ref rather than listed as a dependency. A callback that changed
 * identity per render would tear the loop down and rebuild it every render, which is both
 * wasteful and a way to drop frames at exactly the moments React is busiest.
 */
export function useFrameLoop(
  transport: Transport | null,
  writer: FrameWriter,
  resolveAt: (slideTimeMs: number) => RenderState,
  onFrame?: (state: RenderState, slideTimeMs: number) => void,
): void {
  const latest = useRef(onFrame)
  latest.current = onFrame

  useEffect(() => {
    if (!transport) return
    let frame = 0
    let cancelled = false

    const tick = (): void => {
      if (cancelled) return
      const slideTimeMs = transport.slideTimeMs
      const state = resolveAt(slideTimeMs)
      writer.write(state)
      latest.current?.(state, slideTimeMs)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [transport, writer, resolveAt])
}
