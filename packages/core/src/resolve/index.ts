import type { Element, Slide } from '@cuestack/schema'
import { builtinEffects } from '../effects/builtin/index.js'
import { createEffectRegistry, type EffectRegistry } from '../effects/registry.js'
import { createElementRegistry, type ElementRegistry } from '../elements/registry.js'
import type { ThemeValues } from '../elements/contract.js'
import { resolveElement } from './element.js'
import { collectProblems } from './problems.js'
import { builtinElements } from '../elements/builtin/index.js'
import type { BlockingProblem, RenderProblem, RenderState, ResolvedElement } from './state.js'

export interface ResolveContext {
  readonly effects?: EffectRegistry
  readonly elements?: ElementRegistry
  readonly theme?: ThemeValues
}

const DEFAULT_EFFECTS = createEffectRegistry(builtinEffects)
/**
 * The seven MVP types, registered by default (feature 009).
 *
 * Two consequences worth knowing before changing this line.
 *
 * **`assertComplete` runs here, at module scope, and throws.** A malformed builtin therefore fails
 * the *import* of `@cuestack/core` rather than a test. That is the right trade — a missing
 * `validate` on a builtin is exactly what PB-1 exists to stop passing silently — and it is a new
 * failure mode for the package, so it is written down (research R-15).
 *
 * **It turns off the empty-registry escape.** `resolveElement` treats `types().length === 0` as
 * "everything is known", so before this line no element type was ever reported unknown. Now an
 * unregistered eighth type is — which is correct, and is why a host supplying its own registry must
 * compose `createElementRegistry([...builtinElements, mine])` rather than replacing these.
 */
const DEFAULT_ELEMENTS = createElementRegistry(builtinElements)
const EMPTY_THEME: ThemeValues = Object.freeze({})

/**
 * The complete appearance of one slide at one time.
 *
 * A fold, not a state machine: every effect active at `timeMs` is evaluated and
 * the results composed. Nothing accumulates between calls, so there is no state to
 * get out of sync, no replay path, and no difference between "played to 5000ms"
 * and "asked for 5000ms". That one property is what makes seeking correct
 * (FR-004), server rendering possible (FR-003), and editor-player parity
 * structural rather than aspirational (Constitution V).
 *
 * Pure. No clock, no randomness, no environment. Never throws for a schema-valid
 * slide, and returns a valid state for any finite time — including negative ones
 * and times past the slide's end.
 */
export function resolve(slide: Slide, timeMs: number, context?: ResolveContext): RenderState {
  const effects = context?.effects ?? DEFAULT_EFFECTS
  const elements = context?.elements ?? DEFAULT_ELEMENTS
  const theme = context?.theme ?? EMPTY_THEME

  const resolved: Array<{ element: ResolvedElement; index: number }> = []
  const problems: RenderProblem[] = [...collectProblems(slide)]
  let blocked: BlockingProblem | null = null

  ;(slide.elements as readonly Element[]).forEach((element, index) => {
    const outcome = resolveElement(element, timeMs, effects, elements, theme)
    problems.push(...outcome.problems)
    if (outcome.blockingUnknownRequired && !blocked) {
      blocked = {
        code: 'UNKNOWN_REQUIRED_INTERACTION',
        elementId: element.id,
        message:
          `Required interaction "${element.id}" has type "${outcome.blockingUnknownRequired}", ` +
          'which is not registered. Playback is blocked rather than skipping a question that ' +
          'gates progression, because skipping it would strand the learner.',
      }
    }
    if (outcome.element) resolved.push({ element: outcome.element, index })
  })

  // Paint order, resolved once here so two consumers cannot sort differently.
  // Array position breaks ties, keeping equal zIndex deterministic.
  resolved.sort((a, b) => a.element.zIndex - b.element.zIndex || a.index - b.index)

  return {
    slideId: slide.id,
    timeMs,
    elements: resolved.map((r) => r.element),
    problems,
    blocked,
  }
}
