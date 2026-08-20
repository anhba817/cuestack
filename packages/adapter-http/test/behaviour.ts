import { expect } from 'vitest'
import { createHttpAdapters } from '../src/index.js'
import { stubTransport } from './harness/request.js'
import { classifierFor, mappingFor } from './harness/mapping.js'
import { serverFor, type ApiShape } from './harness/shapes.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * The behavioural suite, authored parameterised over an API shape from the outset.
 *
 * T053 runs it against a second, deliberately dissimilar shape, and a suite written against one
 * shape is a suite that gets rewritten rather than reused. Everything here is shared; only the
 * mapping differs between the two runs, which is what SC-008 measures.
 */
export function adaptersFor(shape: ApiShape, seed?: LessonManifest) {
  const server = serverFor(shape, seed)
  const transport = stubTransport(server.reply)
  const adapters = createHttpAdapters({
    mapping: mappingFor(shape),
    request: transport.request,
    credentials: async () => ({ authorization: 'Bearer test' }),
    classify: classifierFor(shape),
  })
  return { ...adapters, transport, server }
}

/** The save handshake, which is the easiest thing in the contract to get subtly wrong. */
export async function assertSaveHandshake(shape: ApiShape, lesson: LessonManifest): Promise<void> {
  const { storage } = adaptersFor(shape, lesson)

  const opened = await storage.loadDraft('lesson')
  expect(opened.ok).toBe(true)
  if (!opened.ok) return

  const first = await storage.saveDraft('lesson', lesson, opened.token)
  expect(first.ok).toBe(true)
  if (!first.ok) return
  // Every save advances the token, checkpoint or not — a conflict cannot be detected otherwise.
  expect(first.token).not.toBe(opened.token)

  const checkpoint = await storage.saveDraft('lesson', lesson, first.token, {
    checkpoint: { label: 'A place to come back to' },
  })
  expect(checkpoint.ok).toBe(true)
  if (!checkpoint.ok) return
  expect(checkpoint.token).not.toBe(first.token)

  // A non-checkpoint save still persists: absent from the history, not absent from storage.
  const versions = await storage.listVersions('lesson')
  expect(versions).toHaveLength(1)

  const reopened = await storage.loadDraft('lesson')
  expect(reopened.ok).toBe(true)
}

/** Two editors, one lesson. The distinction that stands between somebody losing an afternoon. */
export async function assertConflict(shape: ApiShape, lesson: LessonManifest): Promise<void> {
  const { storage } = adaptersFor(shape, lesson)
  const opened = await storage.loadDraft('lesson')
  if (!opened.ok) throw new Error('unreachable')

  await storage.saveDraft('lesson', lesson, opened.token)
  // The second editor still holds the token from before the first one saved.
  const stale = await storage.saveDraft('lesson', lesson, opened.token)

  expect(stale.ok).toBe(false)
  if (stale.ok) return
  expect(stale.reason).toBe('conflict')
  if (stale.reason !== 'conflict') return
  expect(stale.currentToken).not.toBe(opened.token)
}

/** `loadVersion` returns the **current draft's** token, not the loaded version's. */
export async function assertRestoreToken(shape: ApiShape, lesson: LessonManifest): Promise<void> {
  const { storage } = adaptersFor(shape, lesson)
  const opened = await storage.loadDraft('lesson')
  if (!opened.ok) throw new Error('unreachable')

  const marked = await storage.saveDraft('lesson', lesson, opened.token, { checkpoint: {} })
  if (!marked.ok) throw new Error('unreachable')
  const after = await storage.saveDraft('lesson', lesson, marked.token)
  if (!after.ok) throw new Error('unreachable')

  const versions = await storage.listVersions('lesson')
  const restored = await storage.loadVersion('lesson', versions[0]!.token)
  expect(restored.ok).toBe(true)
  if (!restored.ok) return

  /**
   * Returning the *old* token would make the very next save look like a conflict, which is how
   * restoring stops being additive. `StorageAdapter`'s own header calls this the easiest thing to
   * get subtly wrong, and it is the one assertion here that would pass a plausible wrong adapter.
   */
  expect(restored.token).toBe(after.token)
}

export async function assertPublishing(shape: ApiShape, lesson: LessonManifest): Promise<void> {
  const { publishing } = adaptersFor(shape, lesson)

  const first = await publishing.publish('lesson', lesson, 'ms-okafor')
  expect(first.ok).toBe(true)
  await publishing.publish('lesson', lesson, 'ms-okafor')

  const versions = await publishing.listPublished('lesson')
  expect(versions).toHaveLength(2)
  // Newest first, which the contract states and a host could easily reverse.
  expect(versions[0]!.versionNumber).toBe(2)

  const active = await publishing.loadPublished('lesson')
  expect(active.ok).toBe(true)

  expect((await publishing.withdraw('lesson', 'mr-adeyemi')).ok).toBe(true)
  const gone = await publishing.loadPublished('lesson')
  expect(gone.ok).toBe(false)

  expect((await publishing.restore('lesson', 'ms-okafor')).ok).toBe(true)
  expect((await publishing.loadPublished('lesson')).ok).toBe(true)

  const record = await publishing.readRecord('lesson')
  expect(record.map((e) => e.action)).toEqual(['published', 'published', 'withdrawn', 'restored'])
}

export async function assertAssets(shape: ApiShape, lesson: LessonManifest): Promise<void> {
  const { assets } = adaptersFor(shape, lesson)
  const found = await assets.resolve('asset_photo')
  expect(found?.url).toContain('asset_photo')
}
