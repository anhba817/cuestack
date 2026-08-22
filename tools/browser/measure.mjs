import { chromium } from 'playwright'
import { summarise } from './statistics.mjs'

/**
 * Frame timings from a real compositor.
 *
 * **`requestAnimationFrame` deltas rather than a Chromium trace.** A trace is richer and
 * Chromium-only; the deltas are what the compositor actually delivered to the page, and they are
 * the same code on every engine even though only one engine is measured (research R-02).
 *
 * **One engine, always the same one.** A frame figure is only comparable to itself, and FR-007's
 * variance work depends on that. Cross-engine breadth belongs to the behaviour suite, not here.
 */

/** CPU throttling is a CDP capability, so the throttled reference is necessarily Chromium (R-03). */
async function throttle(page, rate) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
  return cdp
}

export async function measure({ url, seconds = 5, cpuThrottle = 1, engine = chromium }) {
  const browser = await engine.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    const failures = []
    page.on('pageerror', (e) => failures.push(String(e).split('\n')[0]))

    if (cpuThrottle > 1) await throttle(page, cpuThrottle)

    /**
     * **Collection starts before the page does.**
     *
     * The first draft installed the frame loop after waiting for the harness to signal readiness,
     * and by then the work was over: the heavy fixture's opening fades run in the first ~600ms of
     * mount, so a loop starting a round-trip later saw six hundred frames of a finished slide and
     * reported a flawless 60fps. An idle page always does.
     *
     * `addInitScript` runs before any page script, so the observer is watching when the player
     * mounts — which is when a lesson that stalls on a required question does all the work it is
     * ever going to do unattended.
     */
    await page.addInitScript(() => {
      const deltas = []
      let mutations = 0
      const observer = new MutationObserver((records) => {
        mutations += records.length
      })
      const start = () => {
        observer.observe(document.documentElement, {
          subtree: true,
          attributes: true,
          childList: true,
          characterData: true,
        })
        let last = performance.now()
        const tick = (now) => {
          deltas.push(now - last)
          last = now
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
      if (document.documentElement) start()
      else document.addEventListener('readystatechange', start, { once: true })
      Object.defineProperty(window, '__cuestackFrames', {
        get: () => ({ frames: deltas.slice(), mutations }),
      })
    })

    await page.goto(url, { waitUntil: 'load' })

    // A marker, not a sleep. A harness that never becomes ready measured nothing, and waiting a
    // guessed duration would report the guess (FR-005).
    await page.waitForSelector('html[data-harness-ready]', { timeout: 30_000 }).catch(() => {
      throw new Error(
        `measure: ${url} never signalled readiness within 30s. The harness did not start, so ` +
          `nothing was measured.${failures.length ? ` Page errors: ${failures.join(' | ')}` : ''}`,
      )
    })

    await page.waitForTimeout(seconds * 1000)
    const { frames, mutations } = await page.evaluate(() => window.__cuestackFrames)

    if (failures.length > 0) {
      throw new Error(`measure: the page errored while being measured — ${failures.join(' | ')}`)
    }
    if (mutations === 0) {
      throw new Error(
        `measure: ${url} produced ${frames.length} frames and changed nothing in ${seconds}s. ` +
          'An idle page reports a perfect frame rate, because rAF ticks at the refresh rate ' +
          'whether or not there is work to do. This measured nothing, so it reports nothing.',
      )
    }
    return { ...summarise(frames), mutations }
  } finally {
    await browser.close()
  }
}
