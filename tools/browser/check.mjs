import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveHarness } from './serve.mjs'
import { measure } from './measure.mjs'
import { REFERENCES, formatMeasurement, formatVariance, limits } from './report.mjs'

/**
 * `pnpm check:browser` — the fourth runner.
 *
 * Not `pnpm test`, not `pnpm gates`. The ordinary suite must not measure timing (FR-006), and the
 * gate runs in 10.2s which is why people run it before pushing; three browser engines inside it
 * would end that.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const APP = join(ROOT, 'examples/nextjs')

function fail(message) {
  console.error(`check:browser — ${message}`)
  process.exit(1)
}

/** The example app, built. A harness that cannot start is a failure, never a skip. */
async function startApp() {
  if (!existsSync(join(APP, '.next'))) {
    fail(
      'examples/nextjs has not been built. Run `pnpm build` first — the harness serves the built ' +
        'app because that is the consumption path a host actually uses.',
    )
  }
  const port = 3100 + Math.floor(process.pid % 300)
  const child = spawn('pnpm', ['exec', 'next', 'start', '--port', String(port)], {
    cwd: APP,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const origin = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 60_000
  for (;;) {
    if (Date.now() > deadline) {
      child.kill()
      fail(`the example app did not answer on ${origin} within 60s.`)
    }
    try {
      const r = await fetch(`${origin}/perf`)
      if (r.ok) break
    } catch {
      /* not up yet */
    }
    await new Promise((ok) => setTimeout(ok, 250))
  }
  return { origin, stop: () => child.kill() }
}

const SUBJECT_PATH = { ci: '/perf', baseline: '/perf/tour' }

async function measureBoth(origin, seconds) {
  const out = {}
  for (const key of ['ci', 'baseline']) {
    out[key] = await measure({
      url: origin + SUBJECT_PATH[key],
      seconds,
      cpuThrottle: REFERENCES[key].throttle,
    })
  }
  return out
}

/** The three-engine behaviour suite. Both harnesses up, origins passed in. */
async function runBehaviour(appOrigin) {
  const element = await serveHarness({
    lessonPath: join(ROOT, 'examples/nextjs/app/heavy-lesson.json'),
  })
  try {
    const child = spawn('pnpm', ['exec', 'playwright', 'test'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        CUESTACK_APP_ORIGIN: appOrigin,
        CUESTACK_ELEMENT_ORIGIN: element.origin,
      },
    })
    const code = await new Promise((ok) => child.on('close', ok))
    if (code !== 0) {
      fail(
        'the behaviour suite failed. If an engine could not launch, that is a failure and not a ' +
          'skip — install its system dependencies (`sudo pnpm exec playwright install-deps`) ' +
          'rather than running two engines and calling it three.',
      )
    }
  } finally {
    await element.close()
  }
}

const args = process.argv.slice(2)
const repeatAt = args.indexOf('--repeat')
const repeat = repeatAt === -1 ? 1 : Number(args[repeatAt + 1] ?? 10)
const seconds = Number(process.env.CUESTACK_BROWSER_SECONDS ?? 5)

const app = await startApp()
try {
  if (args.includes('--behaviour')) {
    await runBehaviour(app.origin)
  } else if (repeat > 1) {
    const runs = { ci: [], baseline: [] }
    for (let i = 0; i < repeat; i += 1) {
      const both = await measureBoth(app.origin, seconds)
      runs.ci.push(both.ci)
      runs.baseline.push(both.baseline)
      console.log(`  run ${i + 1}/${repeat} done`)
    }
    console.log('')
    for (const key of ['ci', 'baseline']) console.log(formatVariance(key, runs[key]), '\n')
  } else {
    const both = await measureBoth(app.origin, seconds)
    for (const key of ['ci', 'baseline']) console.log(formatMeasurement(key, 'chromium', both[key]), '\n')
  }
  console.log(limits())
} finally {
  app.stop()
}
