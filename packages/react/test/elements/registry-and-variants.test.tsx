import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { client, server } from '../harness/render.js'
import { LessonPlayer } from '../../src/server.js'
import { LessonPlayer as ClientPlayer, createRendererRegistry, usePlayer } from '../../src/index.js'
import { builtinRenderers } from '../../src/elements/builtin/index.js'
import { elementProperties, visualProperties } from '../../src/frame/applyVisual.js'
import { testPorts } from '../harness/ports.js'
import type { ResolvedElement } from '@cuestack/core'

/**
 * The paths the story-level suites do not reach: registry misuse, every shape variant,
 * payloads with fields omitted, and `usePlayer` outside a player.
 *
 * Written because widening the coverage floor to `packages/react/src` (T078) showed them
 * uncovered rather than to make a number go up. Each one is a real branch: an error message
 * nobody has read is an error message nobody can rely on, and three of the four shape
 * variants had never been rendered by anything.
 */

const renderOne = (overrides: Record<string, unknown>): string =>
  server(h(LessonPlayer, { lesson: lessonOf([slide([element({ effects: [], ...overrides })])]) }))

describe('the renderer registry', () => {
  const stub = { type: 'stub', Component: () => null, label: 'Stub' }

  it('registers, finds, and lists renderers', () => {
    const registry = createRendererRegistry([stub])
    expect(registry.has('stub')).toBe(true)
    expect(registry.get('stub')).toBe(stub)
    expect(registry.get('missing')).toBeUndefined()
    expect(registry.types()).toEqual(['stub'])
  })

  it('accepts a renderer registered after construction', () => {
    const registry = createRendererRegistry()
    registry.register(stub)
    expect(registry.types()).toEqual(['stub'])
  })

  it('sorts the type list, so two registries never differ by insertion order', () => {
    const registry = createRendererRegistry([{ ...stub, type: 'z' }, { ...stub, type: 'a' }])
    expect(registry.types()).toEqual(['a', 'z'])
  })

  it('rejects a renderer with no label, saying why it matters', () => {
    // The reason the check exists is in the message: a renderer without a label is
    // unannounceable, and that is discovered by a learner using a screen reader rather
    // than by a test. An error nobody has read is an error nobody can rely on.
    expect(() => createRendererRegistry([{ type: 'x', Component: () => null } as never])).toThrow(
      /label/,
    )
    expect(() => createRendererRegistry([{ type: 'x', Component: () => null } as never])).toThrow(
      /screen reader/,
    )
  })

  it('rejects a renderer with no component, naming the type', () => {
    expect(() => createRendererRegistry([{ type: 'x', label: 'X' } as never])).toThrow(/"x"/)
  })

  it('rejects an unnamed renderer without crashing on the name', () => {
    expect(() => createRendererRegistry([{} as never])).toThrow(/<unnamed>/)
  })

  it('overwrites a re-registered type, so a host can replace a built-in', () => {
    const registry = createRendererRegistry(builtinRenderers)
    const replacement = { type: 'text', Component: () => null, label: 'Custom text' }
    registry.register(replacement)
    expect(registry.get('text')).toBe(replacement)
  })
})

describe('every shape variant renders', () => {
  // Three of the four had never been rendered by any test: the corpus uses `rect`.
  it.each([
    ['rect', 'rect'],
    ['ellipse', 'ellipse'],
    ['line', 'line'],
    ['arrow', 'polygon'],
  ])('%s draws an SVG %s', (shape, tag) => {
    const markup = renderOne({ type: 'shape', payload: { shape } })
    expect(markup).toContain(`<${tag}`)
    expect(markup).toContain('aria-hidden="true"')
  })

  it('falls back to a rectangle when the shape is missing', () => {
    expect(renderOne({ type: 'shape', payload: {} })).toContain('<rect')
  })
})

describe('payloads with fields omitted', () => {
  it('renders text with no text as empty rather than throwing', () => {
    expect(renderOne({ type: 'text', payload: {} })).toContain('cs-element-text')
  })

  it('renders an image with no dimensions, without inventing any', () => {
    const markup = renderOne({
      type: 'image',
      payload: { asset: { assetId: 'https://e.test/a.png', mimeType: 'image/png' } },
      accessibility: { altText: 'A picture' },
    })
    expect(markup).toContain('<img')
    expect(markup).not.toMatch(/width="/)
  })

  it('renders a video without controls when the author turned them off', () => {
    const markup = renderOne({
      type: 'video',
      payload: {
        asset: { assetId: 'https://e.test/v.mp4', mimeType: 'video/mp4' },
        showControls: false,
      },
    })
    expect(markup).toMatch(/<video/)
    expect(markup).not.toMatch(/<video[^>]*\scontrols/)
  })

  it('renders a video poster when authored', () => {
    const markup = renderOne({
      type: 'video',
      payload: {
        asset: { assetId: 'https://e.test/v.mp4', mimeType: 'video/mp4' },
        poster: 'https://e.test/p.jpg',
      },
    })
    expect(markup).toContain('poster="https://e.test/p.jpg"')
  })

  it('renders a button with no label as something still announceable', () => {
    const markup = renderOne({ type: 'button', payload: { action: 'next_slide' } })
    expect(markup).toMatch(/<button[^>]*>Button</)
  })

  it('renders an open_url button as a link that does not steal the tab', () => {
    const markup = renderOne({
      type: 'button',
      payload: { label: 'Read the policy', action: 'open_url', url: 'https://e.test/policy' },
    })
    expect(markup).toMatch(/<a[^>]*href="https:\/\/e\.test\/policy"/)
    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('rel="noreferrer"')
  })

  it('renders an open_url button with no url as a button, not a broken link', () => {
    const markup = renderOne({ type: 'button', payload: { label: 'Go', action: 'open_url' } })
    expect(markup).toMatch(/<button/)
    expect(markup).not.toMatch(/<a[^>]*href/)
  })

  it('renders a question with no options as a labelled group all the same', () => {
    const markup = renderOne({
      type: 'question',
      payload: { interactionType: 'true_false', prompt: 'Why?', correctResponse: 'a', required: false },
    })
    expect(markup).toContain('role="radiogroup"')
    expect(markup).not.toContain('type="radio"')
  })
})

describe('visual properties', () => {
  const base: ResolvedElement = {
    id: 'e',
    type: 'text',
    geometry: { x: 1, y: 2, width: 3, height: 4, rotation: 5 },
    zIndex: 6,
    opacity: 1,
    transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotate: 0 },
    filter: null,
    activeEffects: [],
    payload: {},
    accessibility: null,
    available: true,
  }

  it('emits nothing for an element at rest', () => {
    // The stylesheet's fallbacks supply every identity value, so an untouched element costs
    // no properties at all.
    expect(visualProperties(base)).toEqual({})
  })

  it('emits a filter only when one is present', () => {
    expect(visualProperties({ ...base, filter: { brightness: 1.4, blur: 8 } })).toEqual({
      '--cs-brightness': '1.4',
      '--cs-blur': '8',
    })
  })

  it('emits only what an effect changed', () => {
    const moved = { ...base, opacity: 0.5, transform: { ...base.transform, translateX: 40, rotate: 15 } }
    expect(visualProperties(moved)).toEqual({
      '--cs-opacity': '0.5',
      '--cs-tx': '40',
      '--cs-rotate': '15',
    })
  })

  it('always emits geometry, which is authored rather than changed', () => {
    expect(elementProperties(base)).toMatchObject({
      '--cs-x': '1',
      '--cs-y': '2',
      '--cs-w': '3',
      '--cs-h': '4',
      '--cs-rotation': '5',
      '--cs-z': '6',
    })
  })
})

describe('usePlayer', () => {
  it('gives a host the transport the player is using', async () => {
    let seen: ReturnType<typeof usePlayer> | null = null
    function Probe() {
      seen = usePlayer()
      return null
    }
    const lesson = lessonOf([slide([element({ effects: [] })], { durationMs: 8000 })])
    await client(h(ClientPlayer, { lesson, ports: testPorts() }, h(Probe, null)))
    expect(seen).not.toBeNull()
    // Available by the time effects have flushed, and the duration is there from the first
    // render because it is authored rather than computed.
    expect(seen!.transport?.slideTimeMs).toBe(0)
    expect(seen!.slideDurationMs).toBe(8000)
  })

  it('is callable by a child before the player has mounted', async () => {
    // The defect this replaced: the provider was rendered only once the transport existed, so
    // `usePlayer()` threw for every child on its first render — the documented way for a host
    // to drive playback, unusable by a host. It now returns a null transport instead.
    const seen: Array<ReturnType<typeof usePlayer>['transport']> = []
    function Probe() {
      seen.push(usePlayer().transport)
      return null
    }
    const lesson = lessonOf([slide([element({ effects: [] })], { durationMs: 8000 })])
    await client(h(ClientPlayer, { lesson, ports: testPorts() }, h(Probe, null)))
    expect(seen[0]).toBeNull()
    expect(seen.at(-1)).not.toBeNull()
  })

  it('throws outside a player, because that is a mistake rather than a moment', async () => {
    function Orphan() {
      usePlayer()
      return null
    }
    await expect(client(h(Orphan, null))).rejects.toThrow(/inside a <LessonPlayer>/)
  })
})
