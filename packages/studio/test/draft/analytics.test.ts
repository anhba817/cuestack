import { describe, expect, it } from 'vitest'
import type { LessonEvent } from '@cuestack/core'
import { applyEdit } from '../../src/draft/reducer.js'
import { countingIds } from '../harness/ids.js'
import { element, emptySlide, lessonWith } from '../harness/corpus.js'

/**
 * T057 — FR-048, FR-AN-001, FR-AN-004.
 *
 * The privacy clause is the interesting half, and it holds by construction rather than by
 * review: `LessonEvent` has no field a learner identifier could occupy. This suite asserts
 * that rather than trusting it, because "carries no PII" is the kind of claim that decays
 * silently when a field is added.
 */
function recorder() {
  const events: LessonEvent[] = []
  return { events, adapter: { record: (e: LessonEvent) => void events.push(e) } }
}

describe('element insertion is reported', () => {
  it('emits one event naming the lesson, slide, and type', () => {
    const { events, adapter } = recorder()
    const draft = emptySlide()

    applyEdit(draft, { kind: 'add-element', type: 'text' }, {
      mode: 'edit',
      nextId: countingIds(),
      analytics: adapter,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      kind: 'element_inserted',
      lessonId: draft.lesson.id,
      slideId: draft.slides[0]!.id,
      elementType: 'text',
    })
  })

  it('carries no learner identifier, because there is no field for one', () => {
    const { events, adapter } = recorder()
    applyEdit(emptySlide(), { kind: 'add-element', type: 'shape' }, {
      mode: 'edit',
      nextId: countingIds(),
      analytics: adapter,
    })

    const keys = Object.keys(events[0]!)
    for (const forbidden of ['userId', 'learnerId', 'email', 'name', 'sessionId']) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('reports every route to an insertion, not only the menu', () => {
    const { events, adapter } = recorder()
    const ctx = { mode: 'edit' as const, nextId: countingIds(), analytics: adapter }

    applyEdit(emptySlide(), { kind: 'add-element', type: 'text' }, ctx)
    applyEdit(emptySlide(), { kind: 'add-element', type: 'image' }, ctx)

    expect(events.map((e) => e.elementType)).toEqual(['text', 'image'])
  })

  it('emits nothing for an edit that is not an insertion', () => {
    const { events, adapter } = recorder()
    const draft = lessonWith([element()])

    applyEdit(draft, { kind: 'transform-elements', ids: [draft.slides[0]!.elements[0]!.id], geometry: { x: 5 } }, {
      mode: 'edit',
      nextId: countingIds(),
      analytics: adapter,
    })

    expect(events).toEqual([])
  })

  it('emits nothing when the insertion is refused', () => {
    const { events, adapter } = recorder()
    applyEdit(emptySlide(), { kind: 'add-element', type: 'hologram' }, {
      mode: 'edit',
      nextId: countingIds(),
      analytics: adapter,
    })

    expect(events).toEqual([])
  })

  it('is optional — an edit succeeds with no adapter at all', () => {
    const result = applyEdit(emptySlide(), { kind: 'add-element', type: 'text' }, {
      mode: 'edit',
      nextId: countingIds(),
    })
    expect(result.ok).toBe(true)
  })
})
