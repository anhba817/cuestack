import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'
import type { Transport } from '@cuestack/core'

/**
 * FR-023 / FR-PLY-012: a decorative asset failing must not interrupt the slide.
 *
 * The distinction the requirement draws is between an asset the slide *needs* and one it
 * merely has. A background image that will not load is a worse-looking slide; the same
 * failure on the video a slide is gated on is a learner who cannot continue. Only the second
 * is worth stopping for.
 */

const decorated = () =>
  lessonOf([
    slide(
      [
        element({ id: 'words', endMs: 60_000, effects: [] }),
        element({
          id: 'decoration',
          type: 'image',
          endMs: 60_000,
          effects: [],
          // An opaque id with no resolver: unresolvable, and so rendered as the
          // reserved-space fallback rather than as a broken image.
          payload: { asset: { assetId: 'asset_missing', mimeType: 'image/webp', width: 400, height: 300 } },
        }),
      ],
      { durationMs: 3000 },
    ),
    slide([element({ id: 'after', endMs: 60_000, effects: [] })], { durationMs: 3000 }),
  ])

async function mount() {
  const ports = testPorts()
  let transport: Transport | null = null
  const container = await client(
    h(LessonPlayer, {
      lesson: decorated(),
      ports,
      autoPlay: true,
      onReady: (t: Transport) => {
        transport = t
      },
    }),
  )
  return { container, ports, transport: () => transport! }
}

describe('a decorative asset that fails', () => {
  it('leaves the rest of the slide rendered', async () => {
    const { container } = await mount()
    expect(container.querySelector('[data-cs-element-id="words"]')).not.toBeNull()
  })

  it('reserves its space rather than collapsing the layout', async () => {
    const { container } = await mount()
    expect(container.querySelector('.cs-asset-fallback')).not.toBeNull()
    expect(container.querySelector('[data-cs-element-id="decoration"]')).not.toBeNull()
  })

  it('does not stop the lesson advancing', async () => {
    // The decisive difference from a *required* asset. A broken decoration is not a reason
    // to strand the learner.
    const { ports, transport } = await mount()
    await runFrames(ports, 3200)
    expect(transport().slideIndex).toBe(1)
  })

  it('does not show the learner an error for it', async () => {
    // FR-023 says the slide plays normally. Reporting a decorative failure would train
    // learners to ignore the reports that matter.
    const { container } = await mount()
    expect(container.textContent).not.toMatch(/error|failed|could not/i)
  })
})
