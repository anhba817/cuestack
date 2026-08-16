import type { Element, LessonManifest } from '@cuestack/schema'
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
] as const

export type EditKind = (typeof EDIT_KINDS)[number]

export type AlignEdge = 'left' | 'right' | 'top' | 'bottom' | 'centre-x' | 'centre-y'
export type DistributeAxis = 'horizontal' | 'vertical'

export type Edit =
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
