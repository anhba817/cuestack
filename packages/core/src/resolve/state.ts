import type { FilterDelta, TransformDelta } from './contribution.js'

/**
 * Computed data, not authored data.
 *
 * A manifest says what an author intended; a RenderState says what is true at one
 * instant. Keeping the two in separate shapes is what lets resolve() be pure —
 * it reads intent and returns truth, and neither leaks into the other.
 */

export interface ResolvedGeometry {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly rotation: number
}

export interface ActiveEffect {
  readonly id: string
  readonly type: string
  readonly phase: 'enter' | 'emphasis' | 'exit'
  /** Eased progress at the resolved time, not raw linear position. */
  readonly progress: number
  /** Whether this effect moves things — what a consumer needs for reduced motion. */
  readonly motion: boolean
}

export interface ResolvedElement {
  readonly id: string
  readonly type: string
  /** Authored position and size. Effects do NOT mutate this. */
  readonly geometry: ResolvedGeometry
  readonly zIndex: number
  readonly opacity: number
  /**
   * Composed offsets, kept separate from geometry: an element translated 40px by
   * a slide-in is still *authored* where it was, and the editor needs to show the
   * authored value while the player needs the effective one.
   */
  readonly transform: TransformDelta
  readonly filter: FilterDelta | null
  readonly activeEffects: readonly ActiveEffect[]
  readonly payload: unknown
  /**
   * Authored accessibility metadata, passed through untouched.
   *
   * Added in Wave 2, which found it missing: a renderer receives only a
   * `ResolvedElement`, and FR-015 requires it to expose an image's alternative text.
   * Without this the alt text was in the manifest and unreachable by the one component
   * that needs it, so a renderer would have had to be handed the lesson — the exact
   * coupling the contract exists to prevent.
   *
   * Authored and static, like `payload`, so it does not compromise purity: nothing here
   * varies with time.
   */
  readonly accessibility: ElementAccessibility | null
  /** False when the element's type is not registered (FR-027). */
  readonly available: boolean
}

export interface ElementAccessibility {
  readonly altText?: string
  readonly label?: string
  readonly hidden?: boolean
}

export interface RenderProblem {
  readonly code:
    | 'EFFECT_BEYOND_SLIDE'
    | 'ELEMENT_BEYOND_SLIDE'
    | 'UNKNOWN_ELEMENT_TYPE'
    | 'UNKNOWN_EFFECT_TYPE'
  readonly elementId?: string
  readonly effectId?: string
  readonly message: string
}

export interface BlockingProblem {
  readonly code:
    | 'UNKNOWN_REQUIRED_INTERACTION'
    | 'ADVANCE_UNSATISFIABLE'
    | 'ADVANCE_MEDIA_FAILED'
  readonly elementId?: string
  readonly message: string
}

export interface RenderState {
  readonly slideId: string
  readonly timeMs: number
  /** Visible elements only, already in paint order. Consumers must not re-sort. */
  readonly elements: readonly ResolvedElement[]
  readonly problems: readonly RenderProblem[]
  readonly blocked: BlockingProblem | null
}
