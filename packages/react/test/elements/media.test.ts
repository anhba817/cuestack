import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { server } from '../harness/render.js'
import { LessonPlayer } from '../../src/server.js'

/**
 * US4 #4 · FR-016.
 *
 * Video exposes its caption track and audio its transcript, where the author supplied
 * them. Both render with native controls in this wave and are not synchronised to lesson
 * time — that is Wave 3, and the media port is read-only until then.
 */

const url = (name: string) => `https://example.test/${name}`

const render = (el: ReturnType<typeof element>, resolveAsset?: (ref: { assetId: string }) => string | undefined) =>
  server(
    h(LessonPlayer, {
      lesson: lessonOf([slide([el])]),
      ...(resolveAsset ? { resolveAsset } : {}),
    }),
  )

const videoEl = (asset: Record<string, unknown>, payload: Record<string, unknown> = {}) =>
  element({ id: 'vid', type: 'video', effects: [], payload: { asset, showControls: true, ...payload } })

const audioEl = (asset: Record<string, unknown>, payload: Record<string, unknown> = {}) =>
  element({ id: 'aud', type: 'audio', effects: [], payload: { asset, showControls: true, ...payload } })

describe('the video renderer', () => {
  const asset = {
    assetId: url('briefing.mp4'),
    mimeType: 'video/mp4',
    width: 1920,
    height: 1080,
    durationMs: 28500,
    captionTrack: url('briefing.vtt'),
  }

  it('renders a real video element with native controls', () => {
    const markup = render(videoEl(asset))
    expect(markup).toMatch(/<video[^>]*controls/)
  })

  it('exposes the caption track as a default track', () => {
    // `default` matters: a track present but not default is captions the learner has to
    // find, which for a compliance lesson is the same as not having them.
    const markup = render(videoEl(asset))
    expect(markup).toMatch(/<track[^>]*kind="captions"/)
    expect(markup).toMatch(/<track[^>]*default/)
  })

  it('omits the track element when no captions were authored', () => {
    // An empty `<track>` with no src makes a browser show a captions control that does
    // nothing, which is worse than showing none.
    const { captionTrack: _unused, ...noCaptions } = asset
    expect(render(videoEl(noCaptions))).not.toContain('<track')
  })

  it('declares its dimensions so the slide holds shape before the poster arrives', () => {
    const markup = render(videoEl(asset))
    expect(markup).toMatch(/width="1920"/)
    expect(markup).toMatch(/height="1080"/)
  })

  it('respects the authored loop and mute-by-volume settings', () => {
    expect(render(videoEl(asset, { loop: true }))).toMatch(/<video[^>]*loop/)
    expect(render(videoEl(asset, { volume: 0 }))).toMatch(/<video[^>]*muted/)
  })

  it('never autoplays from the server render', () => {
    // BR-014 requires a gesture for audible playback and Wave 3 enforces it. Emitting
    // `autoplay` now would make the server-rendered frame violate a rule the client is
    // not yet in a position to check.
    expect(render(videoEl(asset))).not.toContain('autoplay')
  })

  it('falls back with reserved space when the asset cannot be addressed', () => {
    const markup = render(videoEl({ assetId: 'asset_briefing_video', mimeType: 'video/mp4', width: 1920, height: 1080 }))
    expect(markup).toContain('cs-asset-fallback')
    expect(markup).not.toContain('<video')
  })
})

describe('the audio renderer', () => {
  const asset = {
    assetId: url('ambient.mp3'),
    mimeType: 'audio/mpeg',
    durationMs: 30000,
    transcript: url('ambient.txt'),
  }

  it('renders a real audio element with native controls', () => {
    expect(render(audioEl(asset))).toMatch(/<audio[^>]*controls/)
  })

  it('links the transcript where one was authored', () => {
    // Audio has no visual channel at all, so the transcript is the only route to the
    // content for a learner who cannot hear it. A link, not a caption track: there is
    // nothing to overlay captions onto.
    const markup = render(audioEl(asset))
    expect(markup).toMatch(/<a[^>]*href="https:\/\/example\.test\/ambient\.txt"/)
    expect(markup).toMatch(/transcript/i)
  })

  it('omits the transcript link when none was authored', () => {
    const { transcript: _unused, ...noTranscript } = asset
    expect(render(audioEl(noTranscript))).not.toMatch(/<a[^>]*href/)
  })

  it('is announced, since an audio player with no name is an unlabelled control', () => {
    expect(render(audioEl(asset))).toMatch(/aria-label="[^"]+"/)
  })

  it('honours a host resolver over the default', () => {
    const markup = render(
      audioEl({ assetId: 'asset_ambient_audio', mimeType: 'audio/mpeg', durationMs: 30000 }),
      (ref) => `https://cdn.test/${ref.assetId}.mp3`,
    )
    expect(markup).toContain('https://cdn.test/asset_ambient_audio.mp3')
    expect(markup).not.toContain('cs-asset-fallback')
  })
})
