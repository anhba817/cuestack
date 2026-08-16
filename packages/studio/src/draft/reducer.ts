import type { Element, LessonManifest, Slide } from '@cuestack/schema'
import { validate } from '@cuestack/schema/validate'
import {
  DUPLICATE_OFFSET_UNITS,
  MIN_EXTENT_UNITS,
} from '../geometry/constants.js'
import { alignEdges, distributeEvenly } from '../geometry/align.js'
import type { Geometry } from '../geometry/types.js'
import { createElementEditorRegistry, builtinElementEditors, type ElementEditorRegistry } from '../registry/editors.js'
import type { Edit, EditContext, EditResult } from './edit.js'

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
  const outcome = dispatch(next, slide, edit, ctx, editors, created)
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
