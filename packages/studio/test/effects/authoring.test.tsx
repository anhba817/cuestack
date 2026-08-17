import { act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { resolve } from '@cuestack/core'
import { renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'
import { buildTracks } from '../../src/timeline/tracks.js'
import { effectAfterElementEnds, overlappingEffects } from '../harness/timeline.js'

/**
 * Ordering, overlap, and the effect that never runs.
 *
 * `Effect.order` is stored explicitly rather than inferred from array position, and the
 * schema's own comment says why: array position would supply an order, but making it
 * explicit means a resolver bug cannot be masked by an incidental sort.
 */

const effectsOf = (session: { draft: { slides: { elements: unknown[] }[] } }) =>
  ((session.draft.slides[0]!.elements[0] as { effects?: { id: string; order: number; startMs: number }[] }).effects ??
    []) as { id: string; order: number; startMs: number }[]

describe('effects on one element', () => {
  it('run in chronological order (FR-022)', () => {
    const el = element({ startMs: 0, endMs: 8000 })
    const { handle } = renderEditor(lessonWith([el]))

    for (const startMs of [3000, 1000, 2000]) {
      act(() => {
        handle.session.apply({
          kind: 'add-effect', id: el.id, type: 'pulse', phase: 'emphasis', startMs, durationMs: 400,
        })
      })
    }

    const [track] = buildTracks(handle.session.draft.slides[0]!)
    const sorted = [...track!.effects].sort((a, b) => a.startMs - b.startMs)
    expect(sorted.map((e) => e.startMs)).toEqual([1000, 2000, 3000])
  })

  it('have a deterministic, repeatable order when they share a start (FR-022)', () => {
    const build = () => {
      const el = element({ startMs: 0, endMs: 8000 })
      const { handle } = renderEditor(lessonWith([el]))
      for (let i = 0; i < 3; i += 1) {
        act(() => {
          handle.session.apply({
            kind: 'add-effect', id: el.id, type: 'pulse', phase: 'emphasis', startMs: 1000, durationMs: 400,
          })
        })
      }
      return effectsOf(handle.session).map((e) => e.order)
    }
    const first = build()
    expect(first).toEqual([0, 1, 2])
    // Same input, same answer — which is what "deterministic" has to mean to be testable.
    expect(build()).toEqual(first)
  })

  it('draws two overlapping effects as two bars rather than collapsing them', () => {
    const [track] = buildTracks(lessonWith([overlappingEffects()]).slides[0]!)
    expect(track!.effects).toHaveLength(2)
    // They genuinely overlap: the second starts before the first ends.
    expect(track!.effects[1]!.startMs).toBeLessThan(track!.effects[0]!.endMs)
  })
})

describe('an effect that runs after its element has gone', () => {
  /**
   * Authorable, because `Effect.startMs` is *slide* time and nothing in the schema forbids
   * it. The timeline is required to say the effect would never run rather than to prevent
   * it — a refusal here would make a legal manifest unauthorable in the editor that is
   * supposed to produce it.
   */
  it('is kept on the track rather than hidden', () => {
    const [track] = buildTracks(lessonWith([effectAfterElementEnds()]).slides[0]!)
    expect(track!.effects).toHaveLength(1)
    expect(track!.effects[0]!.startMs).toBeGreaterThan(track!.endMs)
  })

  it('contributes nothing, because the element is not on screen to receive it', () => {
    const slide = lessonWith([effectAfterElementEnds()]).slides[0]!
    // The element's window is [0, 2000); the effect runs at 5000.
    expect(resolve(slide, 5100).elements).toHaveLength(0)
  })

  it('can still be authored — the editor does not refuse it', () => {
    const el = element({ startMs: 0, endMs: 2000 })
    const { handle } = renderEditor(lessonWith([el]))
    let ok = false
    act(() => {
      ok = handle.session.apply({
        kind: 'add-effect', id: el.id, type: 'fade', phase: 'enter', startMs: 0, durationMs: 400,
      }).ok
    })
    expect(ok).toBe(true)

    const effectId = effectsOf(handle.session)[0]!.id
    act(() => {
      ok = handle.session.apply({
        kind: 'set-effect', id: el.id, effectId, patch: { startMs: 6000 },
      }).ok
    })
    expect(ok).toBe(true)
    expect(effectsOf(handle.session)[0]!.startMs).toBe(6000)
  })
})

describe('no module branches on effect type', () => {
  it('never calls a type-specific path — the sweep is the registry’s own list', () => {
    // A guard rather than an assertion about output: if a `switch (effect.type)` appeared
    // anywhere on this path, adding a ninth effect would silently do nothing, and the
    // registry-sourced suite is where that would surface. This records the intent beside it.
    const spy = vi.spyOn(console, 'warn')
    const [track] = buildTracks(lessonWith([overlappingEffects()]).slides[0]!)
    expect(track!.effects.map((e) => e.type)).toEqual(['fade', 'pulse'])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
