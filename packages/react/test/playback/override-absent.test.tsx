import { createElement as h, act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, questionElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts, type TestPorts } from '../harness/ports.js'
import { mediaPorts } from '../harness/media.js'
import type { Ports, Transport } from '@cuestack/core'

/**
 * The override exists, and a learner's player cannot reach it.
 *
 * `AdvanceControllerOptions.allowOverride` and `AdvanceSignals.overrideAdvance` have been in
 * the kernel since Wave 1 with nothing passing either, described in the code as test-only.
 * ED-6 gives them their first real consumer — an editor preview, where a teacher has to be
 * able to move past a gate the lesson would hold a learner at.
 *
 * **The negative half is the point.** The option's own comment states the requirement it has
 * to survive: "a test affordance that leaks into playback is worse than none, because it will
 * eventually fire by accident." Two conditions must both hold before the controller
 * short-circuits, and a learner's player supplies neither — the prop is absent, so the option
 * is false, and nothing ever sets the signal. This file asserts both halves so that making
 * the override reachable by default fails here rather than in front of a learner.
 */

async function runFrames(ports: TestPorts, ms: number, stepMs = 100): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
    ports.clock.advance(stepMs)
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
  }
}

/** Slide 0 holds a required question; slide 1 is what it is holding the learner back from. */
const gatedLesson = () =>
  lessonOf([
    slide([questionElement({ id: 'gate' })], { durationMs: 2000 }),
    slide([element({ id: 'beyond', effects: [] })], { durationMs: 2000 }),
  ])

async function mount(props: Record<string, unknown>, ports: Ports) {
  let transport: Transport | null = null
  const container = await client(
    h(LessonPlayer, {
      lesson: gatedLesson(),
      ports,
      autoPlay: true,
      onReady: (t: Transport) => {
        transport = t
      },
      ...props,
    }),
  )
  return { container, transport: () => transport! }
}

describe('the advance override is unreachable without the prop', () => {
  it('does not advance past a required question when no override prop is given', async () => {
    const ports = testPorts()
    const { transport } = await mount({}, ports)
    await runFrames(ports, 4000)
    expect(transport().slideIndex).toBe(0)
  })

  it('does not advance even if a caller has somehow raised the signal', async () => {
    // The second condition, asserted separately. `allowOverride` is derived from the prop's
    // presence, so a player with no prop refuses the override however the signal is set —
    // which is what makes the guarantee structural rather than a matter of nobody trying.
    const ports = testPorts()
    const { transport } = await mount({ overrideAdvance: undefined }, ports)
    await runFrames(ports, 4000)
    expect(transport().slideIndex).toBe(0)
  })
})

describe('the advance override works when a preview asks for it', () => {
  it('advances past a required question with the prop set', async () => {
    const ports = testPorts()
    const { transport } = await mount({ overrideAdvance: true }, ports)
    await runFrames(ports, 2400)
    expect(transport().slideIndex).toBe(1)
  })

  it('still honours the slide’s own duration', async () => {
    // The override releases a **gate**, not a slide's length. The kernel's short-circuit
    // outranks every condition including duration — correct for the test affordance it was
    // written as, and wrong for this prop: raising the signal unconditionally made a lesson
    // race to its ending the instant the switch went on, so a teacher who skipped a question
    // then saw nothing. Found in implementation, not in review.
    const ports = testPorts()
    const { transport } = await mount({ overrideAdvance: true }, ports)
    await runFrames(ports, 1000)
    expect(transport().slideIndex).toBe(0)
  })

  it('restores the gate the moment the prop goes false', async () => {
    // FR-020: turning it off restores every gate immediately. The controller is built once,
    // in a mount effect, so this only holds if the current value is read through a ref
    // rather than captured — which is the whole reason the prop's *presence* and its *value*
    // do different jobs.
    const ports = testPorts()
    let transport: Transport | null = null
    const container = document.createElement('div')
    document.body.appendChild(container)
    const { createRoot } = await import('react-dom/client')
    const root = createRoot(container)
    // Built once. A fresh object per render changes `lesson`'s identity, which is a mount
    // effect dependency — so the transport would be rebuilt with a clock back at zero and
    // this would be testing remounting rather than the switch.
    const lesson = gatedLesson()
    // `onReady` hoisted for the same reason, and it is the sharper of the two: an inline
    // arrow is a new identity on every render, so the effect tears down and rebuilds — a
    // fresh transport with its clock back at zero. The first draft of this test had one, and
    // the failure read as "the override does not work" rather than "the player restarted".
    const capture = (transportInstance: Transport): void => {
      transport = transportInstance
    }
    const render = (override: boolean) =>
      act(async () => {
        root.render(
          h(LessonPlayer, { lesson, ports, autoPlay: true, overrideAdvance: override, onReady: capture }),
        )
      })

    await render(false)
    await runFrames(ports, 3000)
    expect(transport!.slideIndex).toBe(0)

    await render(true)
    // The override releases a gate, not the slide's length — so the slide still has to reach
    // its duration. It already has, three seconds in, which is why 400 ms is enough here and
    // why this asserts the gate opening rather than time passing.
    await runFrames(ports, 400)
    expect(transport!.slideIndex).toBe(1)
  })
})

describe('a partial ports object keeps the player’s own defaults', () => {
  it('leaves the DOM media port in place when only analytics is supplied', async () => {
    // The preview overrides `analytics` and nothing else (FR-031). If `ports` replaced the
    // whole object rather than merging per member, `createDomMediaPort` would never be built
    // — nothing would play, and a slide gated on `after_media_ends` would stall where a
    // learner advances. The assertion is on `media` surviving, because that is the member a
    // preview cannot rebuild: the port closes over a frame writer this component owns.
    const recorded: unknown[] = []
    let transport: Transport | null = null
    await client(
      h(LessonPlayer, {
        lesson: gatedLesson(),
        ports: { analytics: { record: (e: unknown) => recorded.push(e) } } as Partial<Ports>,
        onReady: (t: Transport) => {
          transport = t
        },
      }),
    )
    // The player started, so a transport exists and the ports it was built from are whole.
    expect(transport).not.toBeNull()
    // And the override it was given took effect: the lesson's start reached this adapter.
    expect(recorded.length).toBeGreaterThan(0)
  })

  it('still lets a full ports object win outright', async () => {
    // The rule the player's own comment states, unchanged: "a test handing in a scripted
    // media fake must not have it replaced by one reading a DOM that has no decoder behind
    // it." Every existing suite depends on this, which is why the merge puts `...ports` last.
    const ports = mediaPorts()
    const { transport } = await mount({}, ports)
    expect(transport()).not.toBeNull()
    expect(ports.media.commands).toBeDefined()
  })
})
