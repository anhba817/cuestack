import { afterEach, describe, expect, it, vi } from 'vitest'
import '../src/index.js'
import { mount, fakePorts, frame, type Mounted } from './harness/mount.js'
import { covered, twoSlides } from './harness/lessons.js'

let mounted: Mounted | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

/**
 * The host-facing surface [contracts/element-adapter.md](../../../specs/011-docs-and-web-components/contracts/element-adapter.md)
 * declares: two attributes, three methods, four events.
 *
 * **The first version of this file tested none of that**, and the task that asked for it was marked
 * done — `observedAttributes` returned `['src', 'autoplay']` with no `attributeChangedCallback` to
 * honour either, which is worse than not declaring them: it announces an intent the class does not
 * have. Found by reading the contract clause by clause against the code, the same way FR-010's
 * transitions were found. A test file named after a contract is not the same as a test of it.
 */
describe('the host-facing surface', () => {
  it('registers itself on import, under one name', () => {
    expect(customElements.get('cuestack-lesson')).toBeTypeOf('function')
  })

  it('survives being imported twice', async () => {
    // A host with two bundles, or a page importing both the element and something re-exporting it,
    // would otherwise throw `NotSupportedError` on the second define and take the page with it.
    await expect(import('../src/index.js')).resolves.toBeDefined()
    expect(customElements.get('cuestack-lesson')).toBeTypeOf('function')
  })

  it('takes a manifest as a property, and gives it back', async () => {
    const lesson = covered()
    const m = (mounted = await mount(lesson))
    expect((m.element as unknown as { manifest: unknown }).manifest).toBe(lesson)
  })

  it('renders nothing until it has one', () => {
    const element = document.createElement('cuestack-lesson')
    document.body.append(element)
    // Connected with no manifest is a host that has not fetched yet, not an error.
    expect(element.shadowRoot?.querySelectorAll('[data-cs-element-id]')).toHaveLength(0)
    element.remove()
  })

  it('keeps its rendering inside a shadow root', async () => {
    const m = (mounted = await mount(covered()))
    expect(m.element.shadowRoot).toBeTruthy()
    expect(m.element.children).toHaveLength(0)
  })

  it('stops its loop when removed', async () => {
    const m = (mounted = await mount(covered()))
    const before = m.root.innerHTML
    m.element.remove()
    await m.advance(2000)
    // A detached element that kept animating is a leak surviving navigation in a single-page app.
    expect(m.root.innerHTML).toBe(before)
  })
})

describe('play, pause, and seek', () => {
  it('does not play until asked, when autoplay is absent', async () => {
    const m = (mounted = await mount(twoSlides(), { autoplay: false }))
    await m.advance(5000)
    // Still on slide one: nothing pressed play. The React player behaves the same way, and a host
    // embedding a lesson below the fold wants exactly this.
    expect(m.root.querySelector('[data-cs-element-id="first"]')).toBeTruthy()
    expect(m.root.querySelector('[data-cs-element-id="second"]')).toBeNull()
  })

  it('plays when the attribute is present', async () => {
    const m = (mounted = await mount(twoSlides()))
    await m.advance(4200)
    expect(m.root.querySelector('[data-cs-element-id="second"]')).toBeTruthy()
  })

  it('plays when the host calls play()', async () => {
    const m = (mounted = await mount(twoSlides(), { autoplay: false }))
    ;(m.element as unknown as { play(): void }).play()
    await m.advance(4200)
    expect(m.root.querySelector('[data-cs-element-id="second"]')).toBeTruthy()
  })

  it('stops advancing when the host calls pause()', async () => {
    const m = (mounted = await mount(twoSlides()))
    await m.advance(1000)
    ;(m.element as unknown as { pause(): void }).pause()
    await m.advance(6000)
    expect(m.root.querySelector('[data-cs-element-id="second"]')).toBeNull()
  })

  it('goes to a slide by id', async () => {
    const m = (mounted = await mount(twoSlides(), { autoplay: false }))
    ;(m.element as unknown as { seekToSlide(id: string): void }).seekToSlide('slide_1')
    await frame()
    expect(m.root.querySelector('[data-cs-element-id="second"]')).toBeTruthy()
  })

  it('ignores a slide id that is not in the lesson', async () => {
    const m = (mounted = await mount(twoSlides(), { autoplay: false }))
    // A host passing a stale id gets nothing, not an exception it did not ask to handle.
    expect(() =>
      (m.element as unknown as { seekToSlide(id: string): void }).seekToSlide('nope'),
    ).not.toThrow()
    expect(m.root.querySelector('[data-cs-element-id="first"]')).toBeTruthy()
  })
})

describe('the four events', () => {
  const record = (): { seen: Array<{ type: string; detail: unknown }>; on: Record<string, (e: Event) => void> } => {
    const seen: Array<{ type: string; detail: unknown }> = []
    const on: Record<string, (e: Event) => void> = {}
    for (const type of ['cuestack:started', 'cuestack:slide', 'cuestack:completed', 'cuestack:problem']) {
      on[type] = (e) => seen.push({ type: e.type, detail: (e as CustomEvent).detail })
    }
    return { seen, on }
  }

  it('announces the start, each slide, and the end', async () => {
    const { seen, on } = record()
    const m = (mounted = await mount(twoSlides(), { on }))
    await m.advance(9000)

    const types = seen.map((e) => e.type)
    expect(types).toContain('cuestack:started')
    expect(types).toContain('cuestack:slide')
    expect(types).toContain('cuestack:completed')
    // Started once, not once per frame — a host logging this would otherwise flood.
    expect(types.filter((t) => t === 'cuestack:started')).toHaveLength(1)
    expect(types.filter((t) => t === 'cuestack:completed')).toHaveLength(1)
  })

  it('announces the start once across a pause and a resume', async () => {
    /**
     * **The case the assertion above cannot reach**, and the one the guard exists for.
     *
     * `toHaveLength(1)` there passes because `play()` is called exactly once in that test's
     * lifetime — it proves *one call produces one event*, not *repeated calls produce one*. Deleting
     * the `#announcedStart` guard failed nothing, which is how this gap was found: the guard's own
     * comment names the untested path, and the only `pause()` in the suite never resumed.
     *
     * A host logging `cuestack:started` counts lesson starts. A pause is not a second start.
     */
    const seen: string[] = []
    const m = (mounted = await mount(twoSlides(), {
      on: { 'cuestack:started': (e) => seen.push(e.type) },
    }))

    await m.advance(500)
    const element = m.element as unknown as { play(): void; pause(): void }
    element.pause()
    await m.advance(500)
    element.play()
    await m.advance(500)
    element.pause()
    element.play()

    expect(seen, 'a pause and resume is not a second start').toHaveLength(1)
  })

  it('announces completion again when a learner replays the lesson', async () => {
    /**
     * **This was a defect, and the analysis that found it was itself wrong first.**
     *
     * An `#announcedComplete` flag guarded this event, and deleting it failed no test — which read
     * as dead code, because `createAdvanceController` keys decisions on `transport.instanceId` and
     * returns null forever once a slide has decided. That reasoning was right about the *first* pass
     * and wrong about replay: seeking back bumps the visit count, so the last slide gets a new
     * instance id, the kernel decides again, and the flag swallowed the second completion.
     *
     * Measured both ways rather than argued: with the flag, one completion across a replay; without
     * it, two. A host counting completions lost every repeat. The flag is gone and this is why.
     */
    const seen: string[] = []
    const m = (mounted = await mount(twoSlides(), {
      on: { 'cuestack:completed': (e) => seen.push(e.type) },
    }))

    await m.advance(9000)
    expect(seen, 'the lesson completes once').toHaveLength(1)

    ;(m.element as unknown as { seekToSlide(id: string): void }).seekToSlide('slide_0')
    await m.advance(9000)

    expect(seen, 'a learner who plays it again has completed it again').toHaveLength(2)
  })

  it('carries the shapes the contract declares', async () => {
    const { seen, on } = record()
    const m = (mounted = await mount(twoSlides(), { on }))
    await m.advance(9000)

    const started = seen.find((e) => e.type === 'cuestack:started')!.detail as { lessonId: string }
    expect(started.lessonId).toBe('lesson_test')

    const slide = seen.find((e) => e.type === 'cuestack:slide')!.detail as {
      slideId: string
      index: number
    }
    expect(slide.slideId).toBe('slide_0')
    expect(slide.index).toBe(0)

    const completed = seen.find((e) => e.type === 'cuestack:completed')!.detail as {
      lessonId: string
    }
    expect(completed.lessonId).toBe('lesson_test')
  })

  it('reports the slide change, in order', async () => {
    const { seen, on } = record()
    const m = (mounted = await mount(twoSlides(), { on }))
    await m.advance(4200)
    const slides = seen.filter((e) => e.type === 'cuestack:slide').map((e) => (e.detail as { index: number }).index)
    expect(slides).toEqual([0, 1])
  })

  it('bubbles and composes, so a host can listen on an ancestor', async () => {
    const seen: string[] = []
    const host = document.createElement('div')
    document.body.append(host)
    host.addEventListener('cuestack:started', (e) => seen.push(e.type))

    const element = document.createElement('cuestack-lesson')
    element.setAttribute('autoplay', '')
    const withProps = element as HTMLElement & { manifest?: unknown; ports?: unknown }
    withProps.ports = fakePorts()
    withProps.manifest = covered()
    host.append(element)
    await frame()

    // Composed as well as bubbling: without it the event stops at the shadow boundary and a host
    // listening on its own container hears nothing at all.
    expect(seen).toEqual(['cuestack:started'])
    host.remove()
  })

  it('carries nothing about a learner', async () => {
    const { seen, on } = record()
    const m = (mounted = await mount(twoSlides(), { on }))
    await m.advance(9000)

    /**
     * The rule `LessonEvent` follows, enforced by shape rather than by review: there is nowhere for
     * an identifier to go. Asserted against the *whole* detail rather than a field list, so a field
     * added later is caught by this rather than by a privacy review that may not happen.
     */
    const allowed: Record<string, readonly string[]> = {
      'cuestack:started': ['lessonId'],
      'cuestack:slide': ['slideId', 'index'],
      'cuestack:completed': ['lessonId'],
      'cuestack:problem': ['code', 'message', 'slideId', 'elementId'],
    }
    for (const { type, detail } of seen) {
      expect(Object.keys(detail as object).sort()).toEqual(
        Object.keys(detail as object)
          .filter((k) => allowed[type]!.includes(k))
          .sort(),
      )
    }
  })
})

describe('the src attribute', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fetches a lesson named by src', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(covered()), { status: 200 }),
    ) as never

    const element = document.createElement('cuestack-lesson')
    const withProps = element as HTMLElement & { ports?: unknown }
    withProps.ports = fakePorts()
    element.setAttribute('src', '/lessons/x.json')
    element.setAttribute('autoplay', '')
    document.body.append(element)

    await vi.waitFor(() =>
      expect(element.shadowRoot?.querySelector('[data-cs-element-id="title"]')).toBeTruthy(),
    )
    element.remove()
  })

  it('reports a failed fetch rather than staying blank', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 404 })) as never

    const seen: unknown[] = []
    const element = document.createElement('cuestack-lesson')
    const withProps = element as HTMLElement & { ports?: unknown }
    withProps.ports = fakePorts()
    element.addEventListener('cuestack:problem', (e) => seen.push((e as CustomEvent).detail))
    element.setAttribute('src', '/lessons/missing.json')
    document.body.append(element)

    // The element does not retry — §5 makes fetching the host's responsibility — but a silent blank
    // rectangle tells a host nothing, so the failure is reported in the framework's own words.
    await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0))
    expect((seen[0] as { code: string }).code).toBe('LESSON_FETCH_FAILED')
    element.remove()
  })
})
