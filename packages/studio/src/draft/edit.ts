import type { Element, LessonManifest } from '@cuestack/schema'
import type { EffectPhase } from '@cuestack/core'
import type { GeometryDelta } from '../geometry/types.js'
import type { AnalyticsAdapter } from '@cuestack/core'
import type { IdSource } from './ids.js'

/**
 * Every change a teacher can make to the draft, as one closed union.
 *
 * Closed on purpose. `EDIT_KINDS` below is what the read-only suite enumerates, so a variant
 * added later is refused-by-default in read-only mode *and* fails a test until someone says
 * so deliberately (SC-017). A union that grew informally would let the guarantee narrow to
 * "the variants that existed when the test was written".
 *
 * **Copy is not here.** It writes to `session.clipboard` and changes no authored data, so it
 * never reaches the reducer — which is precisely why read-only permits copying while
 * refusing paste (FR-051, contracts/edit-contract.md).
 */
export const EDIT_KINDS = [
  'add-element',
  'transform-elements',
  'set-field',
  'set-slide-field',
  'set-text',
  'reorder',
  'set-flag',
  'duplicate',
  'paste',
  'delete',
  'align',
  'distribute',
  // Feature 006: timing becomes editable. Same closure guarantee as the twelve above.
  'set-timing',
  'add-effect',
  'set-effect',
  'remove-effect',
  'apply-sequence',
  'extend-slide',
  /**
   * Feature 008: restoring an earlier version.
   *
   * A kind rather than a session method, and the difference is four guarantees. `applyEdit`
   * holds the read-only refusal, the schema validation, the purity, and the clone; a method
   * beside it inherits none of them — on the one input in this system that did not come from
   * the editor's own reducer (research R-12).
   *
   * Being in this list also puts it inside feature 005's closure guarantee: the read-only
   * suite enumerates `EDIT_KINDS`, so it is refused-by-default until somebody says otherwise
   * deliberately.
   */
  'replace-draft',
] as const

export type EditKind = (typeof EDIT_KINDS)[number]

export type AlignEdge = 'left' | 'right' | 'top' | 'bottom' | 'centre-x' | 'centre-y'
export type DistributeAxis = 'horizontal' | 'vertical'

/** What `set-effect` may change. Every field optional; the absent ones are left alone. */
export interface EffectPatch {
  readonly startMs?: number
  readonly durationMs?: number
  readonly phase?: EffectPhase
  readonly easing?: string
  /** Flat keys, as declared by the effect's `EffectDescriptor.parameters`. */
  readonly parameters?: Readonly<Record<string, string | number | boolean>>
}

/**
 * One event's relationship to the one before it.
 *
 * Derived from absolute times and never stored — Constitution III forbids mode-specific
 * storage, so this type exists to *apply* a classification, not to persist one.
 */
export type SequenceRelationship =
  | { readonly kind: 'with-previous' }
  | { readonly kind: 'after-previous' }
  | { readonly kind: 'after-previous-delay'; readonly delayMs: number }
  | { readonly kind: 'custom' }
  | { readonly kind: 'first' }

export interface SequenceAssignment {
  readonly eventKey: string
  readonly relationship: SequenceRelationship
}

export type Edit =
  /**
   * Replace the whole draft with a lesson from storage.
   *
   * The manifest has already been brought to the current format by the persistence layer
   * (FR-050) — the validator here judges against the current schema, so an unmigrated old
   * version would be refused and the refusal would read as corruption.
   */
  | { readonly kind: 'replace-draft'; readonly manifest: LessonManifest }
  | { readonly kind: 'add-element'; readonly type: string; readonly at?: { x: number; y: number } }
  /**
   * `geometry` applies to every named element; `perId` overrides it for the ones listed.
   *
   * Both are needed and the second is not redundant. A single absolute geometry is right for
   * "put this element here" and for a whole selection landing on one edge, but it cannot
   * express a multiple-element *move*, where each member ends somewhere different while the
   * spacing between them is preserved (FR-003). data-model.md §3 says "geometry per id" for
   * exactly this reason; an earlier version of this type dropped it and the drag gesture had
   * nowhere to put its result.
   */
  | {
      readonly kind: 'transform-elements'
      readonly ids: readonly string[]
      readonly geometry: GeometryDelta
      readonly perId?: Readonly<Record<string, GeometryDelta>>
    }
  | { readonly kind: 'set-field'; readonly id: string; readonly path: readonly string[]; readonly value: unknown }
  | { readonly kind: 'set-slide-field'; readonly path: readonly string[]; readonly value: unknown }
  | { readonly kind: 'set-text'; readonly id: string; readonly text: string }
  | { readonly kind: 'reorder'; readonly ids: readonly string[]; readonly direction: 'forward' | 'backward' }
  | { readonly kind: 'set-flag'; readonly ids: readonly string[]; readonly flag: 'locked' | 'hidden'; readonly value: boolean }
  | { readonly kind: 'duplicate'; readonly ids: readonly string[] }
  | { readonly kind: 'paste'; readonly elements: readonly Element[] }
  | { readonly kind: 'delete'; readonly ids: readonly string[] }
  | { readonly kind: 'align'; readonly ids: readonly string[]; readonly edge: AlignEdge }
  | { readonly kind: 'distribute'; readonly ids: readonly string[]; readonly axis: DistributeAxis }
  /**
   * A single `id`, not an array.
   *
   * Multi-select timing edits are out of scope — "dragging re-times one element at a time".
   * Every other multiple-element kind above earned its array from a requirement; this one
   * has not, and a plural signature would be the editor quietly growing an affordance no
   * test covers.
   */
  | { readonly kind: 'set-timing'; readonly id: string; readonly startMs?: number; readonly endMs?: number }
  | {
      readonly kind: 'add-effect'
      readonly id: string
      readonly type: string
      readonly phase: EffectPhase
      readonly startMs: number
      readonly durationMs: number
    }
  | { readonly kind: 'set-effect'; readonly id: string; readonly effectId: string; readonly patch: EffectPatch }
  | { readonly kind: 'remove-effect'; readonly id: string; readonly effectId: string }
  /**
   * `eventKey` is `elementId`, or `elementId + ':' + effectId` for an effect event.
   *
   * Derived, because an event has no id of its own and minting one would be storage — which
   * Constitution III forbids for Simple Sequence outright (FR-029).
   */
  | { readonly kind: 'apply-sequence'; readonly relationships: readonly SequenceAssignment[] }
  /**
   * No target: the reducer computes it from the draft.
   *
   * FR-038 is an *offer with a computed duration*, so the surface must not be able to supply
   * a different number than the one the overrun implies.
   */
  | { readonly kind: 'extend-slide' }

export type EditRefusal = 'read-only' | 'locked' | 'invalid' | 'not-found' | 'unsupported'

export type EditResult =
  | { readonly ok: true; readonly draft: LessonManifest; readonly idsCreated: readonly string[] }
  | {
      readonly ok: false
      readonly reason: EditRefusal
      readonly message: string
      readonly elementId?: string
    }

export interface EditContext {
  readonly mode: 'edit' | 'read-only'
  readonly nextId: IdSource
  /** Which slide the edit applies to. Defaults to the first. */
  readonly slideId?: string
  /**
   * Optional, and fire-and-forget by contract: `record` returns void and never throws, so
   * analytics cannot stall or fail an edit. `LessonEvent` has no field a learner identifier
   * could occupy, which is how FR-AN-004's privacy clause holds by construction rather than
   * by review (FR-048).
   */
  readonly analytics?: AnalyticsAdapter
}
