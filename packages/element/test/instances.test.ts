import { afterEach, describe, expect, it } from 'vitest'
import { mount, rendered } from './harness/mount.js'
import { covered } from './harness/lessons.js'

const open: { unmount(): void }[] = []
afterEach(() => {
  for (const m of open.splice(0)) m.unmount()
})

describe('two lessons on one page', () => {
  it('play independently', async () => {
    const a = await mount(covered())
    const b = await mount(covered())
    open.push(a, b)

    await a.advance(4500)

    // `later` enters at 4000ms. Only the instance whose clock moved should have it.
    expect(rendered(a.root).has('later')).toBe(true)
    expect(rendered(b.root).has('later')).toBe(false)
  })

  it('cannot reach each other', async () => {
    const a = await mount(covered())
    const b = await mount(covered())
    open.push(a, b)
    expect(a.root).not.toBe(b.root)
    expect(a.root.querySelectorAll('[data-cs-element-id]').length).toBeGreaterThan(0)
  })

  it('cancel the frame loop on disconnect', async () => {
    /**
     * The one that gets forgotten. A rAF loop started in `connectedCallback` and not cancelled in
     * `disconnectedCallback` runs forever — and the symptom is a page that gets slower the longer
     * somebody uses it, which nobody traces back to a lesson they closed.
     */
    const original = globalThis.requestAnimationFrame
    let live = 0
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      live += 1
      return original(cb)
    }) as typeof requestAnimationFrame

    const m = await mount(covered())
    await m.advance(300)
    const whileMounted = live

    m.unmount()
    await new Promise((r) => setTimeout(r, 50))
    const afterUnmount = live

    globalThis.requestAnimationFrame = original
    expect(whileMounted).toBeGreaterThan(0)
    // A loop that kept scheduling would have grown this well past its mounted count.
    expect(afterUnmount - whileMounted).toBeLessThanOrEqual(2)
  })
})
