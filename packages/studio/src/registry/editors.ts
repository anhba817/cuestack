import { ELEMENT_TYPES } from '@cuestack/schema/validate'
import type { EditorField } from '../inspector/fields.js'

/**
 * The fifth member of FR-FWK-002's plugin contract, finally given a home.
 *
 * The constitution requires a plugin to supply a data schema, an editor component, a player
 * renderer, an inspector configuration, and a validator. `@cuestack/core` carries three;
 * Wave 2 put the player renderer in the React adapter; the editor component had nowhere to
 * live until this package existed. The split follows Wave 2's: core holds what is
 * framework-agnostic, adapters hold components.
 *
 * Note what remains unconsumed even now: `ElementPlugin.validate`. PB-1 owes it a consumer
 * (spec.md, Obligations).
 */

/** What a newly added element of this type starts as (FR-014). */
export interface ElementDefaults {
  /** Logical units. Position is the canvas's business, not the registration's. */
  readonly width: number
  readonly height: number
  readonly payload: unknown
}

/**
 * How this type's text is read and written on the canvas.
 *
 * Its *presence* is the answer to "is this type editable in place" (FR-015). The canvas asks
 * the registry; it never asks the element's type. A type that omits it is edited through the
 * inspector, which is the right outcome for an image or a shape and takes no code to express.
 *
 * `write` returns a new payload rather than mutating one: a registration cannot reach the
 * draft, so it cannot corrupt it.
 */
export interface TextSurface<TPayload = unknown> {
  read(payload: TPayload): string
  write(payload: TPayload, text: string): TPayload
}

export interface ElementEditor<TPayload = unknown> {
  readonly type: string
  readonly defaults: ElementDefaults
  readonly textSurface?: TextSurface<TPayload>
  /**
   * The type's own inspector fields, beyond the ones every element has.
   *
   * FR-018 says these come from "that type's registered plugin", and for a third-party type
   * they do: the inspector reads `ElementPlugin.inspector` from `@cuestack/core` first and
   * only falls back here. The fallback exists because **the seven built-in types have no
   * `ElementPlugin`** — they are handled by the schema's per-variant validation, by the
   * resolver's own path, and by the React renderer registry, and core's plugin registry is
   * empty by default.
   *
   * Authoring seven plugins to hold seven field lists was the alternative. It would mean
   * writing `schema`, `resolve`, and `validate` for types core already handles internally —
   * a second source of truth for what a text element is, which is a worse outcome than a
   * registry lookup with two places to look. Recorded in
   * contracts/element-editor-contract.md.
   */
  readonly inspector: readonly EditorField[]
}

export interface ElementEditorRegistry {
  get(type: string): ElementEditor | undefined
  has(type: string): boolean
  register(editor: ElementEditor): void
  types(): readonly string[]
}

const REQUIRED: ReadonlyArray<keyof ElementEditor> = ['type', 'defaults', 'inspector']

function assertComplete(editor: ElementEditor): void {
  const missing = REQUIRED.filter((key) => editor?.[key] === undefined)
  if (missing.length > 0) {
    throw new Error(
      `Element editor "${editor?.type ?? '<unnamed>'}" registration incomplete: missing ` +
        `${missing.join(', ')}. A type with no defaults cannot be added to a slide at all, and ` +
        'one with no inspector is invisible in the panel — both discovered by a teacher ' +
        'rather than by a test.',
    )
  }
}

export function createElementEditorRegistry(
  editors: readonly ElementEditor[] = [],
): ElementEditorRegistry {
  const map = new Map<string, ElementEditor>()
  for (const e of editors) {
    assertComplete(e)
    map.set(e.type, e)
  }
  return {
    get: (type) => map.get(type),
    has: (type) => map.has(type),
    register(editor) {
      assertComplete(editor)
      map.set(editor.type, editor)
    },
    types: () => [...map.keys()].sort(),
  }
}

/** An asset reference that is valid but resolves to nothing, so the player shows its gap. */
const PLACEHOLDER_ASSET = (mimeType: string) => ({ assetId: 'placeholder', mimeType })

/** Reads and writes `payload.text`. Shared by every type whose content is one string. */
function textAt<K extends string>(key: K): TextSurface<Record<string, unknown>> {
  return {
    read: (payload) => (typeof payload?.[key] === 'string' ? (payload[key] as string) : ''),
    write: (payload, text) => ({ ...payload, [key]: text }),
  }
}

/**
 * The seven MVP types (FR-CAN-001).
 *
 * Only `text` and `button` declare a text surface. A shape has no text; an image's
 * description is alt text and belongs in the inspector beside the rest of its accessibility
 * metadata, not floating over the picture; a question's prompt and options are a structure
 * rather than a string, which is what the inspector's `list` field kind is for.
 */
export const builtinElementEditors: readonly ElementEditor[] = [
  {
    type: 'text',
    defaults: { width: 600, height: 120, payload: { text: 'Text' } },
    textSurface: textAt('text') as TextSurface<unknown>,
    inspector: [{ key: 'payload.text', label: 'Text', kind: 'text' }],
  },
  {
    type: 'button',
    defaults: { width: 240, height: 80, payload: { label: 'Continue', action: 'next_slide' } },
    textSurface: textAt('label') as TextSurface<unknown>,
    inspector: [
      { key: 'payload.label', label: 'Label', kind: 'text' },
      {
        key: 'payload.action',
        label: 'Action',
        kind: 'select',
        options: ['next_slide', 'previous_slide', 'replay_slide', 'open_url'],
      },
      { key: 'payload.url', label: 'URL', kind: 'text' },
    ],
  },
  {
    type: 'shape',
    defaults: { width: 300, height: 300, payload: { shape: 'rect' } },
    inspector: [
      {
        key: 'payload.shape',
        label: 'Shape',
        kind: 'select',
        options: ['rect', 'ellipse', 'line', 'arrow'],
      },
    ],
  },
  /*
   * A newly added media element references a placeholder asset, not an empty one.
   *
   * `assetId` is a non-empty identifier and `mimeType` is required, so "no asset yet" cannot
   * be expressed as a blank — FR-014 requires the element to be valid the moment it exists.
   * The placeholder resolves to nothing, which is exactly right: the player already renders
   * `AssetFallback` for an unresolvable asset, so the teacher sees a labelled gap that keeps
   * its size, and picks the real asset in the inspector.
   */
  {
    type: 'image',
    defaults: { width: 600, height: 400, payload: { asset: PLACEHOLDER_ASSET('image/png') } },
    inspector: [
      { key: 'payload.asset.assetId', label: 'Image asset', kind: 'asset' },
      { key: 'payload.caption', label: 'Caption', kind: 'text' },
    ],
  },
  {
    type: 'video',
    defaults: { width: 800, height: 450, payload: { asset: PLACEHOLDER_ASSET('video/mp4') } },
    inspector: [
      { key: 'payload.asset.assetId', label: 'Video asset', kind: 'asset' },
      { key: 'payload.asset.captionTrack', label: 'Captions', kind: 'asset' },
      { key: 'payload.poster', label: 'Poster image', kind: 'asset' },
      { key: 'payload.volume', label: 'Volume', kind: 'number' },
      { key: 'payload.showControls', label: 'Show controls', kind: 'boolean' },
      { key: 'payload.loop', label: 'Loop', kind: 'boolean' },
    ],
  },
  {
    type: 'audio',
    defaults: { width: 400, height: 120, payload: { asset: PLACEHOLDER_ASSET('audio/mpeg') } },
    inspector: [
      { key: 'payload.asset.assetId', label: 'Audio asset', kind: 'asset' },
      { key: 'payload.asset.transcript', label: 'Transcript', kind: 'asset' },
      { key: 'payload.volume', label: 'Volume', kind: 'number' },
      { key: 'payload.showControls', label: 'Show controls', kind: 'boolean' },
    ],
  },
  {
    type: 'question',
    defaults: {
      width: 800,
      height: 400,
      /*
       * The interaction schema's shape, read from it rather than guessed: the discriminant
       * is `interactionType`, the correct answer is a separate `correctResponse` rather than
       * a flag on an option, and `required` is explicit because BR-005 makes gating too
       * consequential to infer.
       */
      payload: {
        interactionType: 'multiple_choice',
        prompt: 'Question',
        options: [
          { id: 'a', label: 'First' },
          { id: 'b', label: 'Second' },
        ],
        correctResponse: 'a',
        required: false,
      },
    },
    /**
     * The type that forced `list` into the contract.
     *
     * Options are a repeating group of `{ id, label }`, which no scalar kind describes. FR-019
     * says extend the contract rather than special-case the type, and `question` being the
     * seventh of seven is exactly the case where special-casing would prove the registry does
     * not work.
     */
    inspector: [
      { key: 'payload.prompt', label: 'Question', kind: 'text' },
      {
        key: 'payload.interactionType',
        label: 'Type',
        kind: 'select',
        options: ['multiple_choice', 'true_false'],
      },
      {
        key: 'payload.options',
        label: 'Answer options',
        kind: 'list',
        minItems: 2,
        // Born valid: `id` and `label` both have a non-empty minimum in the schema, so an
        // item of blank strings is refused and "Add option" silently does nothing.
        itemDefaults: (count) => ({ id: `option-${count + 1}`, label: `Option ${count + 1}` }),
        of: [
          { key: 'id', label: 'ID', kind: 'text' },
          { key: 'label', label: 'Label', kind: 'text' },
        ],
      },
      { key: 'payload.correctResponse', label: 'Correct option ID', kind: 'text' },
      { key: 'payload.required', label: 'Required to advance', kind: 'boolean' },
      { key: 'payload.maxAttempts', label: 'Maximum attempts', kind: 'number' },
      {
        key: 'payload.completionPolicy',
        label: 'Counts as complete',
        kind: 'select',
        options: ['on_first_attempt', 'on_correct', 'on_attempts_exhausted'],
      },
    ],
  },
]

/**
 * Every MVP type is registered — asserted at module load rather than in a test.
 *
 * A type present in the schema and absent here is a type the Add menu cannot offer, and the
 * failure would otherwise surface as a menu quietly missing an entry.
 */
const registered = new Set(builtinElementEditors.map((e) => e.type))
const unregistered = ELEMENT_TYPES.filter((t) => !registered.has(t))
if (unregistered.length > 0) {
  throw new Error(
    `Element types in the schema with no editor registration: ${unregistered.join(', ')}. ` +
      'Every type in ELEMENT_TYPES must be addable, or the Add menu silently omits it.',
  )
}
