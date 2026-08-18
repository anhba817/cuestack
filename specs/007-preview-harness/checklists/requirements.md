# Specification Quality Checklist: Preview Harness

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-18
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

**Status: 16 of 16 passing.** 28 functional requirements, 13 success criteria, 5 user stories,
12 edge cases, zero clarification markers.

## Clarifications resolved

Three questions on 2026-08-18. Requirement ids were renumbered as a result; the list is FR-001–
FR-028 and nothing referenced the old numbering yet.

1. **The progression override is one switch, not one skip per gate.** FR-017 through FR-020 make it
   a thing a teacher turns on and off, which lets *every* gate through while it is on. The deciding
   argument is the case FR-ADV-011 exists for: testing slide nine of a gated lesson would otherwise
   cost eight separate skips, and that is the friction that makes a feature go unused. The risk it
   introduces is real and is answered in the same breath — FR-019 requires the preview to say so
   **continuously**, because the longer a switch lasts the more likely a teacher is to forget they
   set it. FR-020 lets them turn it off and test the late slide under the lesson's real rules, which
   is the workflow the switch actually serves.
2. **Assets resolve exactly as they do for a learner.** FR-003 makes the preview inherit the
   host-supplied resolver, and a failing asset shows the player's own recoverable error state rather
   than a stand-in. Placeholders were the cheaper answer and would have made the preview unable to
   answer "does this slide look right", which is most of what a teacher opens it for — and worse,
   would make a broken asset look deliberate in preview and broken in production.
3. **Reaching the end shows the completion state, and the teacher closes the preview.** FR-015.
   Closing automatically would make the ending the one part of a lesson the preview refuses to show,
   and what a lesson says after its final slide is a thing teachers get wrong and cannot otherwise
   check.

### What the answers changed beyond those requirements

- **US4 was rewritten around a switch**, gaining scenarios for the second and third gated slide
  (each advancing without being asked again), for turning it off mid-preview, and for it being gone
  when the preview reopens.
- **US1 gained two scenarios** — the real asset fetched as the player would, and the failing asset
  showing the learner's error state.
- **US3 gained two** — the completion state, and restarting a finished preview.
- **Two edge cases added**: an asset that cannot be resolved, and a final slide that never ends
  because it waits for a click no player delivers. The second is the honest interaction between this
  feature's override and an obligation it does not discharge.
- **One success criterion added** (SC-013, the completion state) and **one sharpened**: SC-008 now
  requires a multiply-gated lesson to be testable with **one** action, which is the property the
  switch was chosen for and would otherwise have been untested.

## One contradiction found and fixed during validation

The first draft said two incompatible things about a slide that advances on a click. An edge case
promised "the preview must offer the click, since no player supported it until now", while the
obligations section said navigation buttons "render their action but do not act" and that this
feature *needs* them to. One of those had to give.

Resolved in favour of the smaller feature: making buttons act is a **player** capability and stays
out of scope; US4's override is what gets a teacher past such a slide, exactly as it does past a
media gate or a required question. FR-015 now names all three gate kinds, US4 gained a scenario for
the click case, and the obligation says plainly that this feature does not fix `on_click` — it
makes it survivable. That is a worse experience than a working button and a better one than a dead
end, and the spec now says which of the two it is.

Worth recording because the contradiction was invisible in either section alone. It only appeared
when the edge cases and the obligations were read against each other.

## Notes on borderline items

- **The Assumptions section names `LessonPlayerClient` and `onReady`.** Close to the "no
  implementation details" line, and deliberate: the assumption being recorded is that the *existing*
  player is reused wholesale rather than reimplemented, and that claim is not checkable without
  naming what would be reused. Features 005 and 006 recorded the same kind of assumption for the
  same reason. The requirements themselves name no module.
- **SC-001 says "render state".** That is the framework's own vocabulary rather than a technology,
  and the criterion is otherwise unfalsifiable: "the preview looks the same" is not measurable, and
  what parity actually means here is that one function returns equal values for both consumers.
- **SC-012 asserts the gate can fail.** Structural rather than user-facing, and here because the
  project has now been bitten twice by a gate that was green while enforcing nothing. A parity gate
  that has never been observed failing is not known to be a gate.

## Two questions deliberately *not* asked, because prior decisions settle them

- **Whether the preview is modal or lives beside the canvas.** FR-PLY-005 lists a *close* control,
  which only a modal preview needs, and §17.3 frames preview as a moment of checking rather than a
  continuous second view. A live side-by-side preview updating as the teacher types is a different
  and larger feature; it is recorded as out of scope rather than left open.
- **Whether a preview writes anything.** FR-PLY-016 forbids the player exposing authoring metadata,
  and Constitution V makes the manifest the single source of truth. A preview that could modify the
  draft would be a second editor. FR-022 states it rather than asking.

## Risks carried into planning

**The player's props are the seam, and they may not fit.** The spec assumes `LessonPlayerClient`
can be reused wholesale — it already takes a starting slide index and hands back the transport, so
a starting *moment* is a seek. If planning finds itself adding a preview-shaped prop to the player,
or forking a second player component, that is the drift signal. The same signal fired in feature
006 and the answer was one missing export, not a new module.

**The progression override has no obvious home.** The advance controller decides whether a slide may
advance; a preview needs to ask it to say yes anyway. Whether that is a controller option, a
transport call, or a wrapper is a real design question with three plausible answers. *Clarification
settled its shape — one switch for the preview — but not its home, which stays a planning question.*
The switch form makes it slightly easier: a single flag consulted for the preview's lifetime is a
smaller thing to thread than a per-gate permission.

**SC-003's 100 ms tolerance needs something to compare.** Preview and published playback are the
same engine, so the honest measurement is not a stopwatch but an equality — which is SC-001. If
planning finds itself building a timing harness to compare two clocks, the parity claim has been
misunderstood.
