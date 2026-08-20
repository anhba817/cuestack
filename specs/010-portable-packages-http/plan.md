# Implementation Plan: Portable Packages and the HTTP Adapter

**Branch**: `010-portable-packages-http` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-portable-packages-http/spec.md`

## Summary

Two halves of one promise: a lesson can leave this framework in a form anybody can read (SCH-3), and
a host can persist lessons to its own API without writing four adapters first (PB-3).

The approach is shaped by four things that already exist and one that does not. `migrate` already
refuses a newer lesson version with a good message, so import delegates the entire lesson-version
question to it. `collectAssetRefs` already walks a manifest for asset identities at any depth, so
reference rewriting reuses that walk rather than growing a second one that can disagree with it.
Feature 008's save loop already owns retry and backoff, so the adapter has none. Feature 009's report
type already exists, so an imported lesson's problems arrive in the panel a teacher knows. What does
not exist is any code in this project that talks to a network — which is why the adapter is a
separate package a host may decline entirely.

Export and import live in `@cuestack/core` because that is the only package that can reach `migrate`,
`validate`, and `collectAssetRefs` at once. Neither touches storage: import produces a lesson and the
caller saves it through the one path that already handles conflict, offline, and acknowledgement.

## Technical Context

**Language/Version**: TypeScript 6.0.3, strict, ESM-only

**Primary Dependencies**: none new. `@cuestack/adapter-http` depends on `@cuestack/core` for the
interfaces it implements and on the platform's `fetch`, which is injectable and therefore not a
dependency in the sense the constitution means

**Storage**: none added. This feature writes nothing anywhere — a package is a value, and import
hands its result to the caller. In a host holding one lesson, the caller applies it as a
`replace-draft` edit and the existing autosave loop persists it, so there remains exactly one route
by which a lesson reaches storage

**Testing**: Vitest 4.1.10; node environment for core packaging and for the adapter; happy-dom for
the studio control. No network in any suite

**Target Platform**: the adapter targets any runtime with `fetch`; packaging is platform-free

**Project Type**: monorepo of libraries — `@cuestack/schema` ← `@cuestack/core` ← adapters

**Performance Goals**: reference-mode export of the 50-slide fixture performs no I/O and completes
well inside SC-010's three seconds; files-mode export is bounded by the host's content provider

**Constraints**: no clock, no randomness, no network in core (FR-030); import bounded at 64 MiB and
64 levels by default; the adapter never retries and always honours cancellation. **No platform
globals in packaging** — `Buffer` and `btoa` are each half the runtimes this package ships to, so
Base64 is hand-written (research R-13)

**Scale/Scope**: two pure modules in core, one studio component, one new package implementing four
adapter interfaces, two contract documents

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — result at the end of this section.*

| Principle | Assessment |
|---|---|
| **I. Code Quality & Modular Boundaries** | **Pass, with one addition.** A fifth package needs `.dependency-cruiser.cjs` updated so `no-adapters-in-core` and `no-core-in-schema` name it — otherwise FR-027 is documentation rather than a rule. No `switch` on element type anywhere: reference rewriting reuses the registry-free deep walk `collectAssetRefs` established. No manifest change, so no `schemaVersion` bump and no migration. |
| **II. Test-First & Deterministic Verification** | **Pass, after a correction.** Export and import are pure functions from a value to a value; the adapter's request function is injected, so every suite is a table with no clock and no network. Round-trip is the natural first test and it is also SC-001. **An earlier draft of this row claimed core's 90% coverage floor already applies to packaging. It does not** — `vitest.config.ts` scopes the floor to `packages/core/src/{resolve,effects,time,advance}/**`, and packaging would have landed outside it. T009a widens the scope so the claim becomes true. See the note below on how far it widens. |
| **III. User Experience Consistency** | **Pass, and NFR-USA-003 is the part worth stating.** The studio control is keyboard-operable with accessible names and conveys nothing by colour alone (FR-042), and introduces **no new status vocabulary** — export and import are momentary actions, not states, so they add no fifth word to Saving/Saved/Offline/Save Failed. **Importing replaces the open draft, which is destructive**, and the constitution requires destructive actions to be undoable or confirmed. It is undoable, and by construction rather than by new work: `apply` records a history step for every successful edit, and `every-kind.test.tsx` already asserts `replace-draft` reverses byte for byte. Feature 008 paid for this when it deleted its last confirmation dialog. |
| **IV. Performance as a Contract** | **Pass, with one budget worth stating.** No existing budget is touched: nothing here runs during playback, seeking, or editing. Reference-mode export must do no I/O at all (SC-002a), which is a stronger claim than a time bound and is asserted structurally. |
| **V. Preview-Player Parity** | **Not engaged.** No renderer, no timing engine, no effect. Import produces a manifest and the manifest is the single source of truth, which is the principle's premise rather than a risk to it. |

**The coverage scope, and the part this feature does not fix.** The floor's `include` list has been
widened once per feature since Wave 1 — its own comment says "US2-US5 widen it to
`packages/core/src/**` as each lands" — and that has now been skipped twice: feature 009's
`validation/`, `publishing/`, and `elements/` are all outside the floor today. T009a widens it to
cover **`packaging/` only**, which is this feature's own code. Sweeping in three modules this feature
did not write would make an unrelated failure this feature's problem, and the honest fix is a
decision somebody makes deliberately rather than a side effect of a diff. Recorded in T062 so it is
written down where it will be found.

**Security (Technology Constraints).** NFR-SEC-007 requires content sanitized against script
injection. Import discharges it for this path with an address-scheme allow-list. Research found the
hole is wider than import — `elementSchema` permits `javascript:` in a button's address today, for
any lesson — and this feature deliberately does **not** fix that, because tightening the schema
rejects manifests that are valid now and needs its own decision about versioning and migration. It is
recorded as a finding in [research.md R-06](./research.md) and belongs in the framework plan.

**Post-Phase-1 re-check: passes.** The design added no violation. The one item that needed watching —
whether a default status classifier breaches FR-019b's ban on a default route mapping — is argued in
[research.md R-07](./research.md): a classifier names no path and no resource, and encodes the HTTP
status vocabulary rather than an opinion about a host's API.

## Project Structure

### Documentation (this feature)

```text
specs/010-portable-packages-http/
├── plan.md                        # This file
├── research.md                    # Phase 0 — eleven decisions, one deviation, one finding
├── data-model.md                  # Phase 1 — the package and the mapping
├── quickstart.md                  # Phase 1 — how to prove it works
├── contracts/
│   ├── package-format.md          # The interchange format, in full
│   └── http-operations.md         # What the adapter needs from a host's API
├── checklists/requirements.md     # 16/16
└── tasks.md                       # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
packages/core/src/
├── packaging/
│   ├── index.ts                   # NEW — exportLesson, readPackage, importLesson
│   ├── format.ts                  # NEW — PACKAGE_FORMAT_VERSION, the document shape, its guard
│   ├── base64.ts                  # NEW — a hand-written codec; neither Buffer nor btoa (R-13)
│   └── harden.ts                  # NEW — size, depth, and address-scheme checks
├── validation/assets.ts           # CHANGED — gains remapAssetIds beside collectAssetRefs
└── index.ts                       # CHANGED — exports packaging

packages/studio/src/
├── portability/
│   └── PortabilityControls.tsx    # NEW — two controls, no file browser
├── styles/editor.css              # CHANGED — appended
└── index.ts                       # CHANGED — exports the control

packages/adapter-http/             # NEW PACKAGE — @cuestack/adapter-http
├── package.json, tsconfig.json, tsdown.config.ts
├── README.md                      # NEW — how to supply a mapping, with a plainly-an-example example
├── src/
│   ├── index.ts                   # createHttpAdapters(mapping, options)
│   ├── mapping.ts                 # OperationMapping, completeness check
│   ├── classify.ts                # the default status classifier, replaceable
│   ├── request.ts                 # perform once, credentials, cancellation, no retry
│   ├── storage.ts                 # StorageAdapter over the mapping
│   ├── assets.ts                  # AssetAdapter
│   ├── analytics.ts               # AnalyticsAdapter — fire and forget
│   └── publishing.ts              # PublishingAdapter
└── test/                          # every suite offline, against a stub request function

examples/nextjs/app/edit/          # CHANGED — export/import wired end to end, no backend
vitest.config.ts                   # CHANGED — adapter-http joins the node project glob
.dependency-cruiser.cjs            # CHANGED — adapter-http named in two boundary rules
```

**Structure Decision.** Packaging goes in `@cuestack/core` because it is the only package that can
reach `migrate` and `validate` (in schema) and `collectAssetRefs` (in core) at the same time; schema
cannot import core, and a new package would have to depend on core for the asset walk anyway. The
HTTP adapter is a fifth package because FR-027 requires a host to be able to install none of it, and
because it is the first code here that talks to a network — a property worth keeping behind a
boundary a build can see.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| A fifth package | FR-027: a host using no HTTP must download no HTTP, and the framework's first network-touching code should be declinable | Putting the adapter in `@cuestack/core` would make every host carry it and would put `fetch` inside the package the constitution keeps a small dependency surface for |
| `remapAssetIds` in `validation/assets.ts`, which is not validation | The finder and the rewriter must walk identically or they disagree about what an asset reference is — the argument feature 009 already made for sharing `collectAssetRefs` | A separate `assets/` module reads better and churns a file shipped three commits ago for no behavioural gain; the header carries the explanation instead |
| A default status classifier, near FR-019b's ban | FR-022's four outcomes are load-bearing, and leaving them entirely to hosts puts the distinction in the place least likely to get it right | No classifier makes the adapter an empty wrapper around host-written functions; a fixed one contradicts FR-019's premise. Overridable-with-a-default is the only option that leaves both intact |

## Phases

**Phase 0 — Research.** Complete. Eleven decisions in [research.md](./research.md), including one
deviation stated rather than hidden (depth cannot be checked before parsing without a streaming
parser) and one finding that is recorded rather than acted on (the schema permits executable
addresses today).

**Phase 1 — Design.** Complete. [data-model.md](./data-model.md), two contracts, and
[quickstart.md](./quickstart.md).

**Phase 2 — Tasks.** `/speckit-tasks`. Expected shape: US1 (export) is independently shippable and is
the MVP; US2 (import) follows and is where the risk lives; US3 and US4 are the adapter and can proceed
in parallel with either, since they share nothing but the interfaces.
