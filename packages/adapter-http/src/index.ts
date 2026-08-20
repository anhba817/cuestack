import type {
  AnalyticsAdapter,
  AssetAdapter,
  PublishingAdapter,
  StorageAdapter,
} from '@cuestack/core'
import { assertComplete, type OperationMapping } from './mapping.js'
import { analyticsOver, assetsOver, publishingOver, storageOver } from './adapters.js'
import type { Classifier } from './classify.js'
import type { HttpRequestFn } from './request.js'

export type { OperationMapping, Operation, LoadDraftOut, SaveDraftIn } from './mapping.js'
export { OPERATIONS } from './mapping.js'
export { classify, type Classifier, type Outcome, type ResponseView } from './classify.js'
export type { RequestSpec, HttpRequest, HttpResponse, HttpRequestFn } from './request.js'

/**
 * The four persistence contracts, over a host's own API.
 *
 * The framework's first code that talks to a network, and a separate package for that reason: a host
 * wanting none of it installs none of it, and nothing in the existing packages depends on it
 * (FR-027, enforced by `no-http-adapter-dependents` rather than by this sentence).
 *
 * **This adapter is a reference, not the recommended path.** A host with an existing API is expected
 * to implement the interfaces directly. It exists to make the first hour easy, and to prove the
 * interfaces are implementable by somebody who did not design them.
 */
export interface HttpAdapterOptions {
  /** How each operation reaches your API. See `contracts/http-operations.md`. */
  readonly mapping: Partial<OperationMapping>
  /** Defaults to the platform's `fetch`. Injected so the whole suite runs with no network. */
  readonly request?: HttpRequestFn
  /** Asked on every request. Never stored, cached, refreshed, or logged. */
  readonly credentials?: () => Promise<Readonly<Record<string, string>>>
  /** Replace when your API signals a conflict, a refusal, or an absence its own way. */
  readonly classify?: Classifier
  readonly signal?: AbortSignal
}

export interface HttpAdapters {
  readonly storage: StorageAdapter
  readonly assets: AssetAdapter
  readonly analytics: AnalyticsAdapter
  readonly publishing: PublishingAdapter
}

const platformRequest: HttpRequestFn = async ({ method, url, headers, body, signal }) => {
  const response = await fetch(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
    ...(signal ? { signal } : {}),
  })
  const received: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    received[key.toLowerCase()] = value
  })
  return { status: response.status, headers: received, json: () => response.json() as Promise<unknown> }
}

export function createHttpAdapters(options: HttpAdapterOptions): HttpAdapters {
  // Whole, at construction: an operation nobody described is named now rather than at the moment a
  // teacher uses it (FR-019a).
  const mapping = options.mapping
  assertComplete(mapping)

  const perform = {
    request: options.request ?? platformRequest,
    credentials: options.credentials ?? (async () => ({})),
    ...(options.classify ? { classify: options.classify } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  }

  return {
    storage: storageOver(mapping, perform),
    assets: assetsOver(mapping, perform),
    analytics: analyticsOver(mapping, perform),
    publishing: publishingOver(mapping, perform),
  }
}
