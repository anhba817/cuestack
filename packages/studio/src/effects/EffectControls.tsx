import { useState, type ReactNode } from 'react'
import type { Element } from '@cuestack/schema'
import { builtinEffects, createEffectRegistry, type EffectPhase, type EffectRegistry } from '@cuestack/core'
import type { EditorSession } from '../session/useEditorSession.js'
import { DEFAULT_EFFECT_DURATION_MS } from '../timeline/constants.js'
import { EffectFields } from './EffectFields.js'

const DEFAULT_EFFECTS = createEffectRegistry(builtinEffects)

export interface EffectControlsProps {
  readonly session: EditorSession
  readonly element: Element
  /** Defaults to core's own. One instance must also reach `resolve` — see `EditorCanvas`. */
  readonly effects?: EffectRegistry
}

interface StoredEffect {
  readonly id: string
  readonly type: string
  readonly phase: EffectPhase
  readonly startMs: number
  readonly durationMs: number
  readonly parameters?: Readonly<Record<string, string | number | boolean>>
}

/**
 * Adding, configuring, and removing an effect.
 *
 * **Everything comes from the registry.** The types offered are `registry.types()`, the
 * phases are the chosen descriptor's, and the parameters are what it declares. A list held
 * here would be the per-effect branch Constitution I calls a defect: it would rot the first
 * time a ninth effect registered, and it would rot silently, because the menu would simply
 * be missing an entry nobody was looking for.
 *
 * That is also what the ninth-effect test asserts, in both halves: a synthetic effect
 * registered in a test registry must appear in this menu **and render on the canvas**. One
 * without the other is worse than neither — an effect a teacher can add and the resolver
 * rejects as `UNKNOWN_EFFECT_TYPE`.
 *
 * Removal is immediate and undoable (feature 008). It used to be confirmed, on the terms
 * feature 005 set for delete, and that prompt always said it was standing in for something:
 * it was to be **removed** when ED-5 landed real undo, not kept beside it.
 */
export function EffectControls({ session, element, effects = DEFAULT_EFFECTS }: EffectControlsProps): ReactNode {
  const [pendingType, setPendingType] = useState(() => effects.types()[0] ?? '')
  const readOnly = session.mode === 'read-only'

  const stored = ((element as unknown as { effects?: readonly StoredEffect[] }).effects ?? []) as readonly StoredEffect[]

  const add = (): void => {
    const descriptor = effects.get(pendingType)
    if (!descriptor) return
    session.apply({
      kind: 'add-effect',
      id: element.id,
      type: descriptor.type,
      phase: descriptor.phases[0]!,
      startMs: session.authoringTime,
      durationMs: DEFAULT_EFFECT_DURATION_MS,
    })
  }

  return (
    <section className="cs-effects" aria-label="Effects">
      <div className="cs-effects-add">
        <label>
          Effect
          <select
            value={pendingType}
            disabled={readOnly}
            onChange={(event) => setPendingType(event.currentTarget.value)}
          >
            {effects.types().map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={readOnly} onClick={add}>
          Add effect
        </button>
      </div>

      <ol className="cs-effect-list">
        {stored.map((effect) => {
          const descriptor = effects.get(effect.type)
          return (
            <li key={effect.id} data-testid={`cs-effect-row-${effect.id}`}>
              <span className="cs-effect-name">{effect.type}</span>

              <label>
                Phase
                <select
                  value={effect.phase}
                  disabled={readOnly}
                  onChange={(event) =>
                    session.apply({
                      kind: 'set-effect',
                      id: element.id,
                      effectId: effect.id,
                      patch: { phase: event.currentTarget.value as EffectPhase },
                    })
                  }
                >
                  {(descriptor?.phases ?? [effect.phase]).map((phase) => (
                    <option key={phase} value={phase}>
                      {phase}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Duration (ms)
                <input
                  type="number"
                  value={effect.durationMs}
                  disabled={readOnly}
                  onChange={(event) =>
                    session.apply({
                      kind: 'set-effect',
                      id: element.id,
                      effectId: effect.id,
                      patch: { durationMs: Number(event.currentTarget.value) },
                    })
                  }
                />
              </label>

              <EffectFields
                fields={descriptor?.parameters ?? []}
                parameters={effect.parameters ?? {}}
                disabled={readOnly}
                onEndRun={session.endEditRun}
                onCommit={(key, value) =>
                  session.apply({
                    kind: 'set-effect',
                    id: element.id,
                    effectId: effect.id,
                    patch: { parameters: { ...effect.parameters, [key]: value } },
                  })
                }
              />

              <button
                type="button"
                disabled={readOnly}
                aria-label={`Remove the ${effect.type} effect`}
                onClick={() => session.apply({ kind: 'remove-effect', id: element.id, effectId: effect.id })}
              >
                Remove
              </button>
            </li>
          )
        })}
      </ol>

      {session.lastRefusal ? <p className="cs-effect-refusal">{session.lastRefusal.message}</p> : null}
    </section>
  )
}
