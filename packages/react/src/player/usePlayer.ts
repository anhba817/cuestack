import { createContext, useContext } from 'react'
import type { Transport } from '@cuestack/core'

export interface PlayerContextValue {
  /**
   * Null until the player has mounted.
   *
   * Nullable because it is genuinely absent: the transport is created in a mount effect, so
   * there is none during a server render or during the hydration pass. A non-nullable type
   * here was a lie that made `usePlayer()` throw for *any* child on its first render — the
   * documented way for a host to drive playback, unusable by the hosts it is for.
   *
   * Callers check it. That is the honest shape, and it is what the controls were already
   * doing by reaching around the hook.
   */
  readonly transport: Transport | null
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
 *
 * Throws outside a `<LessonPlayer>`, which is a programming error and worth failing loudly
 * for. Inside one it always succeeds, including before mount — the transport is then null,
 * and the caller checks. The distinction matters: "you are not in a player" is a mistake,
 * "the player has not mounted yet" is a moment every host passes through.
 */
export function usePlayer(): PlayerContextValue {
  const value = useContext(PlayerContext)
  if (!value) {
    throw new Error(
      'usePlayer must be called inside a <LessonPlayer>. Outside one there is no player ' +
        'at all, which is a different thing from a player that has not mounted — inside ' +
        'one this returns a null transport until it has.',
    )
  }
  return value
}
