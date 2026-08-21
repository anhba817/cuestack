import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserPorts } from '../src/ports.js'

const setVisibility = (state: 'visible' | 'hidden'): void => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => setVisibility('visible'))

/**
 * The ports a real host actually gets — **the one path that had no test at all.**
 *
 * Every one of this package's other suites injects `ports` so lesson time can be driven by hand,
 * which Constitution II requires. The consequence is that the default branch, the code every real
 * embedding runs, never executed. A defect lived there: the default `visibility.subscribe` was
 * `() => () => undefined`, so a backgrounded tab never paused the lesson and a learner who switched
 * away came back to one that had run on without them. The React player pauses; this did not.
 *
 * `@cuestack/react`'s `browserPorts.ts` opens by recording the identical lesson — *"every test that
 * exercised playback passed `ports`, so the one path a real host takes was the one path untested"*.
 * That was written when the player hit this, and it did not carry across, because it lives in a
 * comment in another package. This file is the version that does carry.
 */
describe('the ports a real host gets', () => {
  it('reads time from a monotonic source', () => {
    const { time } = browserPorts()
    const first = time()
    const second = time()
    expect(typeof first).toBe('number')
    // `performance.now`, not `Date.now`: a system clock adjustment mid-lesson must not move a
    // learner backwards. The same reason `browserPorts.ts` gives.
    expect(second).toBeGreaterThanOrEqual(first)
  })

  it('reports whether the tab is hidden', () => {
    const { visibility } = browserPorts()
    setVisibility('visible')
    expect(visibility.isHidden()).toBe(false)
    setVisibility('hidden')
    expect(visibility.isHidden()).toBe(true)
  })

  it('tells a subscriber when the tab is hidden and shown', () => {
    // The defect. An inert `subscribe` type-checks, satisfies `Ports`, and silently means the
    // kernel's `pausedByVisibility` can never fire.
    const seen: boolean[] = []
    const stop = browserPorts().visibility.subscribe((hidden) => seen.push(hidden))

    setVisibility('hidden')
    setVisibility('visible')
    stop()

    expect(seen, 'a hidden tab and a returning one must both be reported').toEqual([true, false])
  })

  it('stops listening when unsubscribed', () => {
    // Or every mounted-and-removed element leaves a listener on `document` — the leak that makes a
    // page slower the longer somebody uses it, which is what `disconnectedCallback` exists to avoid.
    const seen: boolean[] = []
    const stop = browserPorts().visibility.subscribe((hidden) => seen.push(hidden))
    stop()
    setVisibility('hidden')
    expect(seen).toEqual([])
  })

  it('matches the React player, so a learner cannot tell which adapter drew the page', async () => {
    /**
     * FR-011, at the port rather than at the pixel. Compared against the player's source rather than
     * restated: both must read `visibilityState` and both must listen for `visibilitychange`.
     */
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')

    /**
     * **Comments stripped, or the check reads its own prose.** The file below explains that it uses
     * `performance.now` *and not* `Date.now` — so a search of the whole text finds the token in the
     * sentence arguing for it, and swapping the actual call changes nothing. Tried as a control: it
     * passed. That is the fourth time in this feature a pattern has matched commentary instead of
     * code, and every one was found by running the control rather than by reading the test.
     */
    const code = (path: string): string =>
      readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')

    const player = code(
      join(import.meta.dirname, '..', '..', 'react', 'src', 'player', 'browserPorts.ts'),
    )
    const mine = code(join(import.meta.dirname, '..', 'src', 'ports.ts'))

    for (const token of ['visibilitychange', 'visibilityState', 'performance.now']) {
      expect(player, `the player is expected to use ${token}`).toContain(token)
      expect(mine, `this adapter must use ${token} too`).toContain(token)
    }
  })
})

describe('an element with no ports supplied', () => {
  it('still plays, using the real clock', async () => {
    await import('../src/index.js')
    const element = document.createElement('cuestack-lesson')
    element.setAttribute('autoplay', '')
    const { covered } = await import('./harness/lessons.js')
    ;(element as unknown as { manifest: unknown }).manifest = covered()
    document.body.append(element)
    await new Promise<void>((r) => requestAnimationFrame(() => r()))

    // Not a timing assertion — real time cannot be driven by hand, which is why every other suite
    // injects a clock. What this asserts is that the default path renders at all.
    expect(element.shadowRoot?.querySelectorAll('[data-cs-element-id]').length).toBeGreaterThan(0)
    element.remove()
  })

  it('subscribes to visibility rather than ignoring it', async () => {
    const spy = vi.spyOn(document, 'addEventListener')
    await import('../src/index.js')
    const element = document.createElement('cuestack-lesson')
    element.setAttribute('autoplay', '')
    const { covered } = await import('./harness/lessons.js')
    ;(element as unknown as { manifest: unknown }).manifest = covered()
    document.body.append(element)
    await new Promise<void>((r) => requestAnimationFrame(() => r()))

    expect(
      spy.mock.calls.some(([type]) => type === 'visibilitychange'),
      'an element with default ports must hear the tab being hidden',
    ).toBe(true)
    element.remove()
    spy.mockRestore()
  })
})
