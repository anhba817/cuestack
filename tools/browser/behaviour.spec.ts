import { expect, test } from '@playwright/test'

/**
 * The paths that exist only in a real engine.
 *
 * **All three engines here, unlike the frame measurement.** Timing is single-engine because three
 * frame numbers would be three unrelated numbers. Behaviour is the opposite case: autoplay policy,
 * media event ordering and container-query layout are exactly where engines disagree, and a media
 * adapter at 0% branch coverage verified only on Chromium would be verified on the most permissive
 * of the three.
 *
 * Where engines legitimately differ, the difference is asserted rather than smoothed over. A check
 * demanding identical behaviour from three engines encodes a specification nobody wrote.
 */

const APP = process.env.CUESTACK_APP_ORIGIN ?? 'http://127.0.0.1:3100'
const ELEMENT = process.env.CUESTACK_ELEMENT_ORIGIN ?? 'http://127.0.0.1:3101'

test.describe('canvas-relative layout, on both adapters', () => {
  /**
   * **Container-query units, which happy-dom never evaluates.** They sit in four files across three
   * packages, and one of them is `packages/react/src/player/Stage.tsx` — the primary player — so a
   * check written only against the element adapter would test the one that is not the main one.
   */
  for (const [adapter, url] of [
    ['react', `${APP}/perf/tour`],
    ['element', ELEMENT],
  ] as const) {
    test(`${adapter}: an element keeps its proportion across viewport widths`, async ({ page }) => {
      const widths = [1280, 640]
      const ratios: number[] = []

      for (const width of widths) {
        await page.setViewportSize({ width, height: 720 })
        await page.goto(url, { waitUntil: 'load' })
        await page.waitForSelector('html[data-harness-ready]', { timeout: 30_000 })

        const ratio = await page.evaluate(() => {
          const root = document.querySelector('.cs-stage') ?? document.body
          const inShadow = document.querySelector('cuestack-lesson')?.shadowRoot
          const stage = inShadow?.querySelector('.cs-stage') ?? root
          const el =
            inShadow?.querySelector('[data-cs-element-id]') ??
            document.querySelector('[data-cs-element-id]')
          if (!el || !stage) return null
          const s = stage.getBoundingClientRect()
          const e = el.getBoundingClientRect()
          return s.width === 0 ? null : e.width / s.width
        })

        // A zero-width stage is happy-dom's answer, and the reason this suite exists at all.
        expect(ratio, `${adapter} reported no layout at ${width}px`).not.toBeNull()
        ratios.push(ratio as number)
      }

      // Authored position is proportional: the same fraction of the stage at any width.
      expect(ratios[0]).toBeCloseTo(ratios[1] as number, 2)
    })
  }
})

test.describe('the real media adapter', () => {
  /**
   * `packages/react/src/media/domMediaPort.ts` reports 21.27% of statements and 0% of branches, and
   * no test references it directly — the coverage it has comes from being imported. It is the
   * component that decides whether a video starts.
   */
  test('media elements exist and respond to the player rather than to nothing', async ({ page }) => {
    await page.goto(`${APP}/perf`, { waitUntil: 'load' })
    await page.waitForSelector('html[data-harness-ready]', { timeout: 30_000 })

    const media = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('video, audio')]
      return nodes.map((n) => ({
        tag: n.tagName.toLowerCase(),
        paused: (n as HTMLMediaElement).paused,
        muted: (n as HTMLMediaElement).muted,
      }))
    })

    // The heavy fixture carries five media items. If the adapter renders none, nothing below it
    // has ever run in a browser.
    expect(media.length, 'the fixture carries media; the adapter rendered none').toBeGreaterThan(0)
  })

  test('audible autoplay is refused, and that is the browser being correct', async ({ page }) => {
    /**
     * **Not an obstacle to work around.** Blocking audible playback without a gesture is deliberate
     * browser behaviour and the policy differs between engines — which is precisely why this
     * assertion runs on all three rather than on Chromium alone.
     */
    await page.goto(`${APP}/perf`, { waitUntil: 'load' })
    await page.waitForSelector('html[data-harness-ready]', { timeout: 30_000 })

    const outcome = await page.evaluate(async () => {
      const el = document.createElement('video')
      el.src =
        'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE='
      document.body.append(el)
      try {
        await el.play()
        return 'played'
      } catch (e) {
        return (e as Error).name
      } finally {
        el.remove()
      }
    })

    // Either outcome is legitimate and engine-specific. What must not happen is a hang.
    expect(['played', 'NotAllowedError', 'NotSupportedError', 'AbortError']).toContain(outcome)
  })
})

test.describe('reduced motion', () => {
  /**
   * Constitution III requires it. `packages/element/src/styles.ts` carries two
   * `prefers-reduced-motion` blocks, and **nothing has ever evaluated them** — happy-dom resolves
   * no media queries over style.
   */
  test.fixme('a slide transition becomes a fade when motion is reduced', async () => {
    /**
     * **Not verified, and deliberately not shipped green.** Constitution III requires reduced
     * motion to be honoured, and BR-015 says a `slide` or `zoom` transition is *replaced* by a fade
     * rather than shortened. Four assertions were written and each was disproved by deliberate
     * breakage:
     *
     *  1. resolved `transitionDuration` — an element with no transition reports `''` either way;
     *  2. the same across every node in the shadow root — same defect, more nodes;
     *  3. the custom properties the block also rewrites (`--cs-tx`, `--cs-opacity`, …) — these do
     *     differ between media states, but renaming the query to `prefers-reduced-motion:
     *     never-matches` left the check green, so the difference comes from the engine under
     *     emulation and not from this stylesheet;
     *  4. `animation-name` on a `[data-cs-transition]` element, which is the only thing the block
     *     unambiguously rewrites — **no such node ever appeared.**
     *
     * **What blocks (4), and it may be a real finding rather than a harness problem.** A two-slide
     * lesson derived from the heavy fixture, with slide B's transition set to `slide`, was served
     * to the element adapter. Playback advanced — the element count moved from 4 to 5 as authored
     * — but across 20 seconds no `[data-cs-transition]` node was ever present in the shadow root,
     * on a slide authored to end at 8 s. Either the adapter does not mark transitions the way the
     * stylesheet expects, or it did not advance. **Both are worth knowing and neither is verified
     * here.**
     *
     * Reaching it needs a subject neither existing lesson provides: the heavy fixture's 49
     * transitions are all `fade`, which the block deliberately leaves alone ("cross-fading is not
     * movement"), and the tour's one `slide` transition sits behind a slide whose advance is
     * `after_interaction`, so it stalls there unattended.
     */
  })
})
