import type { LessonManifest } from '@cuestack/schema'
import { createMemoryPublishing, createMemoryStorage } from '@cuestack/core'
import type { Reply, SentRequest, StubResponse } from './request.js'

/**
 * Two deliberately dissimilar APIs, and the second is the one that earns its place.
 *
 * SC-008: a single API shape cannot demonstrate the adapter is not quietly built around it. So these
 * differ in the three ways a real host's API differs — where things live, how the version token
 * travels, and how a conflict is signalled — and the adapter must pass its full suite against both
 * with only the mapping changing.
 *
 * The server behind them wraps the **real** in-memory references rather than answering whatever a
 * test needs. Same argument as feature 009's recording double: a hand-written stub is more forgiving
 * than any real adapter, so a test can pass because the double was lenient. Here the token
 * sequencing, the conflict detection, and the version history are `createMemoryStorage`'s.
 */

export interface ApiShape {
  readonly name: string
  /** Where each operation lives. */
  path(op: Operation, params: Params): string
  method(op: Operation): string
  /** How the version token reaches the server, and how it comes back. */
  readonly token: 'body' | 'header'
  readonly tokenHeader?: string
  /** How this API says "somebody moved it since you looked". */
  readonly conflict: { status: number; flag?: string }
}

export type Operation =
  | 'loadDraft'
  | 'saveDraft'
  | 'listVersions'
  | 'loadVersion'
  | 'resolveAsset'
  | 'recordEvent'
  | 'publish'
  | 'listPublished'
  | 'loadPublished'
  | 'withdraw'
  | 'restore'
  | 'readRecord'

export interface Params {
  readonly lessonId?: string
  readonly assetId?: string
  readonly token?: string
  readonly versionId?: string
}

/** REST-ish and flat, the shape somebody would build if they had read the contract and nothing else. */
export const flatShape: ApiShape = {
  name: 'flat',
  path(op, p) {
    switch (op) {
      case 'loadDraft':
      case 'saveDraft':
        return `/lessons/${p.lessonId}/draft`
      case 'listVersions':
        return `/lessons/${p.lessonId}/versions`
      case 'loadVersion':
        return `/lessons/${p.lessonId}/versions/${p.token}`
      case 'resolveAsset':
        return `/assets/${p.assetId}`
      case 'recordEvent':
        return '/events'
      case 'publish':
      case 'listPublished':
        return `/lessons/${p.lessonId}/published`
      case 'loadPublished':
        return p.versionId
          ? `/lessons/${p.lessonId}/published/${p.versionId}`
          : `/lessons/${p.lessonId}/published/active`
      case 'withdraw':
        return `/lessons/${p.lessonId}/published/withdraw`
      case 'restore':
        return `/lessons/${p.lessonId}/published/restore`
      case 'readRecord':
        return `/lessons/${p.lessonId}/record`
    }
  },
  method: (op) =>
    op === 'loadDraft' ||
    op === 'listVersions' ||
    op === 'loadVersion' ||
    op === 'resolveAsset' ||
    op === 'listPublished' ||
    op === 'loadPublished' ||
    op === 'readRecord'
      ? 'GET'
      : op === 'saveDraft'
        ? 'PUT'
        : 'POST',
  token: 'body',
  conflict: { status: 409 },
}

/**
 * Nested under a course, token in a header nobody else uses, conflict as a 412 with a flag.
 *
 * Deliberately awkward. Every difference here is one a real host has: a resource hierarchy that
 * predates Cuestack, an ETag-shaped concurrency scheme, and a status code chosen years ago.
 */
export const nestedShape: ApiShape = {
  name: 'nested',
  path(op, p) {
    const base = `/api/v2/courses/demo/lessons/${p.lessonId}`
    switch (op) {
      case 'loadDraft':
      case 'saveDraft':
        return base
      case 'listVersions':
        return `${base}/history`
      case 'loadVersion':
        return `${base}/history/${p.token}`
      case 'resolveAsset':
        return `/api/v2/media/${p.assetId}/location`
      case 'recordEvent':
        return '/api/v2/telemetry'
      case 'publish':
        return `${base}/releases`
      case 'listPublished':
        return `${base}/releases`
      case 'loadPublished':
        return p.versionId ? `${base}/releases/${p.versionId}` : `${base}/releases/current`
      case 'withdraw':
        return `${base}/releases/current/retire`
      case 'restore':
        return `${base}/releases/current/reinstate`
      case 'readRecord':
        return `${base}/audit`
    }
  },
  method: (op) =>
    op === 'loadDraft' ||
    op === 'listVersions' ||
    op === 'loadVersion' ||
    op === 'resolveAsset' ||
    op === 'listPublished' ||
    op === 'loadPublished' ||
    op === 'readRecord'
      ? 'GET'
      : op === 'saveDraft'
        ? 'PATCH'
        : 'POST',
  token: 'header',
  tokenHeader: 'x-lesson-revision',
  conflict: { status: 412, flag: 'staleRevision' },
}

export const SHAPES: readonly ApiShape[] = [flatShape, nestedShape]

/**
 * A server that answers according to a shape, backed by the **real** in-memory references.
 *
 * Returned as a `Reply` for `stubTransport`, so a suite parameterised over a shape is one line:
 * `transport.replyWith(serverFor(shape).reply)`.
 *
 * It routes by matching the paths the shape itself declares, which is what makes it a genuine test
 * of the mapping: if the adapter sends somewhere the shape did not describe, nothing matches and the
 * request 404s rather than being quietly accepted.
 */
export interface StubServer {
  readonly shape: ApiShape
  readonly reply: Reply
  /** Events the server received, so analytics can be asserted without reaching inside. */
  readonly events: readonly unknown[]
}

export function serverFor(shape: ApiShape, seed?: LessonManifest): StubServer {
  const storage = createMemoryStorage({ now: () => 1_700_000_000_000 })
  let clock = 1_700_000_000_000
  const publishing = createMemoryPublishing({ now: () => (clock += 60_000) })
  if (seed) storage.seed('lesson', seed)

  const events: unknown[] = []
  const ok = (json: unknown): StubResponse => ({ status: 200, json })

  /** The token the shape says a request carries, wherever it says it carries it. */
  const tokenOf = (sent: SentRequest, body: Record<string, unknown>): string | null => {
    if (shape.token === 'header') return sent.headers[shape.tokenHeader!] ?? null
    return typeof body['token'] === 'string' ? body['token'] : null
  }

  /** The same, coming back. A shape that sends a token in a header returns it in one. */
  const withToken = (json: Record<string, unknown>, token: string): StubResponse =>
    shape.token === 'header'
      ? { status: 200, json, headers: { [shape.tokenHeader!]: token } }
      : { status: 200, json: { ...json, token } }

  const which = (sent: SentRequest): { op: Operation; params: Params } | null => {
    const params: Params[] = [
      { lessonId: 'lesson' },
      { lessonId: 'lesson', assetId: 'asset_photo' },
      { assetId: 'asset_photo' },
    ]
    const ops: Operation[] = [
      'loadDraft', 'saveDraft', 'listVersions', 'resolveAsset', 'recordEvent',
      'publish', 'listPublished', 'loadPublished', 'withdraw', 'restore', 'readRecord',
    ]
    for (const op of ops) {
      for (const p of params) {
        if (shape.path(op, p) === sent.url && shape.method(op) === sent.method) return { op, params: p }
      }
    }
    // Version and published-by-id paths carry a value the table above cannot enumerate.
    const version = /\/(versions|history)\/([^/]+)$/.exec(sent.url)
    if (version) return { op: 'loadVersion', params: { lessonId: 'lesson', token: version[2]! } }
    const published = /\/(published|releases)\/([^/]+)$/.exec(sent.url)
    if (published && published[2] !== 'active' && published[2] !== 'current') {
      return { op: 'loadPublished', params: { lessonId: 'lesson', versionId: published[2]! } }
    }
    return null
  }

  const reply: Reply = async (sent) => {
    const body = (sent.body ? JSON.parse(sent.body) : {}) as Record<string, unknown>
    const matched = which(sent)
    if (!matched) return { status: 404, json: { error: 'no such route' } }
    const { op, params } = matched

    switch (op) {
      case 'loadDraft': {
        const r = await storage.loadDraft('lesson')
        return r.ok ? withToken({ manifest: r.manifest }, r.token) : { status: 404, json: {} }
      }
      case 'saveDraft': {
        const token = tokenOf(sent, body)
        const r = await storage.saveDraft(
          'lesson',
          body['manifest'] as LessonManifest,
          token as string,
          body['checkpoint'] ? { checkpoint: body['checkpoint'] as { label?: string } } : undefined,
        )
        if (r.ok) return withToken({}, r.token)
        if (r.reason === 'conflict') {
          // Each shape signals a conflict its own way, which is the point of having two.
          return shape.conflict.flag
            ? { status: shape.conflict.status, json: { [shape.conflict.flag]: true, current: r.currentToken } }
            : { status: shape.conflict.status, json: { current: r.currentToken } }
        }
        return { status: r.reason === 'unauthorized' ? 403 : 503, json: {} }
      }
      case 'listVersions':
        return ok({ versions: await storage.listVersions('lesson') })
      case 'loadVersion': {
        const r = await storage.loadVersion('lesson', params.token!)
        return r.ok ? withToken({ manifest: r.manifest }, r.token) : { status: 404, json: {} }
      }
      case 'resolveAsset':
        return ok({ url: `https://cdn.test/${params.assetId ?? 'unknown'}` })
      case 'recordEvent':
        events.push(body)
        return { status: 202, json: {} }
      case 'publish': {
        const r = await publishing.publish('lesson', body['manifest'] as LessonManifest, String(body['by']))
        return r.ok ? ok({ version: r.version }) : { status: 403, json: {} }
      }
      case 'listPublished':
        return ok({ versions: await publishing.listPublished('lesson') })
      case 'loadPublished': {
        const r = await publishing.loadPublished('lesson', params.versionId)
        if (r.ok) return ok({ version: r.version })
        // Withdrawn is not not-found, and a shape that could not say so would hide the
        // distinction FR-029a exists for.
        return r.reason === 'withdrawn'
          ? { status: 410, json: { withdrawn: true } }
          : { status: 404, json: {} }
      }
      case 'withdraw': {
        const r = await publishing.withdraw('lesson', String(body['by']))
        return r.ok ? ok({}) : { status: 404, json: {} }
      }
      case 'restore': {
        const r = await publishing.restore('lesson', String(body['by']))
        return r.ok ? ok({}) : { status: 404, json: {} }
      }
      case 'readRecord':
        return ok({ entries: await publishing.readRecord('lesson') })
    }
  }

  return { shape, reply, events }
}
