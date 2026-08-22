import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * A static server for the element harness.
 *
 * The React harness needs none of this — the example app is a server already, and it imports its
 * lesson rather than fetching one. This exists for the adapter that is consumed without a bundler.
 *
 * **Nothing here may hard-code a `node_modules` path.** Under pnpm, `zod` resolves to
 * `node_modules/.pnpm/zod@4.4.3/node_modules/zod/index.js` — a literal carrying a version number
 * that changes on every upgrade. It is resolved from `@cuestack/schema`'s context instead, which is
 * the package that actually depends on it.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

function zodEntry() {
  const require = createRequire(join(ROOT, 'packages/schema/package.json'))
  // The `import` condition, so the browser gets ESM rather than the CJS `main`.
  const cjs = require.resolve('zod')
  const esm = cjs.replace(/index\.cjs$/, 'index.js')
  if (!existsSync(esm)) {
    throw new Error(
      `serve: resolved zod to ${cjs} but found no ESM entry beside it. The import map cannot be ` +
        'satisfied, so the element harness would fail with an unresolved specifier.',
    )
  }
  return esm
}

/** Map a request path to a file, or null. Every mapping is explicit; nothing is guessed. */
function fileFor(url, lessonPath) {
  const path = normalize(decodeURIComponent(url.split('?')[0]))
  if (path === '/' || path === '/index.html') return join(ROOT, 'tools/browser/harness/element.html')
  if (path === '/lesson.json') return lessonPath
  if (path.startsWith('/pkg/')) return join(ROOT, 'packages', path.slice('/pkg/'.length))
  if (path.startsWith('/vendor/zod/')) {
    return join(dirname(zodEntry()), path.slice('/vendor/zod/'.length))
  }
  return null
}

export async function serveHarness({ lessonPath, port = 0 }) {
  if (!existsSync(lessonPath)) {
    throw new Error(`serve: no lesson at ${lessonPath}. There is nothing to play.`)
  }
  const server = createServer((req, res) => {
    const file = fileFor(req.url ?? '/', lessonPath)
    if (file === null || !existsSync(file) || !statSync(file).isFile()) {
      // Loud, and specific about what was asked for: a 404 inside an import map surfaces as an
      // unresolved specifier several frames away from its cause.
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end(`serve: nothing at ${req.url}`)
      return
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })
  await new Promise((ok) => server.listen(port, '127.0.0.1', ok))
  const { port: bound } = server.address()
  return {
    origin: `http://127.0.0.1:${bound}`,
    async close() {
      await new Promise((ok) => server.close(ok))
    },
  }
}
