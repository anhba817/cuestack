import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { memoryAdapters, type Ports } from '@cuestack/core'
import { LessonPlayer } from '@cuestack/react'
import { mount } from './harness/mount.js'
import { twoSlides, withEffects } from './harness/lessons.js'
import { COVERED, NOT_COVERED } from '../src/covered.js'
import { STYLESHEET } from '../src/styles.js'

/**
 * FR-011. One lesson, both adapters, matched instants — and a *report* of what differs.
 *
 * **Why it lives in a vitest suite rather than in `tools/scripts/`.** A plain node process has
 * neither React nor a DOM, so it cannot drive either adapter; the existing parity gate solves the
 * same problem the same way, by spawning vitest rather than computing in-process.
 *
 * **Why it reports rather than fails.** Preview-versus-playback is one renderer compared against
 * itself, so any difference is a bug and it gates. This is two renderers by design over one kernel:
 * one draws a notice where the other draws a video, and that disagreement is the specification. What
 * a reader wants from this is the disagreement that *isn't* — a kernel value arriving differently in
 * the two — and encoding which differences are permitted is exactly the list that goes stale.
 *
 * So the assertions below are narrow and the output is wide: it fails only on the shared-kernel
 * properties for the shared-covered types, and prints everything either side did with the rest.
 */

/** Every property both adapters take straight from the kernel. Geometry and opacity, not styling. */
const KERNEL_PROPERTIES = [
  '--cs-x',
  '--cs-y',
  '--cs-w',
  '--cs-h',
  '--cs-z',
  '--cs-opacity',
  /**
   * **The effect properties, without which SC-005's own suite skipped SC-005's hardest clause.**
   *
   * The criterion reads "the same slides, elements, and *effects* at the same times", and the first
   * version of this list stopped at geometry and opacity — over fixtures that carried no effect at
   * all. So the comparison ran, reported no differences, and had never once asked the question the
   * criterion is about.
   *
   * Transform and filter are listed separately on purpose: they reach CSS by different routes, and
   * an adapter can implement one and drop the other. This is not hypothetical — it is what was
   * found the moment these lines were added.
   */
  '--cs-rotation',
  '--cs-tx',
  '--cs-ty',
  '--cs-sx',
  '--cs-sy',
  '--cs-rotate',
  '--cs-brightness',
  '--cs-blur',
] as const

/**
 * The instants sampled. Chosen to straddle the **slide boundary** at 4000ms, not merely a couple of
 * element lifetimes — the earlier set stayed inside one slide, so the comparison had never once
 * asked whether the two adapters change slide at the same moment, which is the largest thing they
 * could disagree about.
 */
const INSTANTS = [0, 2000, 3900, 4600, 7500] as const

interface Reading {
  readonly elementId: string
  readonly properties: Record<string, string>
}

const readElement = (node: Element): Reading => {
  const style = (node as HTMLElement).style
  const properties: Record<string, string> = {}
  for (const name of KERNEL_PROPERTIES) properties[name] = style.getPropertyValue(name).trim()
  return { elementId: node.getAttribute('data-cs-element-id') ?? '?', properties }
}

const readAll = (root: ParentNode): Reading[] =>
  [...root.querySelectorAll('[data-cs-element-id]')].map(readElement)

describe('the two adapters agree about what the kernel decided', () => {
  it('reports every difference, and fails only on the shared properties', async () => {
    const lesson = twoSlides()

    // React's `act` needs telling it is in a test environment, or every update it schedules is
    // deferred and the container stays empty — which is how the first run of this suite reported
    // twelve differences, all of them "present in element only", and still passed.
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

    const web = await mount(lesson)

    /**
     * The React package publishes no test harness, so the player is driven through its own public
     * surface — which is the right way round for this suite anyway: a comparison reaching into
     * either adapter's internals would compare implementations rather than what a host gets.
     *
     * **A full `Ports`, not the two members the element adapter needs**, and `autoPlay`. The first
     * draft passed neither, and the React player rendered its first frame and then held it — every
     * later instant reported `later` as "present in element only", which read exactly like a
     * finding about element lifetimes and was a harness that had never pressed play. The web
     * component has no such switch: it plays when it has a manifest, because it has no controls to
     * offer a host and nothing to wait for. That is a genuine difference between the two, and the
     * first thing this suite had to account for rather than report.
     */
    let now = 0
    const reactPorts: Ports = {
      time: () => now,
      media: {
        query: () => null,
        subscribe: () => () => undefined,
        play: () => undefined,
        pause: () => undefined,
        seek: () => undefined,
      },
      visibility: { isHidden: () => false, subscribe: () => () => undefined },
      ...memoryAdapters(),
    }

    const container = document.createElement('div')
    document.body.append(container)
    const { createRoot } = await import('react-dom/client')
    const { act } = await import('react')
    const root = createRoot(container)
    await act(async () => {
      root.render(h(LessonPlayer, { lesson, ports: reactPorts, autoPlay: true }))
    })

    const differences: string[] = []
    const disagreements: string[] = []
    /**
     * How many elements were actually seen by *both* adapters.
     *
     * Guarded because the interesting failure of a comparison is comparing nothing. This suite's
     * first run had React rendering an empty container: every element was "present in element only",
     * `disagreements` stayed empty because a missing side cannot disagree about a value, and it
     * reported a clean pass. A count is the difference between "they agree" and "nothing was asked".
     */
    let compared = 0
    /** Which elements both sides drew, so "crossed the slide boundary" is checked, not assumed. */
    const seenIds = new Set<string>()

    let previous = 0
    for (const instant of INSTANTS) {
      /**
       * **Both clocks step in 100ms increments, and that is load-bearing rather than tidy.**
       *
       * The kernel clamps a single tick — machine sleep and a paused debugger produce enormous
       * deltas and none of them happened to the learner. So a clock jumped from 0 to 5000 in one
       * frame does not advance a lesson by five seconds; it advances it by the ceiling. The element
       * harness already stepped, and the first draft of this suite jumped React's clock in one go,
       * which left the player frozen near zero while the element adapter played on. The report read
       * `later: present in element only` and looked exactly like a finding about element lifetimes.
       *
       * Comparing two adapters means advancing them the same way, not merely to the same number.
       */
      const step = instant - previous
      previous = instant
      await web.advance(step)
      for (let elapsed = 0; elapsed < step; elapsed += 100) {
        now += Math.min(100, step - elapsed)
        await act(async () => {
          await new Promise<void>((r) => requestAnimationFrame(() => r()))
        })
      }

      const fromWeb = new Map(readAll(web.root).map((r) => [r.elementId, r]))
      const fromReact = new Map(readAll(container).map((r) => [r.elementId, r]))
      compared += [...fromWeb.keys()].filter((id) => fromReact.has(id)).length
      for (const id of fromWeb.keys()) if (fromReact.has(id)) seenIds.add(id)

      for (const id of new Set([...fromWeb.keys(), ...fromReact.keys()])) {
        const a = fromWeb.get(id)
        const b = fromReact.get(id)
        if (!a || !b) {
          differences.push(`${instant}ms  ${id}: present in ${a ? 'element' : 'react'} only`)
          continue
        }
        for (const name of KERNEL_PROPERTIES) {
          if (a.properties[name] !== b.properties[name]) {
            const line = `${instant}ms  ${id}  ${name}: element=${a.properties[name]!} react=${b.properties[name]!}`
            differences.push(line)
            disagreements.push(line)
          }
        }
      }
    }

    // The report. Read by `check:agreement`, which prints it and exits zero whatever it says.
    console.log(
      [
        '--- adapter agreement ---',
        `covered by both: ${COVERED.join(', ')}`,
        `element renders as unavailable: ${NOT_COVERED.join(', ')}`,
        `instants sampled: ${INSTANTS.join(', ')}ms`,
        `properties compared: ${KERNEL_PROPERTIES.join(', ')}`,
        differences.length === 0
          ? 'no differences on the compared properties'
          : `${differences.length} difference(s):\n  ${differences.join('\n  ')}`,
        '--- end ---',
      ].join('\n'),
    )

    root.unmount()
    container.remove()
    web.unmount()

    // Non-vacuity first: a clean report over an empty comparison is the failure this cannot hide.
    expect(
      compared,
      'both adapters must have rendered the same elements to compare them',
    ).toBeGreaterThanOrEqual(INSTANTS.length)

    /**
     * Both slides, not one slide twice. Widening the instants to straddle the boundary is only
     * useful if the run actually crosses it — an adapter stuck on slide one would otherwise agree
     * perfectly with itself and report exactly the clean line above.
     */
    expect([...seenIds].sort(), 'the comparison must cross the slide boundary').toEqual([
      'first',
      'second',
    ])

    // The narrow assertion: for the types both adapters draw, a kernel value must arrive the same.
    expect(disagreements.join('\n'), 'shared kernel properties must agree').toBe('')
  })

  it('agrees about what effects computed, frame by frame', async () => {
    /**
     * SC-005's hardest clause, and the one its suite skipped: *effects* at the same times.
     *
     * Sampled densely and inside the effects' own windows rather than at round numbers. An effect is
     * a curve, and two implementations can agree at its endpoints while disagreeing everywhere
     * between — sampling at 0 and at the end is how a comparison of animation reports agreement
     * about two static frames.
     */
    const lesson = withEffects()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

    const web = await mount(lesson)
    let now = 0
    const reactPorts: Ports = {
      time: () => now,
      media: {
        query: () => null,
        subscribe: () => () => undefined,
        play: () => undefined,
        pause: () => undefined,
        seek: () => undefined,
      },
      visibility: { isHidden: () => false, subscribe: () => () => undefined },
      ...memoryAdapters(),
    }

    const container = document.createElement('div')
    document.body.append(container)
    const { createRoot } = await import('react-dom/client')
    const { act } = await import('react')
    const root = createRoot(container)
    await act(async () => {
      root.render(h(LessonPlayer, { lesson, ports: reactPorts, autoPlay: true }))
    })

    const differences: string[] = []
    let sampled = 0
    let moved = 0

    for (let instant = 0; instant <= 4000; instant += 200) {
      if (instant > 0) {
        await web.advance(200)
        for (let elapsed = 0; elapsed < 200; elapsed += 100) {
          now += 100
          await act(async () => {
            await new Promise<void>((r) => requestAnimationFrame(() => r()))
          })
        }
      }

      const fromWeb = new Map(readAll(web.root).map((r) => [r.elementId, r]))
      const fromReact = new Map(readAll(container).map((r) => [r.elementId, r]))

      for (const [id, a] of fromWeb) {
        const b = fromReact.get(id)
        if (!b) continue
        sampled += 1
        for (const name of KERNEL_PROPERTIES) {
          if (a.properties[name] !== b.properties[name]) {
            differences.push(
              `${instant}ms  ${id}  ${name}: element=${a.properties[name]!} react=${b.properties[name]!}`,
            )
          }
          // Count the frames where an effect was actually mid-flight, so "they agree" cannot mean
          // "nothing was animating at any instant we looked".
          if (name !== '--cs-opacity' && name.startsWith('--cs-') && a.properties[name]) moved += 1
        }
      }
    }

    root.unmount()
    container.remove()
    web.unmount()

    expect(sampled, 'both adapters must render the effect-bearing elements').toBeGreaterThan(20)
    expect(moved, 'at least one effect must have been mid-flight at some sampled instant').toBeGreaterThan(0)
    expect(differences.join('\n'), 'effect values must agree at every sampled instant').toBe('')
  })

  it('lays a lesson out at the same pixels as the player, evaluated not compared as text', async () => {
    /**
     * **The blind spot that let a whole-layout divergence survive nine analysis passes.**
     *
     * Every other comparison in this file reads `style.getPropertyValue(...)` — the custom
     * properties an adapter *writes*. Those are the inputs to CSS. Two adapters can write identical
     * inputs and interpret them completely differently, and for a long time these two did: the
     * player resolved `width` to a proportion of the canvas through container-query units, and this
     * adapter resolved it to `calc(400 * 1px)` — a fixed physical size, twice the player's on an
     * 800px page, overflowing rather than scaling. Both wrote `--cs-x: 0`. Nothing could see it.
     *
     * **Evaluated rather than string-compared**, using the player's own CSS evaluator. Its header
     * makes the argument better than this one can: `calc(var(--cs-x) / var(--cs-canvas-h) * 100cqw)`
     * has the right *shape* and the wrong axis, and only arithmetic catches that. happy-dom
     * implements no layout and no container-query units, so evaluating the declarations is the only
     * way to compare two stylesheets here at all.
     *
     * Imported across packages from a **test** directory — which T003's dependency rules permit
     * deliberately, being scoped to `src`, and which `@cuestack/react` being a devDependency makes
     * resolvable. Both halves are needed and neither works alone.
     */
    const { declarationsFor, resolveValue, stageBox } = await import(
      '../../react/test/harness/css.js'
    )

    const stageVars = { '--cs-canvas-w': '1600', '--cs-canvas-h': '900' }
    const elementVars = { '--cs-x': '120', '--cs-y': '90', '--cs-w': '400', '--cs-h': '80' }
    const AVAILABLE = 800

    const box = (css: string | undefined): Record<string, number> => {
      const container = stageBox(AVAILABLE, stageVars)
      const decls = declarationsFor('.cs-element', css)
      const vars = { ...stageVars, ...elementVars }
      return Object.fromEntries(
        (['left', 'top', 'width', 'height'] as const).map((name) => {
          const value = decls[name]
          if (value === undefined) throw new Error(`.cs-element declares no ${name}`)
          return [name, resolveValue(value, vars, container)]
        }),
      )
    }

    // `undefined` reads the player's own stage.css; STYLESHEET is what this adapter puts in its
    // shadow root. Two stylesheets, one evaluator, one set of numbers.
    const player = box(undefined)
    const element = box(STYLESHEET)

    // Non-vacuity: a 400-unit element on a 1600-unit canvas at 800px available is 200px. If both
    // sides returned zero this would pass while proving nothing.
    expect(player['width'], 'the player must scale to the container').toBeCloseTo(200, 5)

    expect(element, 'the two adapters must lay out identically').toEqual(player)

    /**
     * **What this cannot catch, established by control rather than by argument.** Three deliberate
     * breakages were tried against it:
     *
     * - fixed-pixel layout (the defect this test exists for) — caught;
     * - wrong divisor, right unit, which is the harness header's own example
     *   `var(--cs-y) / var(--cs-canvas-w) * 100cqh` — caught;
     * - divisor *and* unit swapped together, `var(--cs-y) / var(--cs-canvas-w) * 100cqw` —
     *   **not caught, and correctly so.** The stage's aspect ratio is derived from the canvas, so
     *   `cqh / cqw` is exactly `canvas-h / canvas-w`, which makes `y/H*100cqh` and `y/W*100cqw`
     *   algebraically identical for every value. No arithmetic can distinguish them because there
     *   is nothing to distinguish; a matched swap is a different spelling of the same rule.
     */
  })

  it('states which types the comparison covers, so the report is not read as more than it is', () => {
    /**
     * A report saying "the adapters agree" when it means "the adapters agree about text and shapes"
     * is worse than no report. The covered set is asserted here so the claim and the coverage cannot
     * drift apart — adding a type to `COVERED` without widening the fixture fails this.
     */
    expect([...COVERED]).toEqual(['text', 'shape', 'image'])
    expect(NOT_COVERED.length).toBeGreaterThan(0)
  })
})
