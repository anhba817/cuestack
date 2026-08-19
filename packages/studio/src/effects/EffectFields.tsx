import type { ReactNode } from 'react'
import type { InspectorField } from '@cuestack/core'
import { Field } from '../inspector/Field.js'

export interface EffectFieldsProps {
  readonly fields: readonly InspectorField[]
  /** The effect's own `parameters` bag. Flat keys — never a path. */
  readonly parameters: Readonly<Record<string, string | number | boolean>>
  readonly disabled: boolean
  readonly onCommit: (key: string, value: string | number | boolean) => void
  /** Ends the reversal run when a parameter field loses focus — see `Field`. */
  readonly onEndRun?: () => void
}

/**
 * An effect's parameters, rendered through the inspector's own field components.
 *
 * Effect parameters are the problem the element inspector already solved, which is why
 * `EffectDescriptor.parameters` reuses `InspectorField` rather than inventing a shape. One
 * set of controls renders both.
 *
 * **The one difference is load-bearing.** On an element a `key` is a dotted path from the
 * element root (`payload.text`); on an effect it is a *flat* key into `effect.parameters`
 * (`amount`). So the source handed to `Field` is the parameters bag itself and
 * `inspector/path.ts` is never reached for. Sharing a type must not become sharing a read.
 *
 * A missing parameter is left absent rather than defaulted here. `at()` keeps its inlined
 * defaults because it runs per frame on a server where `parameters` may be undefined, and
 * writing a default into the manifest would turn "unset" into "set to what it happened to be
 * when a teacher opened the panel".
 */
export function EffectFields({ fields, parameters, disabled, onCommit, onEndRun }: EffectFieldsProps): ReactNode {
  if (fields.length === 0) return null
  return (
    <div className="cs-effect-fields">
      {fields.map((field) => (
        <Field
          key={field.key}
          field={field}
          source={parameters as Record<string, unknown>}
          disabled={disabled}
          {...(onEndRun ? { onEndRun } : {})}
          onCommit={(value) => onCommit(field.key, value as string | number | boolean)}
        />
      ))}
    </div>
  )
}
