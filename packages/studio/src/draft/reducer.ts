import type { Element, LessonManifest, Slide } from '@cuestack/schema'
import { validate } from '@cuestack/schema/validate'
import {
  DUPLICATE_OFFSET_UNITS,
  MIN_EXTENT_UNITS,
} from '../geometry/constants.js'
import { alignEdges, distributeEvenly } from '../geometry/align.js'
import type { Geometry } from '../geometry/types.js'
import { createElementEditorRegistry, builtinElementEditors, type ElementEditorRegistry } from '../registry/editors.js'
import { builtinEffects, createEffectRegistry, type EffectRegistry } from '@cuestack/core'
import { newEffect } from '../effects/defaults.js'
import { eventsOf, keyOf } from '../sequence/events.js'
import { resolveSequence } from '../sequence/relationships.js'
import { requiredDurationMs } from '../timeline/overrun.js'
import { MIN_EFFECT_DURATION_MS } from '../timeline/constants.js'
import type { Edit, EditContext, EditResult } from './edit.js'

/**
 * Why zero is refused, said in the teacher's terms.
 *
 * `msDuration` is `z.int().positive()`, and the schema's own comment gives the reason: zero
 * is not "instant" — `appear` is. Reporting a schema path here would be technically accurate
 * and useless (NFR-USA-004).
 */
const DURATION_MESSAGE =
  'An effect must last longer than nothing. For something that happens instantly, use the ' +
  '“appear” effect rather than a zero-length one.'

/** The registered effects, unless a host supplies its own. See `ResolveContext.effects`. */
const DEFAULT_EFFECTS = createEffectRegistry(builtinEffects)

/**
 * The one function every change to a lesson passes through.
 *
 * Five promises, all from contracts/edit-contract.md and all enforced by the frame rather
 * than by each handler: purity, no mutation of the input, a validated result, a blanket
 * read-only refusal, and locked elements skipped rather than fatal.
 *
 * Putting them in the frame is what makes them properties of the system. A handler that
 * forgets to validate cannot exist, because no handler validates — the frame does.
 */

const DEFAULT_EDITORS = createElementEditorRegistry(builtinElementEditors)

/** Structural clone that keeps the manifest plain. Cheap enough at 300 elements. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const fail = (
  reason: 'read-only' | 'locked' | 'invalid' | 'not-found' | 'unsupported',
  message: string,
  elementId?: string,
): EditResult => (elementId ? { ok: false, reason, message, elementId } : { ok: false, reason, message })

function slideOf(draft: LessonManifest, slideId?: string): Slide | undefined {
  return slideId ? draft.slides.find((s) => s.id === slideId) : draft.slides[0]
}

const geometryOf = (el: Element): Geometry => ({
  x: el.x,
  y: el.y,
  width: el.width,
  height: el.height,
  rotation: el.rotation ?? 0,
})

/**
 * Which of the named elements may be changed, and which are locked.
 *
 * A mixed selection applies to the unlocked members and reports the rest — returning a
 * refusal for the whole set would let one locked element silently veto a five-element drag,
 * which the specification's edge-case list calls out by name.
 */
function partitionLocked(
  slide: Slide,
  ids: readonly string[],
): { movable: Element[]; locked: Element[]; missing: string[] } {
  const movable: Element[] = []
  const locked: Element[] = []
  const missing: string[] = []
  for (const id of ids) {
    const el = slide.elements.find((e) => e.id === id)
    if (!el) missing.push(id)
    else if (el.locked) locked.push(el)
    else movable.push(el)
  }
  return { movable, locked, missing }
}

function writePath(target: Record<string, unknown>, path: readonly string[], value: unknown): void {
  let node = target
  for (const key of path.slice(0, -1)) {
    const next = node[key]
    if (typeof next !== 'object' || next === null) node[key] = {}
    node = node[key] as Record<string, unknown>
  }
  const last = path[path.length - 1]
  if (last !== undefined) node[last] = value
}

export function applyEdit(
  draft: LessonManifest,
  edit: Edit,
  ctx: EditContext,
  editors: ElementEditorRegistry = DEFAULT_EDITORS,
  /**
   * The effect registry, defaulting to core's own.
   *
   * Injectable for the same reason `editors` is: a host that registers a ninth effect must
   * get it offered here *and* rendered by `resolve` — one instance reaching both, or the
   * menu and the canvas disagree about which effects exist (Constitution I, FR-026).
   */
  effects: EffectRegistry = DEFAULT_EFFECTS,
): EditResult {
  // Promise 4. Before anything else, and covering the whole union rather than the variants
  // the interface happens to expose (FR-051, SC-017).
  if (ctx.mode === 'read-only') {
    return fail(
      'read-only',
      'This lesson is open for reading. Changes are unavailable in read-only mode; ' +
        'copying is still permitted.',
    )
  }

  const next = clone(draft)
  const slide = slideOf(next, ctx.slideId)
  if (!slide) return fail('not-found', `No slide "${ctx.slideId ?? '<first>'}" in this lesson.`)

  const created: string[] = []
  const outcome = dispatch(next, slide, edit, ctx, editors, effects, created)
  if (outcome) return outcome

  // Promise 3. The schema's own validator, not a reimplementation of it — so "the editor
  // cannot construct a lesson the player would refuse" is a property rather than a hope
  // about each handler (FR-045).
  const check = validate(next)
  if (!check.ok) {
    const first = check.issues[0]
    return fail(
      'invalid',
      first
        ? `${first.message} (${first.code})`
        : 'That change would produce a lesson the player could not load.',
      first?.location?.elementId,
    )
  }

  return { ok: true, draft: next, idsCreated: created }
}

/** Returns a refusal, or undefined when the edit was applied to `slide` in place. */
function dispatch(
  draft: LessonManifest,
  slide: Slide,
  edit: Edit,
  ctx: EditContext,
  editors: ElementEditorRegistry,
  effects: EffectRegistry,
  created: string[],
): EditResult | undefined {
  const elements = slide.elements as Element[]

  switch (edit.kind) {
    case 'add-element': {
      const editor = editors.get(edit.type)
      if (!editor) return fail('unsupported', `No editor registration for element type "${edit.type}".`)
      const id = ctx.nextId()
      created.push(id)
      const maxZ = elements.reduce((m, e) => Math.max(m, e.zIndex), -1)
      elements.push({
        id,
        type: edit.type,
        x: edit.at?.x ?? 0,
        y: edit.at?.y ?? 0,
        width: editor.defaults.width,
        height: editor.defaults.height,
        zIndex: maxZ + 1,
        // Spans the slide, so an element added part-way through the authoring time is
        // visible immediately rather than appearing to have failed (FR-014).
        startMs: 0,
        endMs: slide.durationMs,
        payload: clone(editor.defaults.payload),
      } as unknown as Element)

      // FR-048 / FR-AN-001. Emitted here rather than from the menu so every route to an
      // insertion is counted — keyboard, paste of a new type, or a host calling `apply`
      // directly. Fire and forget: the contract returns void and never throws.
      ctx.analytics?.record({
        kind: 'element_inserted',
        lessonId: draft.lesson.id,
        schemaVersion: draft.schemaVersion,
        slideId: slide.id,
        elementType: edit.type,
      })
      return undefined
    }

    case 'transform-elements': {
      const { movable, locked, missing } = partitionLocked(slide, edit.ids)
      if (missing.length > 0) return fail('not-found', `No element "${missing[0]}" on this slide.`, missing[0])
      if (movable.length === 0) {
        return fail(
          'locked',
          locked.length === 1
            ? 'That element is locked. Unlock it to move, resize, or rotate it.'
            : `All ${locked.length} selected elements are locked.`,
          locked[0]?.id,
        )
      }
      for (const el of movable) {
        // Per-element destination when the edit carries one — a multiple-element move ends
        // with each member somewhere different — otherwise the shared geometry.
        const g = edit.perId?.[el.id] ?? edit.geometry
        if (g.x !== undefined) el.x = g.x
        if (g.y !== undefined) el.y = g.y
        if (g.width !== undefined) el.width = Math.max(MIN_EXTENT_UNITS, g.width)
        if (g.height !== undefined) el.height = Math.max(MIN_EXTENT_UNITS, g.height)
        if (g.rotation !== undefined) el.rotation = g.rotation
      }
      return undefined
    }

    case 'set-field': {
      const el = elements.find((e) => e.id === edit.id)
      if (!el) return fail('not-found', `No element "${edit.id}" on this slide.`, edit.id)
      writePath(el as unknown as Record<string, unknown>, edit.path, edit.value)
      return undefined
    }

    case 'set-slide-field': {
      writePath(slide as unknown as Record<string, unknown>, edit.path, edit.value)
      return undefined
    }

    case 'set-text': {
      const el = elements.find((e) => e.id === edit.id)
      if (!el) return fail('not-found', `No element "${edit.id}" on this slide.`, edit.id)
      if (el.locked) return fail('locked', 'That element is locked. Unlock it to edit its text.', el.id)
      const editor = editors.get(el.type)
      const surface = editor?.textSurface
      if (!surface) {
        return fail('unsupported', `Elements of type "${el.type}" have no on-canvas text.`, el.id)
      }
      ;(el as { payload: unknown }).payload = surface.write(el.payload, edit.text)
      return undefined
    }

    /**
     * Feature 006. Timing is authored data, so re-timing is an ordinary field write — and
     * it goes through the same guards as every other one rather than growing its own.
     *
     * A single `id`: multi-select timing edits are out of scope, and `partitionLocked` is
     * for edits that legitimately span a selection. A lone locked element refuses, which is
     * the same answer `transform-elements` gives when its selection is one locked element.
     *
     * No clamping here. The timing engine clamps a *live drag* so the teacher never sees an
     * illegal state; the reducer's job is to refuse what is illegal, not to quietly repair
     * it. A `startMs` past `endMs` arriving here means a caller bypassed the engine, and the
     * post-edit validation this reducer already runs is what catches it (FR-041).
     */
    case 'set-timing': {
      const el = elements.find((e) => e.id === edit.id)
      if (!el) return fail('not-found', `No element "${edit.id}" on this slide.`, edit.id)
      if (el.locked) {
        return fail('locked', 'That element is locked. Unlock it to change when it appears.', el.id)
      }
      if (edit.startMs !== undefined) (el as { startMs: number }).startMs = edit.startMs
      if (edit.endMs !== undefined) (el as { endMs: number }).endMs = edit.endMs
      return undefined
    }

    /**
     * Feature 006. Eight effects have been registered, tested, and unreachable by a teacher
     * since Wave 1 — `Element.effects` was a field only a hand-written manifest could fill.
     *
     * Everything about an effect comes from its registration: which types may be added,
     * which phases each accepts, what its easing defaults to. A list held here would be the
     * per-effect branch Constitution I calls a defect, and it would rot the first time a
     * ninth effect registered.
     */
    case 'add-effect': {
      const el = elements.find((e) => e.id === edit.id)
      if (!el) return fail('not-found', `No element "${edit.id}" on this slide.`, edit.id)
      if (el.locked) return fail('locked', 'That element is locked. Unlock it to add an effect.', el.id)

      const descriptor = effects.get(edit.type)
      if (!descriptor) {
        return fail('invalid', `No effect named "${edit.type}" is registered.`, el.id)
      }
      if (!descriptor.phases.includes(edit.phase)) {
        return fail(
          'invalid',
          `The "${edit.type}" effect cannot run as ${edit.phase}. It offers ${descriptor.phases.join(', ')}.`,
          el.id,
        )
      }
      if (edit.durationMs < MIN_EFFECT_DURATION_MS) {
        return fail('invalid', DURATION_MESSAGE, el.id)
      }

      const list = ((el as { effects?: Record<string, unknown>[] }).effects ??= [])
      const born = newEffect(el, descriptor, edit.startMs, list as { startMs: number; order: number }[])
      const id = ctx.nextId()
      created.push(id)
      list.push({ ...born, phase: edit.phase, durationMs: edit.durationMs, startMs: edit.startMs, id })
      return undefined
    }

    /**
     * No window clamp here, deliberately.
     *
     * An effect that runs after its element has gone is authorable — `Effect.startMs` is
     * *slide* time — and the timeline is required to say it would never run rather than to
     * prevent it. The clamp belongs to `effects/defaults.ts`, where it is a courtesy to
     * somebody adding an effect, not a rule about what may exist.
     */
    case 'set-effect': {
      const el = elements.find((e) => e.id === edit.id)
      if (!el) return fail('not-found', `No element "${edit.id}" on this slide.`, edit.id)
      if (el.locked) return fail('locked', 'That element is locked. Unlock it to change its effects.', el.id)

      const list = (el as { effects?: Record<string, unknown>[] }).effects ?? []
      const effect = list.find((e) => e['id'] === edit.effectId)
      if (!effect) return fail('not-found', `No effect "${edit.effectId}" on that element.`, el.id)

      const { patch } = edit
      if (patch.durationMs !== undefined && patch.durationMs < MIN_EFFECT_DURATION_MS) {
        return fail('invalid', DURATION_MESSAGE, el.id)
      }
      if (patch.phase !== undefined) {
        const descriptor = effects.get(effect['type'] as string)
        if (descriptor && !descriptor.phases.includes(patch.phase)) {
          return fail(
            'invalid',
            `The "${effect['type']}" effect cannot run as ${patch.phase}. ` +
              `It offers ${descriptor.phases.join(', ')}.`,
            el.id,
          )
        }
      }

      if (patch.startMs !== undefined) effect['startMs'] = patch.startMs
      if (patch.durationMs !== undefined) effect['durationMs'] = patch.durationMs
      if (patch.phase !== undefined) effect['phase'] = patch.phase
      if (patch.easing !== undefined) effect['easing'] = patch.easing
      if (patch.parameters !== undefined) effect['parameters'] = { ...patch.parameters }
      return undefined
    }

    case 'remove-effect': {
      const el = elements.find((e) => e.id === edit.id)
      if (!el) return fail('not-found', `No element "${edit.id}" on this slide.`, edit.id)
      if (el.locked) return fail('locked', 'That element is locked. Unlock it to remove an effect.', el.id)

      const list = (el as { effects?: Record<string, unknown>[] }).effects ?? []
      const index = list.findIndex((e) => e['id'] === edit.effectId)
      if (index === -1) return fail('not-found', `No effect "${edit.effectId}" on that element.`, el.id)
      list.splice(index, 1)
      // The element keeps its own timing; only the effect is gone (FR-021).
      return undefined
    }

    /**
     * Simple Sequence, applied.
     *
     * The classification is derived and stored nowhere — Constitution III forbids
     * mode-specific storage — so this writes only `startMs` and `endMs` on elements and
     * `startMs` on effects. A manifest compared before and after must differ by nothing else,
     * which is what BR-016's rule test asserts.
     *
     * **Locked members are skipped, not fatal.** `partitionLocked` above is the convention
     * every other multiple-element kind uses, and its comment gives the reason: "returning a
     * refusal for the whole set would let one locked element silently veto a five-element
     * drag." A sequence is the largest multiple-element edit in the editor, so it is the last
     * place to invert that. Refusal comes only when *every* affected element is locked.
     */
    case 'apply-sequence': {
      const affected = [...new Set(edit.relationships.map((r) => r.eventKey.split(':')[0]!))]
      const { movable, locked, missing } = partitionLocked(slide, affected)
      if (missing.length > 0) return fail('not-found', `No element "${missing[0]}" on this slide.`, missing[0])
      if (movable.length === 0 && locked.length > 0) {
        return fail(
          'locked',
          locked.length === 1
            ? 'That element is locked. Unlock it to change when it happens.'
            : `All ${locked.length} elements in this sequence are locked.`,
          locked[0]?.id,
        )
      }

      /**
       * The reducer resolves, rather than accepting resolved times.
       *
       * The edit carries *intent* — "this happens after that" — and the absolute times are
       * computed here, so a surface cannot supply a different answer than the relationships
       * imply. Same reasoning as `extend-slide`, and it is what makes FR-029's "resolves to
       * absolute timing values" a property of the editor rather than of one component.
       */
      const events = eventsOf(slide)
      const chosen = new Map(edit.relationships.map((r) => [r.eventKey, r.relationship]))
      const ordered = events.map((event) => chosen.get(keyOf(event)) ?? ({ kind: 'custom' } as const))
      const changes = resolveSequence(events, ordered)

      const unlocked = new Set(movable.map((e) => e.id))
      for (const change of changes) {
        const [elementId, effectId] = change.eventKey.split(':')
        if (!elementId || !unlocked.has(elementId)) continue
        const el = elements.find((e) => e.id === elementId)
        if (!el) continue

        if (effectId === undefined) {
          ;(el as { startMs: number }).startMs = change.startMs
          if (change.endMs !== undefined) (el as { endMs: number }).endMs = change.endMs
        } else {
          const list = (el as { effects?: Record<string, unknown>[] }).effects ?? []
          const effect = list.find((e) => e['id'] === effectId)
          if (effect) effect['startMs'] = change.startMs
        }
      }
      return undefined
    }

    /**
     * Grow the slide until it contains everything on it (FR-038).
     *
     * The edit carries no target: the reducer computes it from the draft, so a surface cannot
     * offer a number the overrun does not imply. FR-038 is an *offer with a computed
     * duration*, and a control able to supply its own would let "extend to fit" produce a
     * slide that still overruns.
     *
     * The inverse — a duration *reduced* below an existing end — is deliberately not handled
     * here. BR-017 requires that nothing be silently clamped: the authored values stay and
     * the overrun is reported, which is what US5's surface exists to do.
     */
    case 'extend-slide': {
      const target = requiredDurationMs(slide)
      if (target <= slide.durationMs) {
        return fail('unsupported', 'Everything on this slide already fits inside it.')
      }
      ;(slide as { durationMs: number }).durationMs = target
      return undefined
    }

    case 'reorder': {
      const { missing } = partitionLocked(slide, edit.ids)
      if (missing.length > 0) return fail('not-found', `No element "${missing[0]}" on this slide.`, missing[0])
      // Reordering a locked element is allowed: BR-011 makes locking a guard against
      // *transforms*, not a general freeze, and layer order is not geometry.
      reorderBy(elements, new Set(edit.ids), edit.direction)
      return undefined
    }

    case 'set-flag': {
      // Deliberately no locked guard. It must not apply to the edit that *unlocks*, or a
      // locked element could never be recovered (contracts/edit-contract.md).
      for (const id of edit.ids) {
        const el = elements.find((e) => e.id === id)
        if (!el) return fail('not-found', `No element "${id}" on this slide.`, id)
        el[edit.flag] = edit.value
      }
      return undefined
    }

    case 'duplicate': {
      for (const id of edit.ids) {
        const el = elements.find((e) => e.id === id)
        if (!el) return fail('not-found', `No element "${id}" on this slide.`, id)
        const copy = clone(el) as Element & { id: string; x: number; y: number; zIndex: number }
        const newId = ctx.nextId()
        created.push(newId)
        copy.id = newId
        copy.x += DUPLICATE_OFFSET_UNITS
        copy.y += DUPLICATE_OFFSET_UNITS
        copy.zIndex = elements.reduce((m, e) => Math.max(m, e.zIndex), -1) + 1
        elements.push(copy)
      }
      return undefined
    }

    case 'paste': {
      for (const source of edit.elements) {
        const copy = clone(source) as Element & { id: string; zIndex: number }
        const newId = ctx.nextId()
        created.push(newId)
        copy.id = newId
        copy.zIndex = elements.reduce((m, e) => Math.max(m, e.zIndex), -1) + 1
        elements.push(copy)
      }
      return undefined
    }

    case 'delete': {
      const missing = edit.ids.filter((id) => !elements.some((e) => e.id === id))
      if (missing.length > 0) return fail('not-found', `No element "${missing[0]}" on this slide.`, missing[0])
      slide.elements = elements.filter((e) => !edit.ids.includes(e.id)) as Slide['elements']
      return undefined
    }

    case 'align': {
      if (edit.ids.length < 2) {
        return fail('unsupported', 'Aligning needs at least two elements.')
      }
      const { movable, missing } = partitionLocked(slide, edit.ids)
      if (missing.length > 0) return fail('not-found', `No element "${missing[0]}" on this slide.`, missing[0])
      if (movable.length === 0) return fail('locked', 'Every selected element is locked.')
      applyGeometries(movable, alignEdges(movable.map(geometryOf), edit.edge))
      return undefined
    }

    case 'distribute': {
      if (edit.ids.length < 3) {
        return fail('unsupported', 'Distributing needs at least three elements.')
      }
      const { movable, missing } = partitionLocked(slide, edit.ids)
      if (missing.length > 0) return fail('not-found', `No element "${missing[0]}" on this slide.`, missing[0])
      if (movable.length < 3) return fail('locked', 'Too many of the selected elements are locked.')
      applyGeometries(movable, distributeEvenly(movable.map(geometryOf), edit.axis))
      return undefined
    }
  }
}

function applyGeometries(elements: Element[], geometries: readonly Geometry[]): void {
  elements.forEach((el, i) => {
    const g = geometries[i]
    if (!g) return
    el.x = g.x
    el.y = g.y
  })
}

/**
 * Move the named elements one place through the paint order.
 *
 * A swap with the adjacent neighbour, not an increment. Incrementing was the first
 * implementation and it silently did nothing: adding one makes the moved element's `zIndex`
 * *equal* to its neighbour's, and renormalising by a stable sort then restores the original
 * order. "Bring forward" appeared to work and did not, which is the kind of defect that ships.
 *
 * A swap is also exact whatever the starting values, which an increment is not — nothing in
 * the format guarantees the authored indices are contiguous.
 *
 * Ties are legal and the resolver breaks them by array position (FR-028), so paint order is
 * well defined before and after. Rewriting the indices as a contiguous run afterwards is what
 * lets a second press move a second time.
 */
function reorderBy(
  elements: Element[],
  ids: ReadonlySet<string>,
  direction: 'forward' | 'backward',
): void {
  const position = new Map(elements.map((e, i) => [e.id, i]))
  const ordered = [...elements].sort(
    (a, b) => a.zIndex - b.zIndex || position.get(a.id)! - position.get(b.id)!,
  )

  if (direction === 'forward') {
    // From the top down, so a multiple selection does not collide with its own members.
    for (let i = ordered.length - 2; i >= 0; i -= 1) {
      if (ids.has(ordered[i]!.id) && !ids.has(ordered[i + 1]!.id)) {
        ;[ordered[i], ordered[i + 1]] = [ordered[i + 1]!, ordered[i]!]
      }
    }
  } else {
    for (let i = 1; i < ordered.length; i += 1) {
      if (ids.has(ordered[i]!.id) && !ids.has(ordered[i - 1]!.id)) {
        ;[ordered[i], ordered[i - 1]] = [ordered[i - 1]!, ordered[i]!]
      }
    }
  }

  ordered.forEach((el, i) => {
    el.zIndex = i
  })
}
