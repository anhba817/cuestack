import { describe, expect, it } from 'vitest'
import { createMediaLink } from '../../src/media/link.js'
import { fakeMedia, degenerate } from '../harness/media.js'

/**
 * The one place the transport and the media port meet.
 *
 * In `@cuestack/core` rather than in the adapter, deliberately: what a media position
 * *means* for a lesson is a rule about lessons, and only the part touching an
 * `HTMLMediaElement` is React's. Put this in the adapter and a second adapter reimplements
 * it, which is two implementations of "which clock is right".
 */

describe('commands reach the port', () => {
  it('seeks the media when the lesson seeks', () => {
    const media = fakeMedia()
    media.attach('el', { durationMs: 5000 })
    const link = createMediaLink(media)

    link.seek('el', 3000)
    expect(media.commands).toEqual([{ kind: 'seek', elementId: 'el', positionMs: 3000 }])
  })

  it('pauses and resumes the media with the lesson', () => {
    const media = fakeMedia()
    media.attach('el', { durationMs: 5000, paused: false })
    const link = createMediaLink(media)
    // The renderer registers the element. The port answers about ids you name and exposes no
    // enumeration, so a link that was never told cannot pause what it does not know about.
    link.attach('el')

    link.pauseAll()
    expect(media.query('el')?.paused).toBe(true)
    link.resumeAll()
    expect(media.query('el')?.paused).toBe(false)
  })

  it('resumes from the stopped position rather than the beginning (FR-016)', () => {
    const media = fakeMedia()
    media.attach('el', { durationMs: 5000, positionMs: 2200, paused: false })
    const link = createMediaLink(media)
    link.attach('el')

    link.pauseAll()
    link.resumeAll()
    expect(media.query('el')?.positionMs).toBe(2200)
  })

  it('commands nothing for an element that is not attached', () => {
    // Fire-and-forget: a command for an element with no media element behind it is not an error
    // the kernel can act on. It must not throw.
    const media = fakeMedia()
    const link = createMediaLink(media)
    expect(() => link.seek('missing', 1000)).not.toThrow()
  })
})

describe('what the link knows about the media', () => {
  it('takes the duration from the file, not the manifest', () => {
    // The manifest's figure is authoring metadata and may be wrong; the learner watches the
    // file. An adapter is required to report the file's.
    const media = fakeMedia()
    media.attach('el', { durationMs: 4200 })
    const link = createMediaLink(media)
    expect(link.statusOf('el')?.durationMs).toBe(4200)
  })

  it('reports a duration it does not yet know as null rather than as zero', () => {
    // Zero is a duration. Null is the absence of one, and a slide gated on media end must
    // be able to tell them apart.
    const media = fakeMedia()
    media.attach('el')
    const link = createMediaLink(media)
    expect(link.statusOf('el')?.durationMs).toBeNull()
  })

  it('reports failure rather than never reporting', () => {
    const media = fakeMedia()
    degenerate.fails(media, 'el')
    const link = createMediaLink(media)
    expect(link.statusOf('el')?.failed).toBe(true)
  })

  it('reports zero duration as zero, which is a real answer', () => {
    const media = fakeMedia()
    degenerate.zeroDuration(media, 'el')
    const link = createMediaLink(media)
    expect(link.statusOf('el')?.durationMs).toBe(0)
  })
})

describe('following the media when the learner moves it', () => {
  it('reports a scrub outside tolerance to its listener', () => {
    const media = fakeMedia()
    media.attach('el', { durationMs: 20_000, positionMs: 0 })
    const link = createMediaLink(media)

    const seeks: number[] = []
    link.subscribe((_elementId, positionMs) => seeks.push(positionMs))

    media.report('el', { positionMs: 12_000 })
    expect(seeks).toEqual([12_000])
  })

  it('does not report the echo of its own command', () => {
    const media = fakeMedia()
    media.attach('el', { durationMs: 20_000 })
    const link = createMediaLink(media)

    const seeks: number[] = []
    link.subscribe((_elementId, positionMs) => seeks.push(positionMs))

    link.seek('el', 8000)
    expect(seeks).toEqual([])
  })
})
