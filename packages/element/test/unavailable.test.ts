import { afterEach, describe, expect, it } from 'vitest'
import { mount, rendered } from './harness/mount.js'
import { uncovered, withImage } from './harness/lessons.js'

let mounted: { unmount(): void } | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

/**
 * With a proof-scoped adapter this is the **ordinary** path, not the edge one — four of the seven
 * element types take it. An element that rendered nothing would read as breakage; one that says it
 * cannot be shown reads as an absence, which is what it is.
 */
describe('what this adapter cannot show', () => {
  it('reports a video and a question rather than rendering a gap', async () => {
    const m = (mounted = await mount(uncovered()))
    const nodes = rendered(m.root)

    for (const id of ['clip', 'quiz']) {
      const node = nodes.get(id)
      expect(node, `${id} should still occupy its place`).toBeTruthy()
      expect(node!.dataset['csUnavailable']).toBe('true')
      expect(node!.textContent?.trim().length).toBeGreaterThan(0)
    }
  })

  it('occupies the element geometry, so the slide does not reflow around a hole', async () => {
    const m = (mounted = await mount(uncovered()))
    expect(rendered(m.root).get('clip')!.style.getPropertyValue('--cs-w')).toBe('400')
  })

  it('says which type it could not show', async () => {
    const m = (mounted = await mount(uncovered()))
    expect(rendered(m.root).get('clip')!.textContent).toContain('video')
  })

  it('treats an image with no resolver the same way', async () => {
    // Not a broken picture: an image whose address nobody can supply is an element this adapter
    // cannot show, and it says so in the same words as the rest.
    const m = (mounted = await mount(withImage()))
    expect(rendered(m.root).get('diagram')!.dataset['csUnavailable']).toBe('true')
  })

  it('renders an image when the host supplies a resolver', async () => {
    const m = (mounted = await mount(withImage(), {
      resolveAsset: (id) => `https://cdn.test/${id}.png`,
    }))
    const node = rendered(m.root).get('diagram')!
    expect(node.dataset['csUnavailable']).toBeUndefined()
    expect(node.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/asset_i.png')
    // The author's alt text, carried through rather than invented.
    expect(node.querySelector('img')?.getAttribute('alt')).toBe('A diagram')
  })
})
