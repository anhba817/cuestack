import type { Edit, EditKind } from '../draft/edit.js'

/**
 * The four kinds a teacher repeats, and therefore the only four that may collapse.
 *
 * An allow-list rather than an "everything except" rule, for the reason `EDIT_KINDS` is a
 * closed union: a nineteenth kind added later is non-collapsible by default and stays that
 * way until somebody decides otherwise on purpose.
 *
 * `add-element`, `duplicate`, and `paste` mint ids and have no stable target set, so a key
 * built from their targets would be meaningless. `delete` is not something anyone repeats
 * into the same target.
 *
 * `set-effect` joined after the question was actually read rather than guessed at:
 * `EffectFields` renders the same `Field` the inspector does, and `Field` commits on every
 * `onChange` — so typing "0.35" into an effect's amount is four applied changes. Without it,
 * that is four undo steps for one thing a teacher did.
 */
export const COLLAPSIBLE_KINDS: ReadonlySet<EditKind> = new Set<EditKind>([
  'transform-elements',
  'set-timing',
  'set-field',
  'set-slide-field',
  'set-effect',
])

/** Distinct on every call, so a non-collapsible edit can never match anything, itself included. */
let unique = 0
const neverMatches = (): string => {
  unique += 1
  return `never:${unique}`
}

/**
 * What this edit may join, expressed as a string.
 *
 * Kind, plus sorted target ids, **plus the written path for the field kinds**. The path is not
 * decoration: `set-field` addresses an *element* rather than a field, so a key without it would
 * put an element's width and its label in one run and a single undo would revert both. And
 * `inspector/Field.tsx` commits on every `onChange`, so a teacher typing a label and then
 * adjusting a number is the ordinary case rather than a contrived one. `set-slide-field` names
 * no element at all, so without the path every slide property would share one key.
 *
 * Ids are sorted so a multiple-element drag and the same drag with the selection built in
 * another order are one action, which is what they are to the teacher.
 */
export function runKeyOf(edit: Edit): string {
  if (!COLLAPSIBLE_KINDS.has(edit.kind)) return neverMatches()

  switch (edit.kind) {
    case 'transform-elements':
      return `transform-elements:${[...edit.ids].sort().join(',')}`
    case 'set-timing':
      return `set-timing:${edit.id}`
    case 'set-field':
      return `set-field:${edit.id}:${edit.path.join('.')}`
    case 'set-slide-field':
      return `set-slide-field:${edit.path.join('.')}`
    case 'set-effect':
      // Element, effect, **and which fields the patch writes** — for the same reason the field
      // kinds carry a path. Changing an effect's duration and then one of its parameters are
      // two things a teacher did, and a key without the patch shape would merge them.
      return `set-effect:${edit.id}:${edit.effectId}:${Object.keys(edit.patch).sort().join(',')}`
    default:
      return neverMatches()
  }
}
