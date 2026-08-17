import type { Element } from '@cuestack/schema'
import type { EffectDescriptor } from '@cuestack/core'
import { DEFAULT_EFFECT_DURATION_MS, MIN_EFFECT_DURATION_MS } from '../timeline/constants.js'

export interface NewEffectDraft {
  readonly type: string
  readonly phase: string
  readonly startMs: number
  readonly durationMs: number
  readonly easing: string
  readonly order: number
}

/**
 * A new effect, born valid.
 *
 * The same promise `elements/defaults.ts` makes for a new element, and it is what keeps
 * FR-041 true without the reducer having to repair anything: everything the schema requires
 * is present, and everything the descriptor declares is respected.
 *
 * **The window clamp is a default, not an invariant.** A teacher adding an effect almost
 * always means it to run while the element is on screen, so the start is placed inside the
 * element's window. `set-effect` does *not* clamp: an effect that runs after its element has
 * gone is authorable — `Effect.startMs` is slide time, not element time — and the timeline is
 * required to say it would never run rather than to prevent it. Copying this clamp into the
 * reducer would make that edge case unreachable.
 */
export function newEffect(
  element: Element,
  descriptor: EffectDescriptor,
  atMs: number,
  existing: readonly { startMs: number; order: number }[] = [],
): NewEffectDraft {
  const el = element as unknown as { startMs: number; endMs: number }

  // Inside the element's window, and never so late that the effect could not finish there.
  const latest = Math.max(el.startMs, el.endMs - DEFAULT_EFFECT_DURATION_MS)
  const startMs = Math.round(Math.min(Math.max(atMs, el.startMs), latest))

  // Last among effects sharing this start. `Effect.order` is stored explicitly rather than
  // inferred from array position, so a resolver bug cannot be masked by an incidental sort.
  const sharing = existing.filter((e) => e.startMs === startMs)
  const order = sharing.length === 0 ? 0 : Math.max(...sharing.map((e) => e.order)) + 1

  return {
    type: descriptor.type,
    // The first phase the effect declares. `pulse` declares `emphasis` alone, so offering it
    // as an entrance would be offering something the effect does not do.
    phase: descriptor.phases[0]!,
    startMs,
    durationMs: Math.max(MIN_EFFECT_DURATION_MS, DEFAULT_EFFECT_DURATION_MS),
    easing: descriptor.defaultEasing,
    order,
  }
}
