import { classify as defaultClassifier, type Classifier, type Outcome } from './classify.js'

/**
 * Performing one request, once.
 *
 * Everything the adapter itself owns lives here: making the call, threading credentials, honouring
 * cancellation, refusing to retry, and refusing to call an unreadable success a success. The host
 * owns where the request goes and what its answer means.
 */

/** What a host's mapping produces. Deliberately smaller than `fetch`'s options. */
export interface RequestSpec {
  readonly method: string
  readonly url: string
  readonly headers?: Readonly<Record<string, string>>
  /** Serialized as JSON. Absent for requests that carry nothing. */
  readonly body?: unknown
}

export interface HttpRequest {
  readonly method: string
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly body?: string
  readonly signal?: AbortSignal
}

export interface HttpResponse {
  readonly status: number
  /**
   * Response headers, lower-cased.
   *
   * Present because a host's mapping must be able to read a version token out of one. ETag-shaped
   * concurrency is the ordinary case rather than an exotic one, and a reader given only the body
   * could not serve it — found by writing the second API shape SC-008 requires, which is what the
   * second shape is for.
   */
  readonly headers: Readonly<Record<string, string>>
  json(): Promise<unknown>
}

/**
 * Injected, defaulting to the platform's `fetch`.
 *
 * This is what makes SC-011 achievable: the entire suite runs with no network, against a stub that
 * can produce the two answers a real server will not produce on demand — a malformed success body,
 * and a transport that fails before any response exists.
 */
export type HttpRequestFn = (request: HttpRequest) => Promise<HttpResponse>

export interface PerformOptions {
  readonly request: HttpRequestFn
  /**
   * Asked on **every** call, and the answer is never stored, cached, refreshed, or logged (FR-020).
   * A framework that held a credential would be holding something it cannot be trusted with and
   * cannot refresh.
   */
  readonly credentials: () => Promise<Readonly<Record<string, string>>>
  readonly classify?: Classifier
  readonly signal?: AbortSignal
}

export interface ResponseBody {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: unknown
}

export type PerformResult =
  | ({ readonly ok: true } & ResponseBody)
  | {
      readonly ok: false
      readonly outcome: Outcome
      /**
       * The response, when there was one.
       *
       * Absent for a transport failure or a cancellation, where nothing came back. Carried because a
       * refusal is not always the end of the question: `loadPublished` has to ask the host's mapping
       * whether an absence was a withdrawal, and it cannot ask about a response it was not given.
       */
      readonly response?: ResponseBody
    }

const JSON_HEADERS = { 'content-type': 'application/json', accept: 'application/json' }

export async function perform(spec: RequestSpec, options: PerformOptions): Promise<PerformResult> {
  const decide = options.classify ?? defaultClassifier

  let response: HttpResponse
  try {
    const auth = await options.credentials()
    response = await options.request({
      method: spec.method,
      url: spec.url,
      headers: { ...JSON_HEADERS, ...auth, ...spec.headers },
      ...(spec.body === undefined ? {} : { body: JSON.stringify(spec.body) }),
      ...(options.signal ? { signal: options.signal } : {}),
    })
  } catch {
    /**
     * A transport failure and a cancellation arrive the same way and mean the same thing to the
     * caller: nothing happened, and it may work later. **No retry** — the save loop owns that, and
     * two retry policies over one request is how a save gets sent four times (FR-025).
     */
    return { ok: false, outcome: 'unavailable' }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    /**
     * A success whose body cannot be read is a failure (FR-024). A save reported as Saved that was
     * not is the single outcome FR-DAT-003 exists to prevent, and this is exactly its shape.
     */
    return { ok: false, outcome: 'unavailable' }
  }

  const view: ResponseBody = { status: response.status, headers: response.headers, body }
  const outcome = decide({ status: response.status, body })
  if (outcome !== null) return { ok: false, outcome, response: view }
  return { ok: true, body, status: response.status, headers: response.headers }
}
