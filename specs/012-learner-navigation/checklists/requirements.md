# Specification Quality Checklist: A learner can move through a lesson

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-21
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs)
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness

- [X] No [NEEDS CLARIFICATION] markers remain
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic (no implementation details)
- [X] All acceptance scenarios are defined
- [X] Edge cases are identified
- [X] Scope is clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Notes

**Re-validated after analysis (2026-08-21).** One CRITICAL finding, applied. Sixteen items still
pass; FR-003a was added and the plan's coverage table failed until it carried a row — which is
`plan-coverage.test.ts` doing the job it was written for after feature 011 lost a MUST between its
contract and its task list.

**Sixth analysis pass (2026-08-21).** One MEDIUM, and the yield has clearly dropped — five passes
produced two CRITICAL and two HIGH between them; this one found a pre-existing gap in a test the
feature brushes against, not a hole in the design.

`public-surface.test.ts` checked that every *listed* name resolves and never that every *exported*
name is listed. Nine had accumulated on the unguarded side. It is now bidirectional, with constants
allowed for explicitly so it does not become the noisy rule rejected in feature 011.

That the design itself came back clean, after five consecutive passes each finding a hole in the
previous fix, reads as the rule finally being settled.

**Fifth analysis pass (2026-08-21).** One HIGH, and the first caused by a *fix's prose* rather
than its logic.

The previous pass replaced the mode-by-mode enumeration with a derivation and wrote "the kernel is
the thing being asked". The kernel could not be asked. The rule lives inside `evaluate`, which
records that a slide has decided — so a speculative call to compute availability consumes the
decision and the slide never advances. `evaluate`'s own doc says *"a query, not a command"*, true
of the transport and false of its own state. The conditions themselves live in `conditions.ts`,
which no adapter can import: core has a single entry point and re-exports only a type. So the
three available routes were: break the feature, reimplement a business rule in two adapters, or
add to core's public surface. FR-003d chose the third.

**Five passes, five holes, none a coding error.** Each was found by asking what the previous fix
created. The pattern worth carrying: a rule that says "ask X" is not finished until someone has
checked that X can be asked.

**Fourth analysis pass (2026-08-21).** One CRITICAL, and it changed how the rule is written
rather than what it says.

FR-003a's mode-by-mode enumeration declared `after_duration` safe for a direct `goToSlide`. It is
not: `controller.ts:107` refuses to leave *any* slide with an unanswered required question —
BR-005, a formal business rule with its own test, tracked by `check:rules`. The enumeration would
have shipped a Continue button that skips required questions on timed slides, and `check:rules`
would still have read 18 of 18, because BR-005's test exercises the kernel and the bypass is in
the adapter.

**Four passes, four holes in the same rule** — the gate bypass, the one-frame window, the
over-broad scope, and now a business rule never checked. Each was a case the enumeration did not
enumerate. FR-003a is now written as a *derivation* — available exactly when the lesson would let
the learner leave — with the two known conditions as illustration rather than as the rule. A
derivation cannot be wrong by omission in the way a list can.

D2 was found in the same reading: the web component's stranding check covers only
`after_interaction`, while BR-005 blocks every mode, so a timed slide carrying a required question
never advances there and nothing reports it. Shipped in feature 011.

**Third analysis pass (2026-08-21).** Two findings, and the first names a pattern.

FR-003a said *"a navigation control"* where it meant `next_slide` alone. Read literally it
disables Back and Replay on a gated slide — trapping a learner in front of a question with no way
to re-read what came before, which is worse than the failure the rule prevents. **That is the
third requirement in a row whose prose was broader than its design table**, after FR-003 being
unconditional and FR-003a's "until the gate is satisfied". Each time the tables were right and
the prose over-reached. FR-003c now states the complement explicitly rather than leaving it to be
inferred from a table's heading.

FR-011b was added: an author placing a `next_slide` control on a gated slide is warned it can
never be operated. Warning, not error — the slide is satisfiable through its gate. Without it,
this feature's own defect reappears one level up: a control that does nothing and nobody is told.

**Second analysis pass (2026-08-21).** One HIGH, and it was a defect in the *previous* pass's
remediation. FR-003a first said the control is unavailable "until the gate is satisfied" — and
that state is unreachable: `controller.ts` decides `after_interaction` on the first evaluation
where the interaction completes, so the slide leaves within a frame of the learner answering. A
control called available in that frame would be an available control that does nothing, which is
the original defect restored for 16ms. Keyed on the advance *mode* instead, which also removes the
capability's need to compute gate satisfaction at all. FR-003b was added alongside: availability
describes the lesson, not the editor's preview override.

Worth recording as a pattern rather than an incident: asking *what did the last fix create* is
what found it, and it is the second time in this project that question has caught a remediation
introducing its own hole.

**The first finding, because it is the kind that ships.** FR-003 said a `next_slide` button MUST perform
its action, unconditionally. The lesson format permits such a button on a slide declaring
`advance: { mode: 'after_interaction', interactionElementId: 'q1' }` — so the requirement as
written mandated carrying a learner past a required question. Nothing in the spec, plan, contract,
or task list had considered the third advance mode; the design settled two paths and stopped. It
surfaced from one grep for `after_interaction` across the artifacts.

**On "no implementation details".** The Context section names files, a function, and a test —
`ButtonElement.tsx`, `checkReachability`, and the test asserting `on_click` cannot be
unsatisfiable. That is deliberate and is evidence rather than design: the feature exists
because a defect is invisible from the outside, and a stakeholder asked to fund it is owed the
proof. No requirement or success criterion names a file, a framework, or an interface.

**FR-012 reads as a constraint on implementation and is not one.** It states a property the
framework already guarantees and that this feature must not trade away — a renderer cannot
reach the lesson. It is written as a requirement because the obvious way to make a button work
is to hand it the transport, and that would be a regression nobody would notice until a
third-party renderer broke.

**Two P1 stories, deliberately.** US1 is the reported defect; US2 is the one that strands
learners. They are separately shippable and neither subsumes the other: a button is one way to
ask to move on, and a slide with no button still needs one.

**One assumption worth re-reading at planning time.** The spec assumes `checkReachability`'s
current treatment of `on_click` will change. That is a rule the validation engine states
confidently today — "the two rules that cannot be unsatisfiable" — and FR-011 makes it
conditional. Changing a confident rule deserves the scrutiny a plan gives it.

**Re-validated after clarification (2026-08-21).** Four questions asked and answered; all
sixteen items still pass. Three of the four answers *narrowed* the spec rather than filling a
blank, which is worth noting because it means the original wording would have passed review and
shipped something looser:

- FR-006 said "a way forward"; it now says `next_slide` specifically, because a slide whose
  only control is Back is a dead end going forwards and the loose wording would have passed it.
- FR-013 said differences between adapters must "stay reported"; `button` now has to work in
  both, because its exclusion was justified by the very defect this feature removes.
- FR-007 covered announcement, which already worked. FR-007a is the half that did not: focus
  falls to the document body when the pressed control disappears.

One stale edge case was removed during integration — it described a learner meeting an
unavailable button in the web component, which answer 2 made impossible.
