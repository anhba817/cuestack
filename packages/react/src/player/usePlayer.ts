import { createContext, useContext } from 'react'
import type { Transport } from '@cuestack/core'

export interface PlayerContextValue {
  readonly transport: Transport
  /**
   * The current slide's authored duration.
   *
   * Here rather than on the transport's snapshot because it is authored, not computed — it
   * does not change as time passes, and putting it in a per-tick snapshot would imply it
   * might. Controls need it to bound a seek, and they have no lesson to read it from.
   */
  readonly slideDurationMs: number
}

export const PlayerContext = createContext<PlayerContextValue | null>(null)

/**
 * The kernel's transport, unwrapped.
 *
 * Deliberately not a facade: a host driving playback and the player itself must not be
 * able to hold different ideas of the current time, and the surest way to guarantee
 * that is for there to be one object.
 */
export function usePlayer(): PlayerContextValue {
  const value = useContext(PlayerContext)
  if (!value) {
    throw new Error(
      'usePlayer must be called inside a <LessonPlayer>. Outside one there is no ' +
        'transport, and returning a null one would move this error to a confusing place.',
    )
  }
  return value
}
