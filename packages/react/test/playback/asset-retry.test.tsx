import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, mediaElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { mediaPorts, degenerate } from '../harness/media.js'
import type { Transport } from '@cuestack/core'

/**
 * FR-029: a failed required asset can be retried **without restarting the lesson**.
 *
 * The clause that matters is the second one. A retry that started the lesson over would cost
 * a learner everything they had done, which is a worse outcome than the failure — and it is
 * the shortcut a naive implementation reaches for, because remounting everything obviously
 * works.
 */

async function mount() {
  const ports = mediaPorts()
  degenerate.fails(ports.media, 'v')
  let transport: Transport | null = null
  const container = await client(
    h(LessonPlayer, {
      lesson: lessonOf([
        slide([mediaElement({ id: 'v', payload: { volume: 0 } })], {
          durationMs: 8000,
          advance: { mode: 'after_media_ends', mediaElementId: 'v' },
        }),
        slide([element({ id: 'after', endMs: 60_000, effects: [] })], { durationMs: 4000 }),
      ]),
      ports,
      autoPlay: true,
      onReady: (t: Transport) => {
        transport = t
      },
    }),
  )
  const retry = () =>
    [...container.querySelectorAll('button')].find((b) => /try again/i.test(b.textContent ?? ''))
  const skip = () =>
    [...container.querySelectorAll('button')].find((b) => /skip/i.test(b.textContent ?? ''))
  return { container, ports, retry, skip, transport: () => transport! }
}

describe('retrying a failed asset', () => {
  it('offers a retry', async () => {
    const { retry } = await mount()
    expect(retry()).toBeDefined()
  })

  it('does not restart the lesson', async () => {
    const { retry, transport } = await mount()
    await act(async () => {
      transport().seek(3000)
    })
    const before = transport().slideTimeMs
    await act(async () => {
      retry()!.click()
    })
    expect(transport().slideIndex).toBe(0)
    expect(transport().slideTimeMs).toBeGreaterThanOrEqual(before)
  })

  it('asks the element for its source again', async () => {
    // A browser will not re-fetch a `src` it already failed on unless the element is new, so
    // the retry remounts. The alternative — a cache-busting query parameter — changes a URL
    // the host gave us and defeats their caching on every later load.
    const { container, retry } = await mount()
    const before = container.querySelector('[data-cs-element-id="v"]')
    await act(async () => {
      retry()!.click()
    })
    const after = container.querySelector('[data-cs-element-id="v"]')
    expect(after).not.toBe(before)
  })

  it('clears the problem as soon as the condition resolves', async () => {
    /**
     * Note what this does *not* do: it never presses retry.
     *
     * A first version did, and could not — the alert had already gone by the time it looked
     * for the button. The player re-evaluates every tick, so the problem disappears the
     * instant the asset is healthy, whatever caused that. The retry button is what makes a
     * browser ask again (the remount above); it is not what dismisses the message, and
     * writing it as though it were would have encoded a state machine that does not exist.
     */
    const { container, ports } = await mount()
    expect(container.querySelector('[role="alert"]')).not.toBeNull()

    await act(async () => {
      ports.media.attach('v', { durationMs: 5000, failed: false, paused: false })
    })
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    })
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('offers a way past it that is not a retry', async () => {
    // Retrying a network that is genuinely down never helps. A learner must be able to leave.
    const { skip, transport } = await mount()
    expect(skip()).toBeDefined()
    await act(async () => {
      skip()!.click()
    })
    expect(transport().slideIndex).toBe(1)
  })

  it('offers no skip on the final slide, where there is nowhere to go', async () => {
    const ports = mediaPorts()
    degenerate.fails(ports.media, 'v')
    const container = await client(
      h(LessonPlayer, {
        lesson: lessonOf([
          slide([mediaElement({ id: 'v', payload: { volume: 0 } })], {
            durationMs: 8000,
            advance: { mode: 'after_media_ends', mediaElementId: 'v' },
          }),
        ]),
        ports,
        autoPlay: true,
      }),
    )
    const skip = [...container.querySelectorAll('button')].find((b) => /skip/i.test(b.textContent ?? ''))
    expect(skip).toBeUndefined()
  })
})
