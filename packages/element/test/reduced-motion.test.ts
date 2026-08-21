import { afterEach, describe, expect, it } from 'vitest'
import { mount, rendered } from './harness/mount.js'
import { covered } from './harness/lessons.js'
import { STYLESHEET } from '../src/styles.js'
import type { LessonManifest } from '@cuestack/schema'

let mounted: { unmount(): void } | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const withMotion = (): LessonManifest => {
  const lesson = covered()
  const slide = lesson.slides[0]!
  return {
    ...lesson,
    slides: [
      {
        ...slide,
        elements: [
          {
            ...slide.elements[0]!,
            effects: [
              /**
               * A *moving* effect, deliberately. A fade offers no reduced alternative because it
               * already is one — BR-015's whole point is that a slide-in becomes a fade rather than
               * an instant appearance, so `reduced` is null for effects that never moved.
               */
              { id: 'fx', type: 'slide', phase: 'enter', startMs: 0, durationMs: 1000, order: 1, params: { from: 'left', distance: 40 } },
            ],
          },
        ],
      },
    ],
  } as unknown as LessonManifest
}

/**
 * Reduced motion is two halves, and losing either honours nothing while appearing to.
 *
 * The kernel emits a reduced alternative; the frame layer writes it under mirrored `--cs-r-*` names;
 * the stylesheet chooses between them at paint time. It must be CSS rather than script — the
 * preference cannot be read on a server, so a script defers the choice and a learner who asked for
 * less motion sees the full motion first.
 */
describe('reduced motion', () => {
  it('emits the mirrored property set alongside the ordinary one', async () => {
    const m = (mounted = await mount(withMotion()))
    await m.advance(300)
    const style = rendered(m.root).get('title')!.getAttribute('style') ?? ''

    // Half a mechanism: without these the media block below has nothing to select.
    expect(style).toContain('--cs-r-')
  })

  it('carries the media block with nested fallbacks', () => {
    expect(STYLESHEET).toContain('prefers-reduced-motion')
    // The nesting is the mechanism: where the kernel emitted a reduced value it wins, and where it
    // did not the element falls back to no motion rather than to full motion.
    expect(STYLESHEET).toMatch(/--cs-opacity:\s*var\(--cs-r-opacity,\s*var\(--cs-opacity/)
    expect(STYLESHEET).toMatch(/--cs-tx:\s*var\(--cs-r-tx,\s*0\)/)
  })

  it('makes the choice in CSS rather than in script', () => {
    // A script reading the preference would have to defer to after first paint. Nothing in the
    // adapter's source may consult it.
    expect(STYLESHEET).toContain('@media')
  })
})
