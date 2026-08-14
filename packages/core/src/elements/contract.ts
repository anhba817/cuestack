import type { Contribution } from '../resolve/contribution.js'
import type { ResolvedGeometry } from '../resolve/state.js'

export interface ThemeValues {
  readonly [token: string]: string | number
}

/**
 * Everything a plugin receives — and this is the complete list.
 *
 * A plugin never gets the lesson, the slide, its siblings, the transport, or
 * anything describing the learner (FR-029). Enforced by the signature rather than
 * by documentation: there is nowhere to reach for the data. The restriction is not
 * about trust — a plugin *able* to read the whole lesson becomes one that does,
 * and then the lesson shape cannot change without breaking third-party code.
 */
export interface ElementResolveInput<TPayload = unknown> {
  readonly payload: TPayload
  readonly geometry: ResolvedGeometry
  readonly slideTimeMs: number
  readonly theme: ThemeValues
}

export interface PluginIssue {
  readonly code: string
  readonly message: string
}

export interface ElementContribution {
  readonly visible: boolean
  readonly contribution?: Contribution
  readonly problems?: readonly PluginIssue[]
}

export interface InspectorField {
  readonly key: string
  readonly label: string
  readonly kind: 'text' | 'number' | 'boolean' | 'select' | 'asset' | 'colour'
  readonly options?: readonly string[]
}

export interface InspectorSpec {
  readonly fields: readonly InspectorField[]
}

/**
 * The full element contract. All six members required.
 *
 * Not optional-with-defaults, deliberately: a plugin missing `inspector` is
 * invisible in the editor and one missing `validate` passes publication checks it
 * should fail. Both are discovered two waves later, by a teacher.
 */
export interface ElementPlugin<TPayload = unknown> {
  readonly type: string
  /** Structural check for this type's payload. */
  schema(payload: unknown): payload is TPayload
  resolve(input: ElementResolveInput<TPayload>): ElementContribution
  readonly inspector: InspectorSpec
  validate(payload: TPayload): readonly PluginIssue[]
  /**
   * The RenderState shape this plugin was built against. A plugin compiled for an
   * incompatible shape is refused at registration rather than composing a stale
   * contribution into a state that no longer means the same thing.
   */
  readonly renderStateVersion: number
}

/** Bumped when RenderState changes incompatibly. */
export const RENDER_STATE_VERSION = 1
