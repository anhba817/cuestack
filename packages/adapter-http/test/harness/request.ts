/**
 * The request function every adapter suite runs through.
 *
 * SC-011 says the whole suite runs with no network, and this is how that is met rather than hoped
 * for: the adapter takes its request function as an argument, so a test supplies this and nothing
 * anywhere opens a socket. It also makes reachable the two responses a real server would rarely
 * produce on demand and which the adapter must handle — a success whose body cannot be read, and a
 * transport that fails before any response exists.
 */

export interface SentRequest {
  readonly method: string
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: string | undefined
  readonly signalled: boolean
}

export interface StubResponse {
  readonly status: number
  /** Absent means the body cannot be read — the 200-that-is-not case (FR-024). */
  readonly json?: unknown
  readonly headers?: Readonly<Record<string, string>>
}

export type Reply = StubResponse | ((sent: SentRequest) => StubResponse | Promise<StubResponse>)

export interface StubTransport {
  readonly sent: readonly SentRequest[]
  /** Answer the next call, and every call after it, with this. */
  replyWith(reply: Reply): void
  /** Fail at the transport layer — no response exists at all. */
  failWith(cause: Error | null): void
  /** The function handed to the adapter. */
  request: HttpRequestFn
}

/** Deliberately narrower than `fetch`: only what the adapter uses, so a stub is honest. */
export interface HttpRequest {
  readonly method: string
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly body?: string
  readonly signal?: AbortSignal
}

export interface HttpResponse {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  json(): Promise<unknown>
}

export type HttpRequestFn = (request: HttpRequest) => Promise<HttpResponse>

export function stubTransport(initial?: Reply): StubTransport {
  const sent: SentRequest[] = []
  let reply: Reply = initial ?? { status: 200, json: {} }
  let failure: Error | null = null

  return {
    sent,
    replyWith(next) {
      reply = next
      failure = null
    },
    failWith(cause) {
      failure = cause
    },
    async request({ method, url, headers, body, signal }) {
      const record: SentRequest = {
        method,
        url,
        headers,
        body,
        signalled: signal?.aborted ?? false,
      }
      sent.push(record)

      if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
      if (failure) throw failure

      const answer = typeof reply === 'function' ? await reply(record) : reply
      return {
        status: answer.status,
        headers: answer.headers ?? {},
        json: async () => {
          if (!('json' in answer)) {
            throw new SyntaxError('Unexpected end of JSON input')
          }
          return answer.json
        },
      }
    },
  }
}
