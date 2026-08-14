import { useEffect } from 'react'
import type { RenderState, Transport } from '@cuestack/core'
import type { FrameWriter } from './FrameWriter.js'

/**
 * Drive the writer from animation frames while playback is running.
 *
 * Client-only by construction — this module is reached from the client entry alone,
 * and the effect never runs on a server because effects do not.
 */
export function useFrameLoop(
  transport: Transport | null,
  writer: FrameWriter,
  resolveAt: (slideTimeMs: number) => RenderState,
): void {
  useEffect(() => {
    if (!transport) return
    let frame = 0
    let cancelled = false

    const tick = (): void => {
      if (cancelled) return
      writer.write(resolveAt(transport.slideTimeMs))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [transport, writer, resolveAt])
}
