# Contract: Lesson manifest format v1.0

**Date**: 2026-08-14 · **Feature**: `001-framework-foundation`

The compatibility promise around the lesson format. Field-level shapes live in
[`../data-model.md`](../data-model.md); this document says what may change and how.

## What the format is

A single JSON document describing a lesson's content: its slides, the elements on them, when
each element appears, what effects run, and how each slide advances. It is the manifest of
constitution Principle V — the single source of truth that editor and player both read, so
that neither can hold state the other cannot see.

It describes content only. It carries no identity, ownership, timestamps, storage locations,
or publication status; those are host records. See data-model.md for why.

## Versioning

`schemaVersion` is a two-part `MAJOR.MINOR` string, versioned independently of any package.

| Change | Version bump | Migration required |
|---|---|---|
| Add an optional field | MINOR | Yes — a no-op step, still registered |
| Add a member to an enum | MINOR | Yes |
| Add a new element or effect type | MINOR | Yes |
| Widen a value range | MINOR | Yes |
| Add a required field | MAJOR | Yes, supplying the value |
| Remove or rename a field | MAJOR | Yes |
| Narrow a range or enum | MAJOR | Yes |
| Change a field's meaning at the same name and type | MAJOR | Yes — and avoid; it is the change readers cannot detect |

Every version change ships a migration step in the same revision, including the no-op ones.
CI gate 10 enforces it. The no-op steps matter: they keep the chain contiguous, and gap
detection depends on contiguity.

## Compatibility promises

**To lesson authors.** A manifest accepted by version *N* will be readable by every version
after *N*. Content is never lost to an upgrade. This is the promise the whole migration
mechanism exists to keep, and it is why upgrades are forward-only — a downgrade path would
require deciding what to discard, and there is no defensible answer.

**To host applications.** `validate()` and `migrate()` never throw and never mutate input. A
manifest that round-trips through export and import is equivalent to the original (FR-006).

**To future implementations.** The format is expressible as data. Nothing in it depends on a
particular language, framework, or runtime. A second implementation validating the same corpus
must reach the same accept/reject decision — which is why data-model.md records
required-versus-optional explicitly rather than leaving it implied by one library's behavior.

## Strictness

Unknown fields are **rejected**, not ignored and not preserved.

This is the most restrictive choice available and it is deliberate. Silently preserving
unknown fields would let a host smuggle learner identifiers into a lesson, defeating FR-019 by
convention rather than by structure. Silently stripping them would violate the round-trip
promise the moment anyone relied on one. Rejecting is the only option that keeps both
guarantees, and it makes forward-compatibility explicit: reading a newer manifest requires a
newer reader, which the version check already told you.

## The reference manifest

`packages/schema/fixtures/valid/reference.json` is the §28 example extended to exercise every
element type, both interaction types, all four advance modes, and all three effect phases.

It is normative in a narrow sense: it is the worked example the documentation cites, and CI
validates it with the same code path that validates user content (FR-007). If a change makes
the reference invalid, either the change or the reference is wrong — the build stops until
someone decides which.

## Out of scope for v1.0

Present in the product spec, deliberately absent from the format at v1:

- Multiple-select, short-answer, matching, and ordering interactions (FR-INT-002, "Should") —
  additive enum members later.
- Slide groups and sections (FR-SLD-010, "Should").
- Reusable components and saved element groups (FR-CAN-020, "Could").
- Branching and conditional navigation (spec §35 "Later opportunities") — the one item here
  that may not be additive, since it would make `slides` a graph rather than a sequence. Worth
  knowing now that it is the most likely cause of a future MAJOR.
