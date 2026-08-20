# `@cuestack/adapter-http`

The four persistence contracts — storage, assets, analytics, publishing — over **your** API.

This package is a reference, not the recommended path. A host with an existing API is expected to
implement the interfaces directly; this exists to make the first hour easy, and to prove those
interfaces are implementable by somebody who did not design them.

It is also the only code in this framework that talks to a network, which is why it is a separate
package: install it or don't. Nothing else depends on it, and a lint rule keeps that true.

## What it does and does not decide

**It does not know your API and will not pretend to.** There are no routes here. You describe, per
operation, how to build the request and how to read the answer. The framework contributes what is the
same for every host:

- performing the call — **once**, never retried
- threading credentials, per request, holding none
- honouring cancellation
- turning a response into one of exactly four meanings: `permission`, `not-found`, `conflict`,
  `unavailable`

That last one is the load-bearing part. A caller that cannot tell those apart cannot say anything
useful to a teacher.

## A mapping

Everything below is **an example, not a specification.** Your API's shape is yours; nothing in this
package prefers this one. (Two deliberately dissimilar shapes are exercised in the test suite for
exactly this reason — if the adapter only worked against something resembling this, that suite would
fail.)

```ts
import { createHttpAdapters } from '@cuestack/adapter-http'

const { storage, assets, analytics, publishing } = createHttpAdapters({
  credentials: async () => ({ authorization: `Bearer ${await currentToken()}` }),
  mapping: {
    loadDraft: {
      request: ({ lessonId }) => ({ method: 'GET', url: `/lessons/${lessonId}/draft` }),
      read: (r) => ({
        manifest: expect(r.body, 'manifest'),
        // Your token may live in the body, or in a header. `read` gets the whole response.
        token: r.headers['etag'] ?? expect(r.body, 'token'),
      }),
    },
    saveDraft: {
      request: ({ lessonId, manifest, token, options }) => ({
        method: 'PUT',
        url: `/lessons/${lessonId}/draft`,
        headers: { 'if-match': token },
        body: { manifest, checkpoint: options?.checkpoint },
      }),
      read: (r) => ({ token: r.headers['etag'] ?? expect(r.body, 'token') }),
    },
    // ...and the other ten. All of them, before any of them is used.
  },
})
```

**`read` must throw on an answer it cannot understand.** The adapter cannot tell a domain object from
nonsense, so a reader that shrugged would turn a failed request into a successful one carrying
nothing — a save reported as Saved that was not, which is the single outcome FR-DAT-003 exists to
prevent.

## The parts that cost somebody's work if you get them wrong

Read [`contracts/http-operations.md`](../../specs/010-portable-packages-http/contracts/http-operations.md)
before implementing. The short version:

- **A conflict must classify as `conflict`.** Map it to a plain failure and the editor will
  eventually overwrite somebody's work. This is the only thing standing between two teachers editing
  one lesson and one of them losing an afternoon, and the framework cannot check that you got it
  right — only that you supplied something.
- **Every save returns a new token**, checkpoint or not. Return the old one and the next save looks
  like a phantom conflict.
- **`loadVersion` returns the *current draft's* token**, not the loaded version's. Restoring is
  additive; returning the old token breaks that.
- **A non-checkpoint save still persists.** It is absent from the history, not from storage.
- **Withdrawn is not not-found.** Supply `loadPublished.isWithdrawn` if your API distinguishes them —
  one says a decision was made and can be reversed, the other says there is nothing here.

## Replacing the classifier

A default ships, mapping the HTTP status vocabulary: 401/403 → `permission`, 404/410 → `not-found`,
409/412 → `conflict`, everything else non-2xx → `unavailable`. It names no path and no resource, which
is why it is not a route mapping in disguise. If your API signals differently, pass your own.

## Testing

Pass `request` to inject your own transport. The whole of this package's suite runs with no network,
which is how its behaviour is asserted rather than assumed — and how yours can be.
