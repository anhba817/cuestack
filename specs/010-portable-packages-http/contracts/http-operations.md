# Contract: what the HTTP adapter needs from a host's API

This is **not** a list of routes. The framework does not know your API and will not pretend to.

For each operation below: what the adapter gives you, what it must be able to learn back, and which
distinctions your mapping is responsible for preserving. You decide the address, the method, the
headers, and the body. Read §4 before you implement any of it — it is the part that costs somebody's
work if you get it wrong.

---

## 1. The shape of the arrangement

**Reconciled against the built adapter (T058).** Three things changed during implementation and this
document is the corrected version, not the one written before the code:

1. **A reader gets the whole response, not the body.** A version token may travel in a header —
   ETag-shaped concurrency is ordinary — and a reader given only the body could not serve it. Found
   by writing the second API shape SC-008 requires, which is what a second shape is *for*.
2. **`loadPublished` carries an `isWithdrawn` hook.** The four outcomes cannot express a withdrawal,
   and collapsing it into `not-found` loses the distinction §4 makes the host responsible for. So the
   host is asked directly rather than the framework inferring from a status it has no opinion about.
3. **A reader must throw** on an answer it cannot understand. Stated below rather than assumed.


```text
your mapping           the adapter                     your server
─────────────          ───────────                     ───────────
build a request  ──►   perform it (once, no retry) ──►
                       thread credentials
                       honour cancellation
                 ◄──   classify the response      ◄──  respond
                       into one of four outcomes
```

**The adapter never retries.** Feature 008's save loop owns retry and backoff, and two retry
policies over one request is how a save gets sent four times.

**The adapter holds no credentials.** They are supplied per request and are never stored, cached,
refreshed, or logged.

---

## 2. The operations

Each operation has two halves, both yours: a **request builder** and a **reader**. The reader
receives `{ status, headers, body }` and returns the value the interface promises — or throws.

| Operation | Adapter gives you | It must learn back |
|---|---|---|
| Load draft | lesson id | the manifest, and the version token it is at |
| Save draft | lesson id, manifest, the token it last knew, whether this is a checkpoint | the **new** token, or that this was a conflict |
| List versions | lesson id | the checkpoints, oldest first, each with when it was recorded |
| Load version | lesson id, token | that version's manifest, and **the current draft's token** |
| Resolve asset | asset id | an address, or that there is none |
| Report event | the event | nothing — see §5 |
| Publish | lesson id, manifest, publisher identity | the published version, with its id and number |
| List published | lesson id | the versions, **newest first** |
| Load published | lesson id, optional version id | that version, or that the lesson is **withdrawn** |
| Withdraw / restore | lesson id, actor identity | whether it happened |
| Read record | lesson id | the entries, oldest first |

**"Load version returns the current draft's token" is not a typo.** Restoring is additive: what comes
back is content to be saved forward as a new version, and returning the old token would make the very
next save look like a conflict. `StorageAdapter`'s own header explains this at length and it is the
easiest thing on this page to get subtly wrong.

---

## 3. The four outcomes

Every response resolves to exactly one:

| Outcome | Means | The editor does |
|---|---|---|
| `permission` | not allowed, and retrying will not help | tells the teacher they lack permission |
| `not-found` | there is nothing there | tells them it is missing |
| `conflict` | somebody else moved it since you last looked | offers the choice; **does not overwrite** |
| `unavailable` | could not be reached; try again shortly | keeps the work and retries later |

**A default classifier ships**, mapping the HTTP status vocabulary: 401/403 → `permission`, 404 →
`not-found`, 409/412 → `conflict`, 5xx and transport failure → `unavailable`. It names no path and no
resource — it encodes a published standard, not our opinion about your API. Replace it if your API
signals differently.

**Success is not assumed from a status.** A 200 whose body the adapter cannot read is a failure. A
save reported as Saved that was not is the single outcome FR-DAT-003 exists to prevent.

**Your reader must throw on an answer it cannot understand.** The adapter cannot tell a domain object
from nonsense — a reader returning `undefined` produces a successful result carrying nothing, which
is the same failure by a quieter route. A reader that throws is turned into `unavailable`.

---

## 4. What you are responsible for, and what breaks if you get it wrong

The framework **cannot check that your classification is correct**. It can only check that you
supplied one. So:

> **If you map a conflict onto a plain failure, the editor will eventually overwrite somebody's
> work.** The conflict path is the only thing standing between two teachers editing one lesson and
> one of them losing an afternoon. It is in the interface's signature precisely so a host cannot
> accidentally implement last-writer-wins — and a mapping that discards the distinction reintroduces
> exactly that, below where any of the framework's guarantees can see it.

Also yours:

- **Distinguishing `permission` from `unavailable`.** A teacher told "could not save" about a
  permission problem will retry forever; told "unavailable" about a permission problem, the same.
- **Distinguishing withdrawn from not-found** on load-published. One says a decision was made and can
  be reversed; the other says there is nothing here. Supply `loadPublished.isWithdrawn(response)`;
  without it every absence is a not-found, and a teacher sees a broken link where they should see a
  lesson they took down.
- **Returning the new token on every save.** Every save advances it, checkpoint or not. An
  implementation that returns the old one turns the next save into a phantom conflict.
- **Persisting non-checkpoint saves.** A save that records no checkpoint is absent from the *history*,
  not from *storage*. An adapter treating one as a no-op passes every history test and loses an hour
  of work.

---

## 5. Analytics is different

Reporting an event is fire-and-forget, and **the adapter catches the rejection** — asserted by
listening for an unhandled one, because that is a process warning or a crash depending on flags. A failed report must never interrupt a lesson: a learner's
progress does not depend on our telemetry arriving. Failures are swallowed, not surfaced, and this is
the one operation whose outcome nobody branches on.

**Fire-and-forget is forced by the signature, not chosen.** `AnalyticsAdapter.record(event)` returns
`void` and is synchronous, so an HTTP implementation has nowhere to put a promise and no way to report
a failure even if it wanted to. That makes one obligation non-negotiable: **the rejection is caught at
the boundary**. A dropped promise is a process-level warning or a crash depending on how the runtime
is configured — which would be this operation interrupting a lesson by exactly the route it exists to
avoid.

---

## 6. Completeness

The mapping is supplied **whole**, at construction. An operation nobody described is reported then —
naming every missing one, not the first — rather than at the moment a teacher uses it. A mapping
discovered to be incomplete an hour into somebody's work is the worst moment to discover it.

---

## 7. What this contract does not cover

Authentication schemes, URL structure, content negotiation, pagination, rate limiting, and multi-tenancy.
All yours. The framework performs the request you describe and reads the answer you classify.
