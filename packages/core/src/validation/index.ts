import type { Element, LessonManifest, Slide } from '@cuestack/schema'
import { validate, type IssueLocation } from '@cuestack/schema/validate'
import { checkReachability } from '../advance/reachability.js'
import { builtinElements } from '../elements/builtin/index.js'
import type { PluginIssue } from '../elements/contract.js'
import { createElementRegistry, type ElementRegistry } from '../elements/registry.js'
import { createEffectRegistry, type EffectRegistry } from '../effects/registry.js'
import { builtinEffects } from '../effects/builtin/index.js'
import { isDeadEnd } from '../interactions/policy.js'
import { resolveElement } from '../resolve/element.js'
import { collectProblems } from '../resolve/problems.js'
import { accessibilityIssues } from './accessibility.js'
import type { IssueSource, Severity } from './codes.js'
import { severityFor, type ValidationPolicy } from './severity.js'

export { SEMANTIC_CODES, type SemanticCode, type IssueSource, type Severity } from './codes.js'
export { severityFor, type ValidationPolicy } from './severity.js'
export {
  collectAssetRefs,
  checkAssets,
  type AssetRef,
  type UnresolvedAsset,
} from './assets.js'
export { accessibilityIssues } from './accessibility.js'

export interface ReportIssue {
  readonly source: IssueSource
  readonly code: string
  readonly severity: Severity
  readonly message: string
  readonly path: readonly (string | number)[]
  readonly location: IssueLocation
}

export interface ValidationReport {
  readonly issues: readonly ReportIssue[]
  /** True when any issue is an error. Derived, and carried so every caller derives it the same way. */
  readonly blocks: boolean
}

export interface CheckOptions {
  readonly elements?: ElementRegistry
  readonly effects?: EffectRegistry
  readonly policy?: ValidationPolicy
}

/**
 * Everything a caller can ask about a lesson that does not require asking the outside world.
 *
 * **This function owns one rule and arranges six.** The schema says whether it is structurally a
 * lesson; `checkReachability` says whether a slide can advance; `collectProblems` says what runs
 * past its slide; `resolveElement` says which types this registry has never heard of;
 * `ElementPlugin.validate` says what each type thinks of its own payload; and `accessibilityIssues`
 * reads the common field a plugin cannot see. Only the static dead end is new, and even that is
 * delegated to `isDeadEnd` beside the runtime predicate it mirrors.
 *
 * That restraint is the point. The repository already held three validators, two of which overlap,
 * and the way this feature fails is by becoming the fourth — an engine with its own copy of the
 * advance rules would drift from the player, and a report that disagrees with the thing it
 * describes is worse than no report.
 *
 * **Pure and deterministic** (FR-007): no clock, no network, no DOM, and the same inputs produce
 * the same issues in the same order. The one question that needs the outside world — whether an
 * asset exists — is `checkAssets`, deliberately not called from here (FR-016a).
 *
 * **Non-destructive** (FR-012): the manifest is read and never written, and nothing in the report
 * holds a reference through which a caller could reach back into it.
 */
export function checkLesson(input: unknown, options?: CheckOptions): ValidationReport {
  const policy = options?.policy
  const elements = options?.elements ?? createElementRegistry(builtinElements)
  const effects = options?.effects ?? createEffectRegistry(builtinEffects)

  const structural = validate(input)
  const issues: ReportIssue[] = structural.ok
    ? []
    : structural.issues.map((issue) => ({
        source: 'schema' as const,
        code: issue.code,
        severity: severityFor(issue.code, 'schema', policy),
        message: issue.message,
        path: issue.path,
        location: issue.location,
      }))

  /**
   * **The semantic tier runs even when the schema tier failed**, on whatever the input turned out
   * to be. FR-001 asks for every issue in one pass, and stopping here would cost more than a few
   * lines of the report: an element type the format has never heard of fails the schema's closed
   * union, so short-circuiting would make every *plugin's* opinion of a third-party type
   * unreachable through this function — the seam this feature exists to connect.
   *
   * The two tiers reporting the same element is not duplication, it is why every issue carries a
   * `source`. `UNKNOWN_ELEMENT_TYPE` means "no such type in the format" from one and "no such type
   * in this registry" from the other, and an author needs to be told which.
   */
  const lesson = (structural.ok ? structural.lesson : input) as unknown as LessonManifest
  if (!Array.isArray((lesson as { slides?: unknown })?.slides)) return report(issues)


  lesson.slides.forEach((slide, slideIndex) => {
    /**
     * A slide the schema rejected may be missing anything, and the semantic rules are total
     * functions over well-formed slides rather than over arbitrary objects. One that cannot be
     * walked is skipped rather than allowed to end the run: the schema tier has already said what
     * is wrong with it, and losing the other fifty-nine slides' issues to it would be the
     * disappearing report §3.6 forbids for plugins, arriving by a different door.
     */
    try {
      checkSlide(slide as Slide, slideIndex, issues, elements, effects, policy)
    } catch {
      /* v8 ignore next -- only reachable from a slide the schema tier has already rejected */
    }
  })

  return report(issues)
}

function checkSlide(
  slide: Slide,
  slideIndex: number,
  issues: ReportIssue[],
  elements: ElementRegistry,
  effects: EffectRegistry,
  policy: ValidationPolicy | undefined,
): void {
  {
    const at = (element?: Element, elementIndex?: number): IssueLocation => ({
      slideId: slide.id,
      slideIndex,
      ...(element ? { elementId: element.id } : {}),
      ...(elementIndex === undefined ? {} : { elementIndex }),
    })
    const pathTo = (elementIndex?: number): readonly (string | number)[] =>
      elementIndex === undefined
        ? ['slides', slideIndex]
        : ['slides', slideIndex, 'elements', elementIndex]

    // Slide-level first: whether this slide can be left at all outranks anything on it.
    // `checkReachability` answers with at most one problem per slide, which the contract states
    // rather than works around — reaching past it would give this engine its own advance rules.
    const unreachable = checkReachability(slide)
    if (unreachable) {
      issues.push(
        semantic(unreachable.code, unreachable.message, pathTo(), at(), policy, unreachable.elementId),
      )
    }

    // `collectProblems` walks the whole slide, so its findings are indexed back onto elements to
    // keep the report in document order (FR-007) rather than in the order that walk happened to run.
    const overruns = new Map<string, { code: string; message: string }[]>()
    for (const problem of collectProblems(slide)) {
      const key = problem.elementId ?? ''
      const list = overruns.get(key) ?? []
      list.push({ code: problem.code, message: problem.message })
      overruns.set(key, list)
    }

    ;(slide.elements as readonly Element[]).forEach((element, elementIndex) => {
      const path = pathTo(elementIndex)
      const location = at(element, elementIndex)
      const push = (code: string, message: string, source: IssueSource = 'semantic'): void => {
        issues.push({
          source,
          code,
          severity: severityFor(code, source, policy),
          message,
          path,
          location,
        })
      }

      for (const overrun of overruns.get(element.id) ?? []) push(overrun.code, overrun.message)

      /**
       * Unknown types come from the resolver rather than from a second registry lookup here,
       * so "unknown" means in validation exactly what it means in playback — including the
       * asymmetry FR-027/028 requires, where an unregistered decoration is a problem and an
       * unregistered *required question* is a lesson nobody can finish.
       *
       * Resolved at the element's own start, the one instant every element is on screen.
       */
      const resolution = resolveElement(element, element.startMs, effects, elements, {})
      for (const problem of resolution.problems) push(problem.code, problem.message)
      if (resolution.blockingUnknownRequired !== null) {
        push(
          'UNKNOWN_REQUIRED_INTERACTION',
          `"${element.id}" is a required question of type "${element.type}", which is not ` +
            'registered. A learner would be asked to complete something that cannot be shown, so ' +
            'the slide could never be left. Register the type or make the question optional.',
        )
      }

      for (const issue of pluginIssues(element, elements)) {
        push(issue.code, issue.message, issue.code === 'PLUGIN_VALIDATE_FAILED' ? 'semantic' : 'plugin')
      }

      for (const issue of accessibilityIssues(element)) push(issue.code, issue.message)

      const payload = element.payload as
        | { required?: unknown; completionPolicy?: unknown; maxAttempts?: unknown }
        | undefined
      if (
        element.type === 'question' &&
        payload?.required === true &&
        isDeadEnd(
          payload.completionPolicy as Parameters<typeof isDeadEnd>[0],
          payload.maxAttempts as number | undefined,
        )
      ) {
        push(
          'QUESTION_DEAD_END',
          `"${element.id}" must be answered correctly within ${String(payload.maxAttempts)} ` +
            'attempt(s), and the slide cannot be left until it is. A learner who runs out is ' +
            'stuck. Raise the attempts, remove the cap, or let the question complete on any answer.',
        )
      }
    })
  }
}

/**
 * A plugin's own opinion of its payload, and its failure to have one.
 *
 * A plugin that throws costs its own element's checks and nothing else (contract §3.6). The
 * alternative — letting it escape — means an author with one broken plugin loses the whole report
 * and every issue they could have acted on with it.
 */
function pluginIssues(element: Element, elements: ElementRegistry): readonly PluginIssue[] {
  const plugin = elements.get(element.type)
  if (!plugin?.validate) return []
  try {
    return plugin.validate(element.payload)
  } catch (cause) {
    return [
      {
        code: 'PLUGIN_VALIDATE_FAILED',
        message:
          `The "${element.type}" element type could not check "${element.id}": ` +
          `${cause instanceof Error ? cause.message : String(cause)}. Everything else in this ` +
          'lesson was still checked, but this element was not.',
      },
    ]
  }
}

function semantic(
  code: string,
  message: string,
  path: readonly (string | number)[],
  location: IssueLocation,
  policy: ValidationPolicy | undefined,
  elementId?: string,
): ReportIssue {
  return {
    source: 'semantic',
    code,
    severity: severityFor(code, 'semantic', policy),
    message,
    path,
    location: elementId ? { ...location, elementId } : location,
  }
}

function report(issues: readonly ReportIssue[]): ValidationReport {
  return { issues, blocks: issues.some((issue) => issue.severity === 'error') }
}

/**
 * The asset pass folded back in, for a caller that ran it.
 *
 * A separate function rather than an option on `checkLesson`, because the engine's purity is the
 * property that makes it trustworthy and an optional `await` inside it would end that quietly. A
 * caller that cannot afford the round trip skips this and keeps every other issue (FR-016a).
 */
export function withAssetIssues(
  base: ValidationReport,
  unresolved: readonly { assetId: string; slideId: string; elementId: string; message: string }[],
  policy?: ValidationPolicy,
): ValidationReport {
  if (unresolved.length === 0) return base
  return report([
    ...base.issues,
    ...unresolved.map((entry) => ({
      source: 'semantic' as const,
      code: 'ASSET_UNRESOLVED',
      severity: severityFor('ASSET_UNRESOLVED', 'semantic', policy),
      message: entry.message,
      path: ['slides'] as readonly (string | number)[],
      location: { slideId: entry.slideId, elementId: entry.elementId },
    })),
  ])
}
