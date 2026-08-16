import type { InspectorField } from '@cuestack/core'

/**
 * The settings every element type carries, whatever it is (FR-022).
 *
 * Separate from the per-type spec because these are properties of *an element*, not of a
 * text element or an image element. Putting them in each type's registration would mean
 * seven copies of the same ten fields, and the seventh would drift.
 *
 * Timing is here rather than in ED-3's timeline because a teacher needs to be able to set
 * when something appears before a timeline exists to drag it on. When ED-3 lands these stay:
 * FR-SEQ-005 requires both modes to read and write the same timeline data, and a field and a
 * track editing one value is exactly that.
 */
export const COMMON_FIELDS: readonly InspectorField[] = [
  { key: 'x', label: 'X', kind: 'number' },
  { key: 'y', label: 'Y', kind: 'number' },
  { key: 'width', label: 'Width', kind: 'number' },
  { key: 'height', label: 'Height', kind: 'number' },
  { key: 'rotation', label: 'Rotation', kind: 'number' },
  { key: 'zIndex', label: 'Layer', kind: 'number' },
  { key: 'locked', label: 'Locked', kind: 'boolean' },
  { key: 'hidden', label: 'Hidden from learners', kind: 'boolean' },
  { key: 'startMs', label: 'Appears at (ms)', kind: 'number' },
  { key: 'endMs', label: 'Disappears at (ms)', kind: 'number' },
  /**
   * Accessibility is a common field, not an advanced one.
   *
   * FR-021 asks for alt text reachable "without opening an advanced section", and NFR-ACC-006
   * makes it a property of any element that conveys meaning. Burying it is how lessons ship
   * without it.
   */
  { key: 'accessibility.label', label: 'Accessible name', kind: 'text' },
  { key: 'accessibility.altText', label: 'Alternative text', kind: 'text' },
]
