import type { EditorField } from './fields.js'

/**
 * What the inspector shows when nothing is selected (FR-024).
 *
 * An empty selection means the *slide* is selected, rather than meaning nothing is — a blank
 * panel is a dead end, and the slide's own settings have to be reachable somehow.
 *
 * **The advance mode is deliberately absent.** It is the one slide property this feature does
 * not edit: BR-006 requires "after selected media ends" to point at a real media element on
 * that slide, and "after required interaction" depends on a required question existing, so it
 * needs cross-field validation and an element picker. Both belong with the timeline work
 * (ED-3/ED-4). Duration is here because it bounds the authoring-time scrub, which would
 * otherwise have a range the teacher cannot change.
 */
export const SLIDE_FIELDS: readonly EditorField[] = [
  { key: 'name', label: 'Slide name', kind: 'text' },
  { key: 'durationMs', label: 'Duration (ms)', kind: 'number' },
  /**
   * Background is a discriminated union, and this is the whole reason `toStored` exists.
   *
   * A teacher edits one colour; the format stores `{ kind: 'color', color }`. Writing the
   * leaf alone would produce an object with no discriminant, which the schema refuses — a
   * colour picker that silently never works. Gradients and image backgrounds are reachable in
   * the format and are not offered here: they need their own controls, and a half-built
   * picker that can only ever produce one variant is worse than one that says so.
   */
  {
    key: 'background',
    label: 'Background colour',
    kind: 'colour',
    toStored: (value) => ({ kind: 'color', color: String(value) }),
    fromStored: (stored) =>
      typeof stored === 'object' && stored !== null && 'color' in stored
        ? String((stored as { color: unknown }).color)
        : '',
  },
  {
    key: 'transition.type',
    label: 'Transition',
    kind: 'select',
    // The schema's own enum. A value not in this list is one the player cannot render.
    options: ['none', 'fade', 'slide', 'zoom'],
  },
  { key: 'transition.durationMs', label: 'Transition duration (ms)', kind: 'number' },
  { key: 'accessibility.label', label: 'Accessible name', kind: 'text' },
  { key: 'accessibility.announce', label: 'Announcement', kind: 'text' },
]
