import type { InspectorField } from '@cuestack/core'

/**
 * A field, plus how its control's value maps to what the manifest stores.
 *
 * `InspectorField` in `@cuestack/core` describes what to *show*: a key, a label, a kind. Most
 * fields need nothing more, because a number control writes a number. A few store something
 * shaped differently from what a teacher edits, and a slide's background is the case that
 * forced this: it is a discriminated union, so writing `background.color` on a slide that has
 * no background yet produces `{ color: '#fff' }` with no `kind` — which the schema correctly
 * refuses, leaving the teacher with a colour picker that never works.
 *
 * The transform is a general mechanism rather than a special case for backgrounds. The
 * alternative considered and rejected was branching on the field key inside the inspector,
 * which is the switch statement Constitution I calls a defect, arriving by the back door.
 *
 * These extras live in `@cuestack/studio` because they are about editing, not about the
 * format. Core's contract stays a description of what a field *is*.
 */
export interface EditorField extends InspectorField {
  /** Control value to stored value. Identity when absent. */
  readonly toStored?: (value: string | number | boolean) => unknown
  /** Stored value to control value. Identity when absent. */
  readonly fromStored?: (stored: unknown) => string | number | boolean
  /** Nested item fields, narrowed to editor fields for `list`. */
  readonly of?: readonly EditorField[]
  /**
   * A new `list` item, born valid.
   *
   * The same principle FR-014 applies to a newly added element, and it was learned the same
   * way: an item of blank strings fails the schema's minimums, so "Add option" was refused by
   * validation and appeared to do nothing. A list whose items have required fields needs to
   * say what a fresh one looks like, and only the declaration knows.
   *
   * Takes the current count so a generated identifier can be unique without a random source —
   * keeping an edit sequence reproducible (SC-016).
   */
  readonly itemDefaults?: (count: number) => Record<string, unknown>
}
