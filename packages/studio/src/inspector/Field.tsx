import { useId, type ReactNode } from 'react'
import type { EditorField } from './fields.js'
import { readPath } from './path.js'

export interface FieldProps {
  readonly field: EditorField
  /** The element or slide this field reads from. */
  readonly source: Record<string, unknown>
  readonly disabled: boolean
  readonly onCommit: (value: unknown) => void
  /**
   * End the reversal run when this field loses focus.
   *
   * Every control here commits on `onChange`, so typing a label is one applied change per
   * keystroke and they collapse into one undo step. Leaving the field and coming back must
   * start a new step — otherwise a teacher who set a value, went elsewhere, and returned would
   * lose both visits to a single undo.
   *
   * A prop rather than a session read: this component holds no session, and `Inspector` does.
   */
  readonly onEndRun?: () => void
}

/**
 * One control per field kind, chosen from the declaration.
 *
 * The switch below is on `kind`, which is the closed set the contract declares — not on
 * element type, which is the open set Constitution I protects. Adding an element type adds no
 * case here; adding a *field kind* adds exactly one, and that is the extension point FR-019
 * describes.
 *
 * Every control carries a label associated by id, so the panel is navigable by keyboard and
 * announceable (FR-038, NFR-ACC-003).
 */
export function Field({ field, source, disabled, onCommit, onEndRun }: FieldProps): ReactNode {
  const id = useId()
  const stored = readPath(source, field.key)
  const value = field.fromStored ? field.fromStored(stored) : (stored as string | number | boolean)

  const commit = (raw: string | number | boolean): void => {
    onCommit(field.toStored ? field.toStored(raw) : raw)
  }

  if (field.kind === 'list') return <ListField id={id} field={field} stored={stored} disabled={disabled} onCommit={onCommit} />

  return (
    <div className="cs-field" data-cs-field={field.key} data-cs-kind={field.kind}>
      <label className="cs-field-label" htmlFor={id}>
        {field.label}
      </label>
      {field.kind === 'boolean' ? (
        <input
          id={id}
          type="checkbox"
          disabled={disabled}
          checked={Boolean(value)}
          onBlur={onEndRun}
          onChange={(e) => commit(e.target.checked)}
        />
      ) : field.kind === 'select' ? (
        <select id={id} disabled={disabled} onBlur={onEndRun} value={String(value ?? '')} onChange={(e) => commit(e.target.value)}>
          <option value="">—</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.kind === 'number' ? (
        <input
          id={id}
          type="number"
          disabled={disabled}
          onBlur={onEndRun}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => commit(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      ) : (
        // text, asset, and colour are all a single string to the manifest. `asset` is an
        // identifier a host resolves and `colour` is a theme token or literal; neither has a
        // richer control until the asset library (FR-CAN-013) and a palette exist, and a
        // picker that cannot browse would promise more than it delivers.
        <input
          id={id}
          type="text"
          disabled={disabled}
          onBlur={onEndRun}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => commit(e.target.value)}
        />
      )}
    </div>
  )
}

/**
 * A repeating group — the kind added for a question's options (research R-06).
 *
 * Items are edited in place and the whole array is committed, because the reducer writes a
 * value at a path and an array is a value. `minItems` is shown rather than enforced here: the
 * schema enforces it, and the inspector's job is to say why a removal will be refused before
 * the teacher tries it.
 */
function ListField({
  id,
  field,
  stored,
  disabled,
  onCommit,
}: {
  id: string
  field: EditorField
  stored: unknown
  disabled: boolean
  onCommit: (value: unknown) => void
}): ReactNode {
  const items = Array.isArray(stored) ? (stored as Array<Record<string, unknown>>) : []
  const itemFields = field.of ?? []
  const atMinimum = items.length <= (field.minItems ?? 0)

  const replace = (next: Array<Record<string, unknown>>): void => onCommit(next)

  return (
    <fieldset className="cs-field cs-field-list" data-cs-field={field.key} data-cs-kind="list">
      <legend className="cs-field-label" id={id}>
        {field.label}
      </legend>
      {items.map((item, index) => (
        <div key={index} className="cs-list-item" data-cs-list-item={String(index)}>
          {itemFields.map((sub) => (
            <label key={sub.key} className="cs-field-label">
              {`${sub.label} ${index + 1}`}
              <input
                type="text"
                disabled={disabled}
                value={String(item[sub.key] ?? '')}
                onChange={(e) =>
                  replace(items.map((it, i) => (i === index ? { ...it, [sub.key]: e.target.value } : it)))
                }
              />
            </label>
          ))}
          <button
            type="button"
            data-cs-list-remove={String(index)}
            disabled={disabled || atMinimum}
            aria-label={`Remove ${field.label} ${index + 1}`}
            onClick={() => replace(items.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        data-cs-list-add=""
        disabled={disabled}
        onClick={() =>
          replace([
            ...items,
            field.itemDefaults
              ? field.itemDefaults(items.length)
              : (Object.fromEntries(itemFields.map((sub) => [sub.key, ''])) as Record<string, unknown>),
          ])
        }
      >
        {`Add ${field.label}`}
      </button>
    </fieldset>
  )
}
