import type { Effect, Element } from '@cuestack/schema'
import { applyEasing } from '../effects/easing.js'
import type { EffectRegistry } from '../effects/registry.js'
import type { ElementRegistry } from '../elements/registry.js'
import type { ThemeValues } from '../elements/contract.js'
import { composeContributions } from './compose.js'
import type { Contribution } from './contribution.js'
import type { ActiveEffect, RenderProblem, ResolvedElement } from './state.js'

export interface ElementResolution {
  readonly element: ResolvedElement | null
  readonly problems: readonly RenderProblem[]
  readonly blockingUnknownRequired: string | null
}

/** FR-010: a stable order for effects sharing a start time. Commutative
 *  composition makes this unobservable in the visual result, which is exactly why
 *  the order is asserted directly in the tests. */
function byStartThenOrder(a: Effect, b: Effect): number {
  return a.startMs - b.startMs || a.order - b.order
}

function isRequiredInteraction(element: Element): boolean {
  const payload = element.payload as { required?: unknown } | undefined
  return element.type === 'question' && payload?.required === true
}

export function resolveElement(
  element: Element,
  slideTimeMs: number,
  effects: EffectRegistry,
  elements: ElementRegistry,
  theme: ThemeValues,
): ElementResolution {
  const problems: RenderProblem[] = []

  // BR-010: hidden elements stay in the definition and out of the render state.
  if (element.hidden === true) {
    return { element: null, problems, blockingUnknownRequired: null }
  }

  // Half-open window: adjacent elements never both show at the boundary.
  const visible = slideTimeMs >= element.startMs && slideTimeMs < element.endMs
  if (!visible) {
    return { element: null, problems, blockingUnknownRequired: null }
  }

  const plugin = elements.get(element.type)
  const known = plugin !== undefined || elements.types().length === 0
  if (plugin === undefined && elements.types().length > 0) {
    // FR-027/028: the asymmetry is the requirement. Losing a decoration and
    // stranding a learner on an unanswerable question are not comparable.
    if (isRequiredInteraction(element)) {
      return { element: null, problems, blockingUnknownRequired: element.type }
    }
    problems.push({
      code: 'UNKNOWN_ELEMENT_TYPE',
      elementId: element.id,
      message:
        `Element type "${element.type}" is not registered. The element is reported as ` +
        'unavailable and the rest of the slide still resolves.',
    })
  }

  const active: ActiveEffect[] = []
  const contributions: Contribution[] = []
  /**
   * The same contributions, with each *moving* effect replaced by its reduced alternative.
   *
   * Collected alongside rather than derived afterwards, because only this loop knows which
   * descriptor produced which contribution. `anyMotion` records whether the two can differ
   * at all — when nothing moving is active they are identical, and emitting a second copy
   * would double what the frame writer writes for no gain.
   */
  const reducedContributions: Contribution[] = []
  let anyMotion = false

  for (const effect of [...(element.effects ?? [])].sort(byStartThenOrder)) {
    const descriptor = effects.get(effect.type)
    if (!descriptor) {
      problems.push({
        code: 'UNKNOWN_EFFECT_TYPE',
        elementId: element.id,
        effectId: effect.id,
        message: `Effect type "${effect.type}" is not registered; it contributes nothing.`,
      })
      continue
    }

    const endMs = effect.startMs + effect.durationMs
    if (slideTimeMs < effect.startMs) continue

    if (slideTimeMs >= endMs) {
      // A completed effect still contributes its final value — an element that
      // faded in stays visible rather than reverting when the effect ends.
      //
      // Its *reduced* final value is the same one: FR-026 requires the substitution to reach
      // its end state at the same moment, so once both have finished there is nothing left
      // to distinguish. A finished slide-in and a finished fade both leave the element where
      // the author put it.
      const settled = descriptor.at(1, effect.parameters)
      contributions.push(settled)
      reducedContributions.push(settled)
      continue
    }

    const raw = (slideTimeMs - effect.startMs) / effect.durationMs
    const progress = applyEasing(raw, effect.easing ?? descriptor.defaultEasing)
    contributions.push(descriptor.at(progress, effect.parameters))

    /**
     * The reduced alternative, or the blunt floor.
     *
     * A moving effect with no declared substitution falls back to `{}` — no contribution at
     * all, so the element sits at its authored state. That is Wave 2's behaviour, kept for
     * an effect whose author has not thought about this, rather than being an error that
     * would block registering a third-party effect over a refinement.
     */
    if (descriptor.motion) {
      anyMotion = true
      reducedContributions.push(descriptor.reduced?.(progress, effect.parameters) ?? {})
    } else {
      reducedContributions.push(descriptor.at(progress, effect.parameters))
    }

    active.push({
      id: effect.id,
      type: effect.type,
      phase: effect.phase,
      progress,
      motion: descriptor.motion,
    })
  }

  // An element whose enter effect has not started yet should not be shown at the
  // effect's opening value by accident, so entrance effects gate visibility.
  const composed = composeContributions(contributions)
  const composedReduced = anyMotion ? composeContributions(reducedContributions) : null

  let pluginContribution: Contribution | undefined
  let pluginVisible = true
  if (plugin) {
    const outcome = plugin.resolve({
      payload: element.payload,
      geometry: {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation ?? 0,
      },
      slideTimeMs,
      theme,
    })
    pluginVisible = outcome.visible
    pluginContribution = outcome.contribution
    for (const issue of outcome.problems ?? []) {
      problems.push({
        code: 'UNKNOWN_ELEMENT_TYPE',
        elementId: element.id,
        message: `${issue.code}: ${issue.message}`,
      })
    }
  }

  if (!pluginVisible) return { element: null, problems, blockingUnknownRequired: null }

  const final = pluginContribution
    ? composeContributions([...contributions, pluginContribution])
    : composed

  return {
    element: {
      id: element.id,
      type: element.type,
      geometry: {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation ?? 0,
      },
      zIndex: element.zIndex,
      opacity: final.opacity,
      transform: final.transform,
      filter: final.filter,
      activeEffects: active,
      /**
       * The reduced visual, present only when a moving effect is active.
       *
       * Null the rest of the time, which is the common case: an element at rest, or one
       * whose only effect is a fade, looks identical under either preference. The renderer
       * skips the second property set entirely when this is null, which bounds the cost of
       * emitting two answers to the frames where they can actually differ.
       */
      reduced: composedReduced
        ? {
            opacity: composedReduced.opacity,
            transform: composedReduced.transform,
            filter: composedReduced.filter,
          }
        : null,
      payload: element.payload,
      // Passed through, never defaulted. An absent block and an empty one mean different
      // things to a renderer: "the author said nothing" versus "the author said none".
      accessibility: element.accessibility ?? null,
      available: known,
    },
    problems,
    blockingUnknownRequired: null,
  }
}
