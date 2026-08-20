import type { OperationMapping } from '../../src/mapping.js'
import type { ApiShape } from './shapes.js'

/**
 * A mapping built from a shape descriptor.
 *
 * This is the thing a host writes, and writing it twice — once per shape — is what SC-008 measures:
 * the adapter must pass its full suite against both with **only this** differing.
 *
 * Note how much of it is the host's: every path, every method, where the version token travels, and
 * how each answer is read. The adapter contributes none of that, which is FR-019.
 */
/**
 * A reader that refuses rather than returning `undefined`.
 *
 * The host's job, and the contract says so: an adapter cannot tell a domain object from nonsense,
 * so a reader that shrugged at an answer it did not understand would turn a failed request into a
 * successful one carrying nothing — a save reported as Saved that was not (FR-024).
 */
function require_<T>(body: unknown, key: string): T {
  const value = (body as Record<string, unknown> | null)?.[key]
  if (value === undefined) throw new Error(`The response carried no "${key}".`)
  return value as T
}

export function mappingFor(shape: ApiShape): OperationMapping {
  const at = (op: Parameters<ApiShape['path']>[0], params: Parameters<ApiShape['path']>[1] = {}) => ({
    method: shape.method(op),
    url: shape.path(op, params),
  })

  /** The token, wherever this API carries it, going out. */
  const sendToken = (
    token: string,
  ): { headers?: Record<string, string>; tokenInBody?: string } =>
    shape.token === 'header' ? { headers: { [shape.tokenHeader!]: token } } : { tokenInBody: token }

  /**
   * And coming back — from a header for one shape, from the body for the other.
   *
   * This is what forced `read` to take the whole response rather than the body alone: an API with
   * ETag-shaped concurrency puts its version in a header, and a reader given only the body could
   * not serve it. The second API shape is what surfaced that.
   */
  const readToken = (r: { body: unknown; headers: Readonly<Record<string, string>> }): string =>
    shape.token === 'header'
      ? (r.headers[shape.tokenHeader!] ?? '')
      : (r.body as { token: string }).token

  const withBody = (
    op: Parameters<ApiShape['path']>[0],
    params: Parameters<ApiShape['path']>[1],
    body: Record<string, unknown>,
    token?: string,
  ) => {
    const sent = token === undefined ? {} : sendToken(token)
    return {
      ...at(op, params),
      ...(sent.headers ? { headers: sent.headers } : {}),
      body: { ...body, ...(sent.tokenInBody === undefined ? {} : { token: sent.tokenInBody }) },
    }
  }

  return {
    loadDraft: {
      request: ({ lessonId }) => at('loadDraft', { lessonId }),
      read: (r) => ({ manifest: require_(r.body, 'manifest'), token: readToken(r) }),
    },
    saveDraft: {
      request: ({ lessonId, manifest, token, options }) =>
        withBody('saveDraft', { lessonId }, { manifest, ...(options ?? {}) }, token),
      read: (r) => ({ token: readToken(r) }),
    },
    listVersions: {
      request: ({ lessonId }) => at('listVersions', { lessonId }),
      read: (r) => require_(r.body, 'versions'),
    },
    loadVersion: {
      request: ({ lessonId, token }) => at('loadVersion', { lessonId, token }),
      read: (r) => ({ manifest: require_(r.body, 'manifest'), token: readToken(r) }),
    },
    resolveAsset: {
      request: ({ assetId }) => at('resolveAsset', { assetId }),
      read: (r) => ((r.body as { url?: string }).url ? { url: (r.body as { url: string }).url } : null),
    },
    recordEvent: {
      request: ({ event }) => ({ ...at('recordEvent'), body: { event } }),
      read: () => undefined,
    },
    publish: {
      request: ({ lessonId, manifest, by }) => ({ ...at('publish', { lessonId }), body: { manifest, by } }),
      read: (r) => require_(r.body, 'version'),
    },
    listPublished: {
      request: ({ lessonId }) => at('listPublished', { lessonId }),
      read: (r) => require_(r.body, 'versions'),
    },
    loadPublished: {
      request: ({ lessonId, versionId }) => at('loadPublished', { lessonId, versionId }),
      read: (r) => require_(r.body, 'version'),
      // This API says a withdrawal with 410 and a flag. Another would say it differently, which is
      // exactly why the framework asks rather than infers.
      isWithdrawn: ({ status, body }) =>
        status === 410 || (body as { withdrawn?: boolean })?.withdrawn === true,
    },
    withdraw: {
      request: ({ lessonId, by }) => ({ ...at('withdraw', { lessonId }), body: { by } }),
      read: () => undefined,
    },
    restore: {
      request: ({ lessonId, by }) => ({ ...at('restore', { lessonId }), body: { by } }),
      read: () => undefined,
    },
    readRecord: {
      request: ({ lessonId }) => at('readRecord', { lessonId }),
      read: (r) => require_(r.body, 'entries'),
    },
  }
}

/**
 * The classifier for a shape that signals a conflict its own way.
 *
 * The default reads the HTTP status vocabulary; the nested shape uses 412 with a flag, which the
 * default already maps to `conflict` — so this exists to prove replacing it works, and to cover a
 * shape that signalled a conflict on a status the default would have called something else.
 */
export function classifierFor(shape: ApiShape) {
  return ({ status, body }: { status: number; body: unknown }) => {
    if (status >= 200 && status < 300) return null
    if (status === shape.conflict.status) {
      if (!shape.conflict.flag) return 'conflict' as const
      return (body as Record<string, unknown>)?.[shape.conflict.flag] ? ('conflict' as const) : ('unavailable' as const)
    }
    if (status === 401 || status === 403) return 'permission' as const
    if (status === 404 || status === 410) return 'not-found' as const
    return 'unavailable' as const
  }
}
