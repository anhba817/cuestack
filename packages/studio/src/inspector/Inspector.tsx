import type { ReactNode } from 'react'
import type { ElementRegistry, EffectRegistry } from '@cuestack/core'
import type { Element, Slide } from '@cuestack/schema'
import { COMMON_FIELDS } from './common.js'
import { SLIDE_FIELDS } from './slide.js'
import { Field } from './Field.js'
import { readPath } from './path.js'
import type { EditorField } from './fields.js'
import type { ElementEditorRegistry } from '../registry/editors.js'
import type { EditorSession } from '../session/useEditorSession.js'
import { EffectControls } from '../effects/EffectControls.js'

export interface InspectorProps {
  readonly session: EditorSession
  readonly slide: Slide
  readonly editors: ElementEditorRegistry
  /**
   * Core's plugin registry, consulted first for a type's fields.
   *
   * Optional because it is empty by default: the seven built-in types have no `ElementPlugin`
   * and never have. A host that registers one gets `ElementPlugin.inspector` used verbatim,
   * which is FR-018 exactly; the built-ins fall through to the editor registry.
   */
  readonly plugins?: ElementRegistry
  /**
   * The effect registry, consulted for which effects may be added and what each accepts.
   *
   * Mirrors `plugins` exactly — optional, defaulting to core's own — and deliberately so:
   * naming that symmetry is what stops the effect registry arriving as a differently-shaped
   * afterthought. **One instance must also reach `resolve`**, or the menu offers an effect
   * the canvas renders as `UNKNOWN_EFFECT_TYPE` (feature 006, FR-026).
   */
  readonly effects?: EffectRegistry
}

/**
 * The settings that belong to whatever is selected.
 *
 * Zero branches on element type. Every field is rendered from a declaration — the common set,
 * then whatever the type declares — so adding an element type adds a registration and nothing
 * else. That is Constitution I's actual requirement, and SC-010 counts the branches.
 */
export function Inspector({ session, slide, editors, plugins, effects }: InspectorProps): ReactNode {
  const selected = slide.elements.filter((e) => session.selection.includes(e.id))

  if (selected.length === 0) return <SlidePanel session={session} slide={slide} />
  if (selected.length > 1) return <MultiPanel session={session} selected={selected} />
  return (
    <ElementPanel
      session={session}
      element={selected[0]!}
      editors={editors}
      plugins={plugins}
      effects={effects}
    />
  )
}

/**
 * The three members that describe *editing* rather than the field.
 *
 * Only these are overlaid. Copying the whole editor entry would let it override the plugin's own
 * label and kind, which FR-018 gives to the plugin — and a host registering a plugin to rename a
 * field would find the rename ignored.
 */
function editingExtras(field: EditorField): Partial<EditorField> {
  return {
    ...(field.toStored ? { toStored: field.toStored } : {}),
    ...(field.fromStored ? { fromStored: field.fromStored } : {}),
    ...(field.itemDefaults ? { itemDefaults: field.itemDefaults } : {}),
  }
}

function Panel({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <section className="cs-inspector" data-cs-inspector="" aria-label={label}>
      <h2 className="cs-inspector-title">{label}</h2>
      {children}
    </section>
  )
}

function SlidePanel({ session, slide }: { session: EditorSession; slide: Slide }): ReactNode {
  return (
    <Panel label="Slide settings">
      <div data-cs-panel="slide">
        {SLIDE_FIELDS.map((field) => (
          <Field
            onEndRun={session.endEditRun}
            key={field.key}
            field={field}
            source={slide as unknown as Record<string, unknown>}
            disabled={session.mode === 'read-only'}
            onCommit={(value) =>
              session.apply({ kind: 'set-slide-field', path: field.key.split('.'), value })
            }
          />
        ))}
      </div>
      <Refusal session={session} />
    </Panel>
  )
}

function ElementPanel({
  session,
  element,
  editors,
  plugins,
  effects,
}: {
  session: EditorSession
  element: Element
  editors: ElementEditorRegistry
  plugins?: ElementRegistry
  effects?: EffectRegistry
}): ReactNode {
  /**
   * A registered plugin supplies the fields; this package overlays what *editing* adds.
   *
   * FR-018 settles which list wins: the inspector "MUST source an element type's fields from that
   * type's registered plugin". So a plugin's list is the list — including for the seven builtins
   * feature 009 registered, where `builtinElementEditors` derives from the same declaration and the
   * two are identical by construction.
   *
   * What the overlay is for is the half a plugin cannot express. `EditorField extends
   * InspectorField` by adding `fromStored`/`toStored` and `itemDefaults`, and the plugin path is a
   * **cast** rather than a conversion — so choosing the plugin's list wholesale would drop them
   * silently, leaving a teacher with, in `fields.ts`'s own words, "a colour picker that never
   * works", or an "Add option" button that appears to do nothing.
   *
   * Merged **by key**, because those extras hang off individual fields rather than off the type.
   *
   * Note what a plugin receives to produce this: nothing. `inspector` is a declaration on the
   * registration, not a function called with the lesson — so a plugin cannot reach the draft,
   * its siblings, or the learner, which is FR-025 holding by shape rather than by discipline.
   */
  const pluginSpec = plugins?.get(element.type)?.inspector?.fields as readonly EditorField[] | undefined
  const editorSpec = editors.get(element.type)?.inspector
  const extras = new Map((editorSpec ?? []).map((f) => [f.key, editingExtras(f)]))
  const typeFields = pluginSpec
    ? pluginSpec.map((field) => ({ ...field, ...(extras.get(field.key) ?? {}) }))
    : editorSpec
  const unrecognised = !typeFields

  return (
    <Panel label={`${element.type} settings`}>
      {unrecognised && (
        <p className="cs-inspector-note" role="note" data-cs-unrecognised="">
          {`This element's type — “${element.type}” — is not registered, so its own settings ` +
            'cannot be shown. The settings every element has are below, and the element is ' +
            'left exactly as it was authored.'}
        </p>
      )}
      <div data-cs-panel="type">
        {(typeFields ?? []).map((field) => (
          <Field
            onEndRun={session.endEditRun}
            key={field.key}
            field={field}
            source={element as unknown as Record<string, unknown>}
            disabled={session.mode === 'read-only' || Boolean(element.locked)}
            onCommit={(value) =>
              session.apply({ kind: 'set-field', id: element.id, path: field.key.split('.'), value })
            }
          />
        ))}
      </div>
      <div data-cs-panel="common">
        {COMMON_FIELDS.map((field) => (
          <Field
            onEndRun={session.endEditRun}
            key={field.key}
            field={field}
            source={element as unknown as Record<string, unknown>}
            // Lock guards geometry, not the lock itself — otherwise a locked element could
            // never be unlocked (BR-011, and the `set-flag` exception in edit-contract.md).
            disabled={
              session.mode === 'read-only' || (Boolean(element.locked) && field.key !== 'locked')
            }
            onCommit={(value) =>
              session.apply({ kind: 'set-field', id: element.id, path: field.key.split('.'), value })
            }
          />
        ))}
      </div>
      {/* Effects, from the registry. Feature 006 — until it, `Element.effects` was a field
          only a hand-written manifest could populate. */}
      <EffectControls session={session} element={element} {...(effects ? { effects } : {})} />
      <Refusal session={session} />
    </Panel>
  )
}

/**
 * Several elements selected: what they have in common, and where they differ (FR-024).
 *
 * Only the common fields, because two element types share no payload. A differing value shows
 * as such rather than as one member's value, which would silently misreport the others.
 */
function MultiPanel({
  session,
  selected,
}: {
  session: EditorSession
  selected: readonly Element[]
}): ReactNode {
  return (
    <Panel label={`${selected.length} elements selected`}>
      <div data-cs-panel="multi">
        {COMMON_FIELDS.map((field) => {
          const values = selected.map((e) => readPath(e as unknown as Record<string, unknown>, field.key))
          const same = values.every((v) => JSON.stringify(v) === JSON.stringify(values[0]))
          return (
            <div key={field.key} className="cs-field" data-cs-field={field.key}>
              <span className="cs-field-label">{field.label}</span>
              <span className="cs-field-mixed" data-cs-mixed={same ? undefined : ''}>
                {same ? String(values[0] ?? '') : 'Mixed'}
              </span>
            </div>
          )
        })}
      </div>
      <Refusal session={session} />
    </Panel>
  )
}

/**
 * What went wrong, in the terms NFR-USA-004 asks for: the problem, the affected object, and
 * what to do about it.
 */
function Refusal({ session }: { session: EditorSession }): ReactNode {
  const refusal = session.lastRefusal
  if (!refusal) return null
  return (
    <p className="cs-inspector-refusal" role="alert" data-cs-refusal={refusal.reason}>
      {refusal.message}
    </p>
  )
}
