import { describe, expect, it } from 'vitest'
import { buildTracks } from '../../src/timeline/tracks.js'
import { element, hidden, locked, notYet, noLonger, slide } from '../harness/corpus.js'
import { overlappingEffects, effectAfterElementEnds, staggered } from '../harness/timeline.js'

/**
 * A track exists because an element exists, not because it is on screen.
 *
 * This is feature 005's ghosts decision arriving in a second place. `RenderState.elements`
 * is documented as *visible elements only* — a hidden element is absent by design (BR-010),
 * and so is one outside its window. A timeline built from it would lose a track exactly
 * when the teacher wants to change the timing that made it disappear.
 *
 * Pure: no DOM, no `resolve`. The `.pure.` in the filename puts this in the `node` project,
 * where a module that starts reaching for a browser fails to run rather than quietly
 * growing the dependency.
 */

describe('buildTracks', () => {
  it('gives every element exactly one track, in paint order', () => {
    const tracks = buildTracks(slide(staggered()))
    expect(tracks).toHaveLength(3)
    expect(tracks.map((t) => t.startMs)).toEqual([0, 2000, 5000])
    expect(tracks.map((t) => t.endMs)).toEqual([2000, 5000, 8000])
  })

  it('copies the authored times exactly — SC-001 is zero divergence', () => {
    const el = element({ startMs: 1234, endMs: 5678 })
    const [track] = buildTracks(slide([el]))
    expect(track).toMatchObject({ elementId: el.id, startMs: 1234, endMs: 5678 })
  })

  it('gives a hidden element a track, because it still has timing to author (FR-003)', () => {
    const el = hidden()
    const [track] = buildTracks(slide([el]))
    expect(track?.elementId).toBe(el.id)
    expect(track?.hidden).toBe(true)
  })

  it('gives a locked element a track, marked locked (FR-016)', () => {
    const [track] = buildTracks(slide([locked()]))
    expect(track?.locked).toBe(true)
  })

  it('gives an element outside its window a track, at either end (FR-003)', () => {
    const tracks = buildTracks(slide([notYet(), noLonger()]))
    expect(tracks).toHaveLength(2)
  })

  it('produces no tracks for an empty slide, and does not throw', () => {
    expect(buildTracks(slide([]))).toEqual([])
  })

  it('draws two overlapping effects as two bars rather than collapsing them', () => {
    const [track] = buildTracks(slide([overlappingEffects()]))
    expect(track?.effects).toHaveLength(2)
    expect(track?.effects.map((e) => e.startMs)).toEqual([0, 500])
    // endMs is derived: startMs + durationMs, because the format stores a duration.
    expect(track?.effects.map((e) => e.endMs)).toEqual([1000, 1500])
  })

  it('keeps an effect that runs after its element has gone', () => {
    // Authorable — `Effect.startMs` is slide time, not element time — and the timeline is
    // required to say the effect would never run rather than to hide it.
    const [track] = buildTracks(slide([effectAfterElementEnds()]))
    expect(track?.endMs).toBe(2000)
    expect(track?.effects[0]?.startMs).toBe(5000)
  })

  it('names each track, so a keyboard user hears which one they are on', () => {
    const [track] = buildTracks(slide([element({ payload: { text: 'Opening line' } })]))
    expect(track?.label).toContain('Opening line')
  })
})

describe('buildTracks does not consult the resolver', () => {
  /**
   * The negative promise, and the one worth its own test.
   *
   * Every element here is outside the window at time zero, so `resolve(slide, 0).elements`
   * would be empty. A full set coming back is the proof that the draft, not the render
   * state, is what was read.
   */
  it('returns a full set for a slide nothing would render at time zero', () => {
    const tracks = buildTracks(slide([notYet(), notYet(), notYet()]))
    expect(tracks).toHaveLength(3)
  })

  it('returns a full set when every element is hidden', () => {
    const tracks = buildTracks(slide([hidden(), hidden()]))
    expect(tracks).toHaveLength(2)
  })
})
