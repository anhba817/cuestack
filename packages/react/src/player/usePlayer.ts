import { createContext, useContext } from 'react'
import type { Transport } from '@cuestack/core'

export interface PlayerContextValue {
  readonly transport: Transport
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
