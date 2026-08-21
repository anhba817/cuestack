# Specification Quality Checklist: The Authoring Guide and the Second Adapter

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-20
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

All 16 items pass. The three `[NEEDS CLARIFICATION]` markers were resolved in the 2026-08-20
clarification session and are recorded in the spec's Clarifications section.

**What each answer changed beyond its own requirement**

- **FR-010 — proof-scoped.** Removing interactions from scope invalidated two things already written:
  a US2 acceptance scenario asserting a required question gates identically, and SC-006 asserting the
  same. Both were replaced rather than deleted — SC-006 now measures the *unavailable* path, which
  with a subset adapter is the ordinary case rather than the edge one. FR-010a and SC-014 are new:
  with a partial adapter the predictable failure is a host installing it expecting a whole player, so
  the absence is stated in three places.
- **FR-011 — a suite, not a gate.** FR-011a is new, because somebody will otherwise read this as
  contradicting Constitution V. It does not: preview-versus-playback is one renderer compared against
  itself, where a difference is a bug; two adapters are two renderers by design over a shared kernel.
  The reasoning is explicitly conditional on the covered surface staying small.
- **FR-006 — executable examples.** Split into three, because "the guide cannot rot" is more than one
  obligation: the example must be real and exercised (FR-006), the quoting must itself be checked
  (FR-006a), and the example must supply the *whole* contract (FR-006b) — an example omitting a member
  would teach an author to write something Constitution I rejects.

**Costs recorded rather than solved**, and carried into planning as such:

- A package named "adapter" that does not play questions or media.
- Adapter agreement that can drift between releases, by design.
- Every contract change now also updates a documented example.

Two items deliberately allow apparent implementation references. "React" and "web component" name the
existing adapter and the platform capability this feature is about. `@cuestack/element` is named
because the package already exists in the workspace.

**Changed by `/speckit-analyze` remediation (2026-08-20)**

Nine findings, seven at MEDIUM or above, all applied. Five of the nine were the same shape: **a
configuration file with an explicit package list that a new package must be added to.**

- **Constitution III had no mechanism reaching this package** (A1). `theme-values.mjs` targets
  `packages/react/src/elements` and `packages/studio/src`; so does the ESLint no-hardcoded-theme rule.
  "All visual styling MUST resolve from theme tokens" therefore reached nothing this feature writes,
  in a feature whose T025 writes a stylesheet. T003a widens both.
- **FR-009 had no task** (A2) — the feature's central claim, and the plan's stop condition. T023a
  asserts it structurally: the adapter imports `resolve`, `createClock`, and `createTransport` and
  defines none of them.
- **T002 said "add" where the answer is "move"** (A3). `@cuestack/element` is already in the node
  vitest glob; adding a second registration would run its DOM suites in an environment with no
  `customElements`.
- **The a11y gate has its own package list** (A4), so SC-009's "measured the same way" would have been
  measured by a different command. Folded into T021.
- **`agreement.mjs` was placed among the gates** (A5), where `run-all.mjs` fails on a non-zero exit. It
  works, and it is a category error the next reader would "fix" into a gate — reversing FR-011
  silently. Moved to `tools/scripts/check-agreement.mjs`.
- **FR-011a had no home** (A6) and **SC-011 had no verification** (A7). Folded into T030 and T043.

**Second `/speckit-analyze` pass (2026-08-20)** — four more, three of them mechanisms that would have
failed the moment somebody ran them:

- **The pass-1 theme fix reached nothing** (B1). Adding the package to the rule's `files` glob was
  correct and insufficient: the selector matches `Literal`, and a colour in a template literal is a
  `TemplateElement`. Verified by running ESLint against a probe. `styles.ts` is a template literal.
  T003a widens the selector and T025a asserts the emitted CSS directly, because a lint rule can be
  evaded by how a string is assembled and a test that reads what the shadow root receives cannot.
- **`check-agreement` could not work as a node script** (B2). It has to drive React and a custom
  element; node has neither. Split into T037 (a suite in a DOM project) and T037a (a script that
  spawns it), which is the shape the existing parity gate already uses.
- **Two test files no project collects** (B4). The `gates` project includes `tools/scripts/**/*.test.ts`
  and T011/T031 wrote `.test.mjs` — so the checker underpinning "documentation cannot rot" would have
  had no test that runs.
- **T003's rule scoping decides whether T037 is legal** (B3). Every existing rule scopes to
  `^packages/<x>/src`; a rule written `^packages/element/` would forbid the one suite that proves the
  adapters agree.

**Correction to the above (third pass).** B1's *evidence* was invalid. The template-literal probe ran
against `packages/studio/src`, where the colour rule does not apply at all, so it demonstrated
nothing about template literals. Retested inside `packages/react/src/elements`, where the rule does
apply: a plain `"#336699"` **fires** and the same hex in backticks **does not**. B1's conclusion — that
a direct CSS-string assertion is the mechanism that holds — survives; the reason given for it did not.

Worth recording plainly: **B1 was a defect in the pass-1 remediation** — a guarantee added without
running the mechanism that enforces it, which is the same failure this project has now hit five times
across three features, and the first time it recurred *inside* a fix for itself.

**Third `/speckit-analyze` pass (2026-08-20)** — three applied, one referred:

- **T001 and T037 contradicted** (C2). T001 forbade any UI-framework dependency; T037 put a suite in
  `packages/element/test/` importing `@cuestack/react`. Probed rather than argued: the same import
  added to `packages/adapter-http` fails with "Cannot find package". Resolved by splitting the claim —
  `dependencies` carry no UI framework, which is what FR-013 is about; `devDependencies` carry what a
  test needs and `files: ["dist"]` ships none of it.
- **T003a named an ambiguous target** (C3). `tools/eslint-config/index.js` has five blocks setting
  `no-restricted-syntax`; only one is the colour rule. Now identified by its selectors.
- **T003b is new**, and is the lesson of this feature's own history: prove the enforcement by making a
  violation and watching it fail. Twice now, enforcement was added whose mechanism was never run —
  once inside a fix for that pattern.

**Referred, not applied — a pre-existing CRITICAL.** `gate:theme-values` runs ESLint over
`packages/react/src/elements` **and** `packages/studio/src` and prints that neither has colour
literals. `eslint --print-config` reports the colour rule as present for a react element file and
**absent** for a studio one, and a deliberate `"#336699"` in a real studio source file lints clean. The
gate's green has been meaningless over `packages/studio/src` since feature 005.

Its blast radius is **unmeasured**: an attempt to widen the rule's `files` glob did not take effect,
for reasons not established, so no violation count can be honestly reported. Closing it needs its own
investigation and is outside this feature.

**Fourth `/speckit-analyze` pass (2026-08-20)** — one CRITICAL that four passes had missed, and one
pre-existing gap finally measured.

- **Author-supplied content had no protection** (D1). The constitution requires rich text to be
  sanitized against script injection; `@cuestack/react` satisfies that structurally — children are
  escaped, and `dangerouslySetInnerHTML` is banned by a rule whose selectors are **JSX-only**. Neither
  survives the move to a custom element, and a hand-written DOM is exactly what reaches for
  `innerHTML`. Added FR-015a/b, SC-009a, T003a2 (the rule), T003b (proving it), T020a (the test), and
  constraints in T026/T028.
  **Four passes missed it because NFR-SEC-007 is not a requirement in this spec** — it is a constitution
  constraint the primary adapter satisfies as a property rather than a rule. Nothing in a
  requirements-to-tasks matrix can show a protection disappearing with the renderer that provided it.
- **The Principle III gap is measured and closed here** (D2). The colour selectors never reached
  `packages/studio/src` because that package's own `no-restricted-syntax` block replaces the rule
  rather than merging it — the failure the config's header warns about. Spread in, with a control
  violation firing, `packages/studio/src` yields **zero violations**: the code is clean and only the
  enforcement was absent. T003a1 closes it in two lines.

**A method note worth keeping.** Two diagnoses in this investigation were wrong before the third was
right, and both wrong ones came from **counting output rather than reading it** — `grep -c` returning
zero from a probe that had not applied, reported as evidence. The corrected habit is in T003b: make a
violation, watch it fail, then remove it.

**Fifth `/speckit-analyze` pass (2026-08-20)** — one HIGH, found by applying the previous pass's
question systematically rather than by re-reading anything.

- **Reduced motion had no task and the word appeared nowhere** (E1). It is a two-part mechanism in
  `@cuestack/react`: the kernel emits a reduced alternative, `reducedProperties` writes it under
  mirrored `--cs-r-*` names, and `stage.css` chooses at paint time — necessarily in CSS, because the
  preference is unreadable on a server. The adapter's frame layer was scoped to "geometry, opacity,
  transform, not the whole visual vocabulary", which excludes the mirrored set and would have left the
  media block nothing to select. Added FR-015c, T020b, and constraints in T024/T025.
- **FR-015's clauses are not equally live under the proof scope** (E2). The covered types are
  non-interactive, so "keyboard-operable controls with accessible names" has almost nothing to clear.
  Now stated in the requirement and in T021's header, so a passing a11y suite is not read as broader
  assurance than it gives.

**The pattern is now named rather than rediscovered.** Escaping (D1) and reduced motion (E1) are the
same finding twice: React satisfies constitutional requirements as *properties of how it works* rather
than as rules anybody wrote down, and no requirements-to-tasks check can see one vanish with the
renderer that provided it. Research R-12 records what that leaves — the third candidate, ARIA, belongs
to components this adapter does not have.

**Sixth `/speckit-analyze` pass (2026-08-20)** — one CRITICAL, found by asking a question none of the
previous five had asked: *is the MVP story's premise achievable?*

- **SC-001 was unsatisfiable and the guide's recipe was incomplete** (F1). The element `type` is a
  closed discriminated union, so a third-party type needs **four** contributions across four packages,
  and the fourth is a versioned format change. Three registrations produce a type that registers,
  renders, and appears in the Add menu — and then the lesson will not save. SC-001 now says "no change
  to the **kernel**", which is Goal 5's actual claim; FR-002/002a, data-model §2, the guide contract,
  T013a, and T015 carry the fourth piece and its distinct failure mode.
- **Two parallel tasks on one file** (F2), twice: T003a/T003a1/T003a2 on the ESLint config and
  T002/T039 on `vitest.config.ts`. Both sets were added in different passes without seeing each other.

**On method, since the previous pass got this wrong.** Pass 5 concluded analysis was near exhaustion.
It was not: what was exhausted was *one question*. Yield tracks the number of distinct questions asked,
not the number of passes — and the questions that paid were "what does this mechanism actually do when
run" (passes 3–4), "what did React provide structurally" (4–5), and "is the premise achievable" (6).

**Seventh `/speckit-analyze` pass (2026-08-20)** — one HIGH, and it was a defect in the *sixth* pass's
remediation.

- **T013a asked for something that should not be built** (G1). It said the example lesson is "refused
  without a format variant, and accepted with one". `elementSchema` has no extension point, so the
  second half means editing `packages/schema/src/validate/element.ts` — which `check:migrations`
  watches, requiring a migration and a `schemaVersion` bump. Following it would have put an invented
  element type in the published lesson format for the sake of a document. Now asserts the refusal
  only.
- **The guide demonstrates three pieces and describes the fourth** (G2), which nothing said. T015, the
  guide contract, and R-13 now say it and say why — and supply the two facts a reader cannot guess:
  an additive variant transforms nothing, and still needs a registered migration step to keep the
  chain unbroken.

**A remediation is a change, and changes need analysing too.** Pass 2 found a defect in pass 1's fix;
pass 7 found one in pass 6's. Two of seven passes caught problems the previous pass introduced, which
is the strongest argument in this record for re-analysing after remediating rather than proceeding
straight to implementation.

**Eighth `/speckit-analyze` pass (2026-08-20)** — one HIGH, and the end of a thread that ran through
three passes.

- **US1's narrative and its criteria described two different developers** (H1). The narrative is a
  host integrator; the criteria assume somebody who can land a change to `@cuestack/schema`. That
  package is published with no catchall in the element union, so the integrator completes three pieces
  and is then blocked by a package they consume. Added FR-002b, US1 scenarios 1b and a qualifier on 1,
  the guide contract's §2b, and a change to T043: ask the tester which reader they are, because an
  in-repo contributor would not notice the wall.

**On the shape of these findings.** Passes 6, 7, and 8 were one thread, not three questions: the
closed element union implied more each time it was looked at — first that a type needs four pieces,
then that the fourth cannot be demonstrated, then that for the story's own audience it cannot be made
at all. A finding is not finished when it is recorded; it is finished when nothing further follows
from it.

Two LOW findings left open: SC-002 verifies the guide's *example* covers every contract member rather
than the guide's *list*, and `packages/element/src` is absent from the coverage `include` — neither
floored nor reported, which is a third state nobody chose.

One boundary worth keeping visibleOne boundary worth keeping visible through planning: a kernel change this feature turns out to need is
a **finding to report**, not a licence to reshape the core. The point of a second adapter is to press
on the kernel until something gives, and the pressing is the deliverable.
