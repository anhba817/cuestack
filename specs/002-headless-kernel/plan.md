# Implementation Plan: Headless Kernel

**Branch**: `002-headless-kernel` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-headless-kernel/spec.md`

## Summary

`@cuestack/core` becomes real: the pure resolver, the injectable clock, the advance controller,
the element and effect registries, and the host adapter interfaces.

The approach turns on one shape decision. **`resolve(slide, timeMs) -> RenderState` is a fold
over effect descriptors, not a state machine.** Each effect is a function from progress to a
partial visual contribution; resolving an element means evaluating every effect active at `t`
and composing the results. Nothing accumulates between calls, so there is no state to get out
of sync, no replay path, and no difference between "played to 5000 ms" and "asked for 5000 ms".
That single property is what makes seeking correct (FR-004), server rendering possible
(FR-003), and editor-player parity structural rather than aspirational (Constitution V).

Everything else in this feature is arranged to protect it: the clock is injected so the resolver
never reads time, the advance controller takes injected signals rather than calling the resolver
— which is what lets it be built in parallel — and effects compose associatively so their
evaluation order cannot change the answer.

## Technical Context

**Language/Version**: TypeScript 6.0.3, `strict`, ES2022, `moduleResolution: bundler` — the
toolchain established in feature 001. Unchanged.

**Primary Dependencies**: **None at runtime.** `@cuestack/core` imports `@cuestack/schema`
types only (`import type`, erased at compile time) and keeps the zero-dependency guarantee that
`check-core-isolation.mjs` enforces. Test: Vitest 4.1.x, using its fake timers only at the
adapter seam — the kernel's own tests drive a hand-written synthetic clock instead, because a
test that depends on the runner's timer implementation is testing the runner.

**Storage**: N/A. This feature defines the storage *interface* and an in-memory reference; no
persistence, no network.

**Testing**: Vitest 4.1.x. Rule-named tests for the nine business rules that have subject matter
in this wave, plus an exhaustive combination sweep for the single-fire guarantee and a
play-vs-seek equivalence sweep over every state-change boundary in the corpus.

**Target Platform**: Must run in Node with no DOM present *and* in the browser matrix.
`window`, `document`, `performance`, and `requestAnimationFrame` MUST NOT be referenced
anywhere in `packages/core/src` — they arrive through injected ports.

**Project Type**: Library. Headless: computes state, renders nothing.

**Performance Goals**: `resolve()` on a 300-element slide under **10 ms**, leaving the rest of
NFR-PERF-003's 100 ms seek budget to whatever draws the result. Full timing suite under 5 s,
because nothing waits in real time.

**Constraints**: Zero runtime dependencies. No ambient clock reads, no DOM access, no
randomness. `resolve()` must be referentially transparent — the property every other guarantee
rests on. Effect composition must be associative and commutative within a phase, so that
FR-010's deterministic ordering is a belt-and-braces guarantee rather than the only thing
standing between a slide and a different appearance on second viewing.

**Scale/Scope**: ~12 new modules in one package. 35 functional requirements, 12 success
criteria. **Nine** of the eighteen business rules gain subject matter here — BR-002, 003, 004,
005, 006, 007, 010, 011, and 013. BR-001 (integer milliseconds) is a storage rule already
covered by feature 001's schema tests and has nothing to enforce in the kernel.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | Assessment |
|---|---|---|
| **I. Code Quality & Modular Boundaries** | Yes | PASS. Registries, not switch statements (FR-025) — enforced by a lint rule added in this feature that forbids switching on `element.type` outside a registry module. Element plugins must supply their full contract or fail to compile (FR-026). Core keeps zero runtime dependencies; the existing isolation check already proves it. |
| **II. Test-First & Deterministic Verification** | Yes — centrally | PASS. Everything in this feature is what the principle names: timing, advance rules, and the resolver, all built test-first against a synthetic clock. **The `@cuestack/core` coverage floor is enabled in this feature**, closing feature 001's documented deviation. Nine of eighteen business rules gain rule-named tests; see Complexity Tracking for the nine with no subject matter in the kernel. |
| **III. User Experience Consistency** | Partially | PASS. No user-facing surface, so theme tokens and WCAG have no subject matter. One clause does apply: FR-012 requires each effect to declare whether it is motion, which is what lets Wave 2/3 honour reduced-motion in CSS. The kernel supplies the fact; it does not decide the response. |
| **IV. Performance as a Contract** | Yes | PASS. Two of the seven budgets become live: seek-to-state (NFR-PERF-003, of which SC-001's 10 ms is the kernel's share) and the monotonic-clock requirement (FR-TIM-019), which this feature implements rather than merely respects. The perf gate placeholder from feature 001 is armed for `resolve()` in this wave; the playback-frame budgets stay placeholders until Wave 3 has frames. |
| **V. Preview-Player Parity** | Yes — this is the wave | PASS. The principle's first clause becomes real code here: exactly one resolver, and both consumers of it are yet to be written. SC-002's play-vs-seek equivalence sweep is the mechanical proof. The manifest-as-sole-source clause is honoured by `resolve()` taking only a slide and a time — there is no third argument through which editor state could leak. |

**Post-Phase-1 re-check**: PASS, with one design consequence worth recording. Making effect
composition associative (see research R-02) means FR-010's deterministic ordering is no longer
load-bearing for correctness — two orderings produce the same result. The requirement stays,
because a future non-commutative effect would need it and discovering that after the fact would
be expensive. No gate moved.

## Project Structure

### Documentation (this feature)

```text
specs/002-headless-kernel/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── core-package-api.md
│   ├── plugin-contract.md
│   └── host-adapters.md
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/core/
├── src/
│   ├── index.ts                  # public surface
│   ├── time/
│   │   ├── clock.ts              # injectable time source + delta clamping
│   │   └── transport.ts          # play / pause / seek / restart
│   ├── resolve/
│   │   ├── index.ts              # resolve(slide, timeMs) -> RenderState
│   │   ├── element.ts            # one element's contribution
│   │   ├── compose.ts            # contribution composition
│   │   ├── contribution.ts       # Contribution, TransformDelta, FilterDelta
│   │   ├── problems.ts           # non-fatal findings -> RenderState.problems
│   │   └── state.ts              # RenderState types
│   ├── effects/
│   │   ├── registry.ts
│   │   ├── easing.ts             # applied before an effect's at(), so none implements its own
│   │   └── builtin/              # opacity.ts, transform.ts, pulse.ts, filter.ts, index.ts
│   ├── elements/
│   │   ├── registry.ts
│   │   └── contract.ts           # ElementPlugin, enforced complete
│   ├── advance/
│   │   ├── controller.ts         # four modes + single-fire guard
│   │   ├── conditions.ts
│   │   └── reachability.ts       # unsatisfiable-rule detection
│   ├── ports/
│   │   ├── index.ts              # TimeSource, the aggregate Ports type
│   │   ├── media.ts              # observed media position
│   │   └── visibility.ts         # document-hidden signal
│   └── adapters/
│       ├── index.ts              # the three adapter interfaces
│       └── memory/               # in-memory reference implementations
└── test/
    ├── rules/                    # BR-*.test.ts, one per rule with subject matter
    ├── resolve/                  # including the play-vs-seek equivalence sweep
    ├── advance/                  # including the exhaustive combination sweep
    ├── transport/                # clock, clamp, seek, subscription
    ├── registry/                 # extensibility and unknown-type degradation
    ├── adapters/                 # storage, conflict, analytics shape
    └── harness/                  # synthetic clock, corpus, fixture builders
```

**Structure Decision**: One package, subdivided by concern rather than by layer. The
directories encode the dependency arrows: `resolve/` may import `effects/` and `elements/`;
`advance/` may import `resolve/`; nothing may import `transport` except the public surface. The
`ports/` directory exists to make the "no DOM in core" rule visible as structure — anything the
kernel cannot touch itself has a port here, so a reviewer can see the complete list of things
the host must supply.

`adapters/memory/` ships in the package rather than in tests because FR-032 requires the
framework to work with no host code, which makes the in-memory implementation product, not
scaffolding.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Constitution II requires all eighteen business rules to have rule-named tests; this feature delivers nine | BR-001 is a storage rule, tested in `@cuestack/schema` at feature 001 T018 — nothing in the kernel enforces it. BR-008/009 (published-version immutability) belong to Wave 5's publishing, BR-012 (accessibility policy) and BR-014 (autoplay gesture) to Wave 3's player, BR-016 (Simple Sequence resolution) to Wave 4's editor, BR-017 (duration reduced below event end) to the editor's warning path, BR-018 (published asset references) to Wave 5. None has code to test in this wave. | Writing placeholder tests that assert nothing would make the traceability grep report full compliance while proving none of it — strictly worse than an accurate count. The rule-file naming convention makes the nine that exist greppable and the nine that do not conspicuously absent. |
| `resolve()` returns a fully materialised `RenderState` rather than a lazy or diffed view | Wave 2 needs a plain value it can render server-side and compare against a client render; a lazy view cannot be serialised and a diff needs a previous state the server does not have. | A diff-based interface would be cheaper per frame but would reintroduce exactly the accumulated-state problem this design exists to avoid, and would make play-vs-seek equivalence untestable — you cannot diff against a state you never occupied. Measured cost is the mitigation: SC-001 bounds it at 10 ms for 300 elements. |
