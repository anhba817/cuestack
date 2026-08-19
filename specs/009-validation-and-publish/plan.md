# Implementation Plan: Validation and Immutable Publish

**Branch**: `009-validation-and-publish` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-validation-and-publish/spec.md`

## Summary

A lesson stops being the author's and becomes the learner's. PB-1 and PB-2 of Wave 5, specified and
planned together because "errors block publication" is one sentence that needs both halves.

Seven decisions carry the feature. The first is the one that reshaped the plan, and it came from
finding that the thing this feature was asked to build **already exists twice**.

**There are three validators in this repository, and two of them already disagree about scope.**
`@cuestack/schema`'s Tier 2 reports `ADVANCE_MEDIA_NOT_FOUND`, `ADVANCE_MEDIA_WRONG_TYPE`,
`ADVANCE_INTERACTION_NOT_FOUND`, and `ADVANCE_INTERACTION_NOT_REQUIRED`. `advance/reachability.ts`
reports `ADVANCE_UNSATISFIABLE` for **the same four conditions**, plus two the schema cannot see. And
`resolve/problems.ts` has emitted `ELEMENT_BEYOND_SLIDE` on every resolve since Wave 1. So the
danger here was never that PB-1 would be hard — it was that PB-1 would become the fourth copy, and
that a teacher would get two different answers to one question. FR-009 says it in the spec's own
words: "Two answers to one question is how a teacher learns to trust neither."

**So the engine composes rather than checks.** It calls `validate` from the schema, `checkReachability`
per slide, `collectProblems` per slide, and `ElementPlugin.validate` per element, and it owns exactly
one rule of its own — the static dead end. Everything else it does is *arrangement*: one vocabulary,
one severity model, one order, one location shape. That is a smaller feature than it looked and a
better one, because the alternative was four sources of truth about whether a lesson is publishable.

**The dead end is the one new rule, and core already named this feature as its consumer.**
`interactions/policy.ts` exports `isUnsatisfiable`, whose header reads: "The kernel does not rescue
the learner by opening the gate... It reports the condition, the player presents a way forward
(FR-030), and **Wave 5's validation engine warns the author before a learner ever meets it**." That
function is runtime — it takes the attempts a learner has made. Its static counterpart is a
two-line predicate on the same three inputs, and it belongs in the same file so the pair cannot
drift: a policy of `on_correct` with a finite `maxAttempts` is a dead end waiting for somebody.

**`ElementPlugin.validate` gets its first consumer — and its first producers.** It is ninth in a line
this project has now named eight times, and reading the registry found the other half of the story:
there are **no concrete `ElementPlugin` implementations in the shipped framework at all**, only in
test harnesses, and `DEFAULT_ELEMENTS` is empty. The seven MVP types have carried a renderer and an
editor since Wave 2 and no core plugin.

So the seam was real and empty, and an engine built on it would have validated nothing type-specific
for any type a teacher can author. Constitution I decides this rather than leaving it to taste:
"a plugin MUST supply its full contract before merge... **Partial plugins are rejected**." The seven
have been partial since Wave 1, and no feature until now depended on the missing member.

**This feature therefore ships the seven plugins**, and their `resolve` is deliberately inert —
`{ visible: true }`, no contribution, which is exactly what the code already does when no plugin
exists. Adding checks must not change what a lesson renders, and a parity suite asserts it across
the change rather than assuming it (research R-12, FR-006a–c).

**A supplied element registry replaces the default rather than extending it.** `resolve` reads
`context?.elements ?? DEFAULT_ELEMENTS`, so making the default non-empty helps only callers who pass
nothing. A host registering one custom type still gets a registry of one — unchanged behaviour, newly
consequential now that the empty-registry escape is off, because its other six types are then reported
unknown. `createElementRegistry([...builtinElements, mine])` moves from irrelevant to mandatory, which
is the sharpest edge this feature exposes to a host and belongs in the README.

**`resolve` was not the only member with a side effect, which is the lesson the analysis kept
teaching.** A plugin also carries an `inspector` specification, and `Inspector.tsx` gives a
registered plugin precedence over the editor registry — so seven new plugins would have changed the
authoring surface for all seven types. The fix is one list rather than two: the plugins declare each
type's fields, `builtinElementEditors` derives from them and adds only what editing needs, and the
precedence inverts where both describe one type, because the editor entry is the superset that knows
how to write the values (research R-13).

**`ValidationIssue` is reused, with a `source` and a severity beside it.** The schema's issue shape —
`code`, `path`, `location`, `message` — is already what an editor needs to navigate to a problem, and
`IssueLocation` already carries slide and element. Redefining it would give a host two shapes for one
idea.

The discriminator is not decoration. `RenderProblem` declares `UNKNOWN_ELEMENT_TYPE` and
`UNKNOWN_EFFECT_TYPE`, and `ISSUE_CODES` declares **the same two strings** with different meanings —
"no such type in the format" against "no such type in *this* registry". And `ElementPlugin.validate`
returns an *arbitrary* code by design, because a third-party type reports faults core has never heard
of, so a closed union could never hold every code the report carries. `source` is what makes both
facts safe (research R-03).

**Publishing is a fourth adapter, not six more methods on the third.** `StorageAdapter` is at four
methods after ED-5; publish, list, read, withdraw, restore, and the record would take it to ten and
would mix two lifetimes — a draft that changes constantly with a version that must never change
again. EN-6 established three adapters by capability; `PublishingAdapter` is the fourth, and the
split is what lets the immutability guarantee be structural: **there is no method that modifies a
published version**. As with the conflict token, absence is the enforcement.

**Publishing saves first, and the save loop cannot currently say when it is done.**
`DraftPersistence.saveNow()` returns `void`. FR-018a needs "save, and tell me whether it landed",
because a publish that proceeds after a failed save publishes something storage never held. So
feature 008's hook grows a promise-returning save — a small change to a file this feature does not
otherwise own, and the reason it is listed as a single-owner file below.

## Technical Context

**Language/Version**: TypeScript 6.0.3, `strict`, unchanged from features 001–008.

**Primary Dependencies**: No new runtime dependencies in any package.

**Storage**: The host's, through a new `PublishingAdapter` beside the existing three. An in-memory
reference ships with it, so FR-037's "exercisable with no host backend" holds for publication,
withdrawal, and the record as it already does for drafts.

**Testing**: Vitest 4.1.10. `@cuestack/core` (node) for the engine and the adapter contract —
validation is pure, so most of this feature's tests need no DOM at all. `@cuestack/studio` (happy-dom)
for the report surface and the publish flow, `@cuestack/studio-pure` for the severity policy,
`gates` for `check:rules` reaching 18 of 18.

**Target Platform**: Browsers, latest two major versions. The engine is DOM-free and runs anywhere.

**Project Type**: Monorepo of libraries — `@cuestack/schema` ← `@cuestack/core` ← `@cuestack/react`
← `@cuestack/studio`, plus `examples/nextjs`.

**Performance Goals**: Validating the 50-slide / 300-element fixture within one second (SC-005), and
without moving the editor's input-to-feedback budget. The engine is one pass over slides and
elements with a plugin call each; the expensive part is the schema validation it delegates to, which
already runs per edit in the reducer.

**Constraints**: The engine must be pure — no clock, no network, no DOM (FR-007). Asset resolution is
therefore a separate pass (FR-016a). A published version is frozen on read and has no write path
(FR-020). The framework holds no roles (FR-032a).

**Scale/Scope**: 300 elements, 50 slides, and a report that must stay navigable at two hundred
issues.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | How this feature satisfies it | Verdict |
|---|---|---|
| **I. Code quality & modular boundaries** | Element-type checks come from `ElementPlugin.validate`; the engine has no branch on element type, which is the property SC-001 measures. `PublishingAdapter` is a new capability boundary rather than a tenth method on an existing one. No `any` in an exported signature. | ✅ |
| **II. Test-first & deterministic verification (NON-NEGOTIABLE)** | The engine is pure, so its whole suite is a table: a lesson in, a report out, no clock and no DOM. The validation engine is named explicitly in the constitution's test-first list. BR-008, BR-009, BR-012, and BR-018 each gain a rule-named test, taking `check:rules` to 18 of 18. | ✅ |
| **III. UX consistency** | The report states the problem, the affected object, and the recommended action; severity is carried by words, never colour alone. Publish status reuses the shared vocabulary ED-5 built for saving — this is the second consumer Constitution III's "one shared component" clause anticipated. | ✅ |
| **IV. Performance as a contract** | One pass, delegating to a validator the reducer already runs per edit. Measured on the 50/300 fixture, with the asset pass excluded from that budget because it is network-bound and optional. | ✅ |
| **V. Preview–player parity (NON-NEGOTIABLE)** | Nothing here touches a renderer, a timing engine, or an effect. A published version is the same manifest a preview plays — that is the entire point of an immutable snapshot, and FR-021 asserts it plays with no draft present. | ✅ |

**Gates 1–7** all unchanged and all blocking. `check:rules` moves from 14 of 18 to 18 of 18, which
is a gate getting stricter rather than a gate being satisfied differently.

**Deviations**: none.

One tension is worth stating rather than leaving for a reviewer to find. Constitution III makes
WCAG 2.2 AA "a merge gate for learner-facing UI", and this feature sets the default severity for a
lesson's *own* accessibility metadata to **warning**. Those are different subjects: the first governs
the framework's UI, the second governs what a teacher must supply before publishing, which BR-012
explicitly delegates to organisation policy. The spec's Assumptions record the reasoning, and
FR-010b keeps the policy from silencing the rule.

## Project Structure

### Documentation (this feature)

```text
specs/009-validation-and-publish/
├── plan.md                          # This file
├── research.md                      # Phase 0 — nine decisions
├── data-model.md                    # Phase 1 — the report, the policy, the published version
├── quickstart.md                    # Phase 1 — how to run and verify each story
├── contracts/
│   ├── validation-contract.md       # What the engine promises, and what it delegates
│   └── publishing-contract.md       # The fourth adapter, and why immutability is structural
├── checklists/requirements.md       # From /speckit-specify, re-validated by /speckit-clarify
└── tasks.md                         # Phase 2 — /speckit-tasks, not created here
```

### Source Code (repository root)

```text
packages/core/src/
├── elements/builtin/
│   ├── index.ts                     # NEW — the seven, and `builtinElements`
│   │                                #       each carrying its type's canonical inspector fields
│   ├── text.ts, image.ts, shape.ts  # NEW — one file per type, resolve inert by design
│   ├── video.ts, audio.ts, button.ts
│   └── question.ts
├── resolve/index.ts                 # DEFAULT_ELEMENTS is built from the seven
├── validation/
│   ├── index.ts                     # NEW — checkLesson(): the composition, and the only entry
│   ├── codes.ts                     # NEW — the eleven semantic codes, and the source discriminator
│   ├── severity.ts                  # NEW — pure: policy applied to a code
│   ├── accessibility.ts             # NEW — BR-012's rule, which reads a common field a plugin cannot see
│   └── assets.ts                    # NEW — the separate, async, optional pass
├── interactions/policy.ts           # + isDeadEnd, beside the isUnsatisfiable it mirrors
├── publishing/
│   ├── index.ts                     # NEW — PublishingAdapter, PublishedVersion, the record
│   └── memory/index.ts              # NEW — the in-memory reference, with a real freeze
└── index.ts                         # exports follow the above

packages/studio/src/
├── registry/editors.ts              # inspector derived from builtinElements, not restated
├── inspector/Inspector.tsx          # precedence inverted where both describe one type (R-13)
├── validation/
│   ├── useValidation.ts             # NEW — runs the engine, holds the report, jumps to source
│   ├── ValidationReport.tsx         # NEW — errors and warnings, grouped, navigable
│   └── PublishControls.tsx          # NEW — publish, withdraw, restore, and what stopped them
├── persistence/useDraftPersistence.ts  # saveNow returns a promise (FR-018a)
├── styles/editor.css                # report and publish rules
└── index.ts                         # exports follow the above

examples/nextjs/app/edit/editor-view.tsx   # validate, publish, withdraw
```

**`PublishingAdapter` does not join `Ports`**, and the question deserves an answer rather than a
silence: the other three adapters *are* members, so a reader will expect a fourth. Playback never
publishes, and `Ports`' own comment gives the rule — "adding a port is then a visible change at every
construction site, rather than a quiet new obligation." Every player construction site and every
test's ports object would have to supply something the player cannot use. This is the same judgement
feature 008 made for `Scheduler` and `Connectivity`, and it now applies to three of six capabilities
rather than two of five.

**Structure Decision**: The engine goes in `@cuestack/core` because it is framework-agnostic and
because the three things it composes already live there or below it. It is a **sibling** of
`@cuestack/schema`'s validator rather than a replacement: that one answers "is this structurally a
lesson", this one answers "is this a lesson worth giving to a learner", and
[contracts/validation-contract.md](./contracts/validation-contract.md) draws the line so a future
rule has an obvious home.

`packages/core/src/publishing/` is a new directory rather than an addition to `adapters/`, and the
reason is the same one that makes it a fourth adapter: a draft and a published version have opposite
lifetimes, and putting them in one file invites a method that updates the wrong one.

### Post-design re-check

The design added one directory to core, one to the studio, one function to an existing kernel module,
and one promise to a hook feature 008 owns. Re-reading the five principles against that changes no
verdict:

- **I** — the engine's only knowledge of element types comes from the registry; the new adapter adds
  a capability rather than widening an existing one.
- **II** — purity makes the engine's suite a table, and the four newly covered business rules are the
  measurable outcome.
- **III** — one report vocabulary, one severity model, and the save-status component reused rather
  than a second one grown.
- **IV** — one pass, measured, with the network-bound part deliberately outside the budget.
- **V** — untouched, and asserted: a published version plays with no draft present.

## Complexity Tracking

No constitution violations to justify. Three choices that look like complexity are recorded because a
reviewer will reasonably ask about each.

| Choice | Why | Simpler alternative rejected because |
|---|---|---|
| A fourth adapter rather than six methods on `StorageAdapter` | A draft and a published version have opposite lifetimes; the boundary that can change one must not be the boundary that reaches the other | Ten methods on one interface, mixing "save this constantly" with "never touch this again" — and the immutability guarantee would rest on nobody adding an update method to a file full of update methods |
| A `source` field on every issue, beside two vocabularies | Two codes are already declared by both, and a plugin's code cannot be in a union core owns | One union in schema makes core's rules the schema's problem; two unions *without* a discriminator do not actually let a host tell the vocabularies apart, which was the whole reason for having two |
| Seven new element plugins inside a feature about validation and publishing | The engine's type-specific seam has no producers, so SC-001 would be satisfied by zero types and no lesson a teacher can author would be checked | Shipping the seam empty leaves a hole with a name; putting the checks in the engine is the `switch (element.type)` Constitution I calls a defect; registering *some* types is worst of all, because a partial registry turns off the empty-registry escape and flags the rest |
| BR-012's rule in the engine rather than in `ElementPlugin.validate` | `accessibility` is a common field beside `payload`, which `validate(payload)` cannot see | Widening the plugin signature would let every plugin report on fields it does not own, and would make the one policy-governed rule depend on every plugin author implementing it identically |
| The static dead-end predicate lives beside the runtime one | They are the same rule asked at two moments, and separating them is how they come to disagree | A dead-end check inside the validation engine would restate `on_correct` semantics that `policy.ts` already owns — the fourth-copy failure this whole plan is arranged to avoid |
