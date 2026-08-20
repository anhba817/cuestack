# Quickstart: proving portable packages and the HTTP adapter work

Runnable checks, in the order they become possible. Each says what to run and what it must show.

**Prerequisites**: `pnpm install`, then `pnpm build` — the studio and example suites resolve
`@cuestack/core` from `dist`, and a stale build is why `core-freshness.test.ts` exists.

---

## 1. Round trip, which is the whole feature in one assertion

```bash
pnpm vitest run packages/core/test/packaging/roundtrip.test.ts
```

Export every lesson in the test corpus and import it back. Each must be identical to the original
apart from the identity the caller supplied — no field lost, no field invented. This is SC-001, and
if it passes for the corpus it is difficult for the rest of export to be very wrong.

---

## 2. A package is readable with nothing but the package

```bash
pnpm vitest run packages/core/test/packaging/inspectable.test.ts
```

Two things, and the second is the one that matters:

- A files-mode package's asset content reconstructs the original bytes.
- **A package is read with no adapter, no registry, and no framework state** — the suite parses the
  document itself and rebuilds the lesson from what it finds. If this needs anything from the
  producing system, the package is not portable and SC-002 is not met.

---

## 2a. Bytes survive the round trip

```bash
pnpm vitest run packages/core/test/packaging/base64.test.ts
```

Every byte value 0–255, and a payload with a `0x00` in the middle. Not "does it encode a string" —
that passes against `btoa`, which is browser-only and corrupts everything above `0xFF`, and against
`Buffer`, which is Node-only and breaks the browser build. The codec is hand-written for exactly this
reason (research R-13).

---

## 3. Reference mode does no I/O at all

```bash
pnpm vitest run packages/core/test/packaging/pure.test.ts
```

Export in reference mode with **no content provider supplied**, and assert the call is synchronous
and complete. SC-002a is a structural claim rather than a time bound: a reference-mode export that
awaited anything would have acquired a dependency on the outside world that the default mode must not
have.

---

## 4. Two exports of one lesson are byte-identical

```bash
pnpm vitest run packages/core/test/packaging/deterministic.test.ts
```

SC-002b. The package's form must be a property of the framework rather than of who asked for it —
otherwise "the framework fixes the format" is not true, and two systems produce two formats again.

---

## 5. Hostile packages are refused before they are read

```bash
pnpm vitest run packages/core/test/packaging/harden.test.ts
```

Every attack the suite can construct: oversized, deeply nested, carrying a `javascript:` address.
Each must be refused with the reason named, and — for size — refused **before** parsing, asserted by
giving the parser a spy that must never be called.

Also assert the boundary that is *not* defended: an embedded asset whose content could carry a script
is imported unexamined, because the framework renders nothing itself. FR-016c requires that to be
documented; this asserts the documentation is honest.

---

## 6. Import writes nothing, anywhere

```bash
pnpm vitest run packages/core/test/packaging/import.test.ts
```

Run every import path — success, migration, and all six refusals — **with no storage adapter in
existence**. SC-005 is met by construction if this suite can run at all, which is the point of making
import pure.

Then the id rules: the package's lesson identity is discarded, inner ids are untouched, and the same
package imported twice with two identities yields two independent lessons.

---

## 7. Assets survive a store that renames them

```bash
pnpm vitest run packages/core/test/packaging/remap.test.ts
```

Import a files-mode package into a store that deliberately assigns identifiers unlike the package's.
Every reference in the resulting lesson must resolve (SC-005b).

Then the partial case: a mapping covering some assets produces a lesson where those resolve and the
rest are **reported unresolved** rather than dropped or silently kept.

---

## 7a. A host's own element types survive import

```bash
pnpm vitest run packages/core/test/packaging/registry.test.ts
```

A lesson using a registered custom type imports with no `UNKNOWN_ELEMENT_TYPE` issue when the host's
registry is supplied — and with one when it is not. The second half proves the option is load-bearing:
a supplied registry *replaces* the default rather than extending it, so a host that could not pass one
would have every custom element reported as unknown.

---

## 8. Migration, delegated rather than duplicated

```bash
pnpm vitest run packages/core/test/packaging/versions.test.ts
```

An older lesson version imports and reports which steps ran. A newer one is refused **carrying
`migrate`'s own issues** — assert the message comes from `migrate` rather than from packaging, since
a second opinion about the same fact is how two version checks come to disagree.

Separately: an unknown *package* version is refused by packaging's own check.

---

## 9. The adapter behaves like the in-memory reference

```bash
pnpm vitest run packages/adapter-http/test/parity.test.ts
```

SC-006. Run the same scenarios — save, conflict, version history, publish — against the HTTP adapter
over a stub and against `createMemoryStorage`/`createMemoryPublishing`, and compare the outcomes. A
difference here means a host swapping adapters gets different behaviour, which is what the interfaces
exist to prevent.

---

## 10. Two dissimilar APIs, one adapter

```bash
pnpm vitest run packages/adapter-http/test/shapes.test.ts
```

SC-008, and the reason it is two rather than one: a single API shape cannot demonstrate the adapter
is not quietly built around it. The two must differ in path structure, in how the version token
travels, and in how a conflict is signalled — and only the mapping may change between them.

---

## 11. Every failure lands in exactly one of four outcomes

```bash
pnpm vitest run packages/adapter-http/test/outcomes.test.ts
```

SC-007. Sweep the status space and assert no response falls through to a fifth meaning. Include the
two that are not statuses: a transport failure, and a 200 whose body cannot be read — the second must
be a failure, because a save reported as Saved that was not is the outcome FR-DAT-003 exists to
prevent.

---

## 12. Nothing retries, and nothing hangs

```bash
pnpm vitest run packages/adapter-http/test/discipline.test.ts
```

- A failing request is attempted **once**. Count the calls; feature 008's loop owns the retry.
- A cancelled request settles rather than leaving the editor reporting Saving forever.
- An incomplete mapping is refused **at construction**, naming every missing operation rather than
  the first.

---

## 13. No network, anywhere

```bash
pnpm vitest run packages/adapter-http
```

SC-011. The whole package's suite, with the request function injected everywhere. If any test needs a
network, the adapter is not testable and neither is anybody's mapping.

---

## 14. Nothing depends on the adapter

```bash
pnpm lint          # dependency-cruiser boundary rules
pnpm build         # every package still builds without it installed in the others
```

FR-027. `no-adapters-in-core` and `no-core-in-schema` must name `adapter-http`, or the rule is a
comment.

---

## 15. A teacher can reach it

```bash
pnpm vitest run packages/studio/test/portability
pnpm vitest run packages/studio/test/a11y/axe.test.tsx
```

The export control produces a document and the import control accepts one; both are keyboard-operable
with accessible names, and neither conveys its state by colour alone (SC-012).

---

## 16. The whole thing, with no backend

```bash
pnpm --filter @cuestack/example-nextjs build
pnpm --filter @cuestack/example-nextjs dev   # then: /edit
```

SC-013. Export a lesson, import the result back, and confirm the lesson returns — over the in-memory
adapters, with no server and no network. This is the demonstration the plan's "works with no backend"
claim has been making since Wave 1 and could not previously survive a page reload.

---

## 17. Everything else still passes

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage && \
  pnpm gates && pnpm check:rules && pnpm check:packaging && pnpm check:isolation && \
  pnpm check:studio-isolation && pnpm check:data-model && pnpm check:migrations
```

`check:rules` must still read **18 of 18** — this feature adds no business rule and must remove none.

**The last five are what CI runs**, and every earlier feature's equivalent of this step omitted them.
`check:packaging` matters here specifically: this is the first feature to add a package since that
script was written, and a malformed `exports` map is exactly what it catches.

**`test:coverage` is separate from `test`** — the root `test` script runs no coverage, so a shortfall
in the newly-covered `packaging/` module is invisible to every other command on this page.

---

## 18. The manual pass

Not automatable, and required before the feature is done:

1. With a screen reader running, reach both controls by keyboard alone from the editor root.
2. Export a lesson and confirm what is announced says what happened.
3. Import a package and confirm the outcome — imported, migrated, or refused — is announced rather
   than only rendered.
4. Import a deliberately broken package and confirm the refusal names what was wrong in words a
   teacher can act on.

Record the result in the pull request.
