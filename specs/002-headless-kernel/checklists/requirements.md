# Specification Quality Checklist: Headless Kernel

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-14
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

**Iteration 1 — 7 failures found and fixed.** FR-008 (the eight effects), FR-010 (deterministic
ordering), FR-011 (independent effect contribution), FR-012 (motion identifiable for reduced-
motion substitution), FR-014's restart operation, FR-023 (unsatisfiable advance rule reported),
and FR-024 (test override not reachable in playback) had no acceptance scenario or success
criterion tracing to them. Resolved by adding US1 scenarios 7–9, US2 scenarios 7–8, US3 scenario
6, and SC-011/SC-012. All 35 functional requirements now trace to at least one scenario or
measurable outcome.

**Iteration 2 — all items pass.** 35 FRs · 12 SCs · 32 acceptance scenarios · 5 user stories.

**On "written for non-technical stakeholders":** the same standing caveat as feature 001, one
degree weaker. This wave still ships nothing anyone can look at, but its subject matter is
learner-visible behaviour rather than build tooling — when a slide advances, whether a pause
holds, whether seeking lands where the learner expects. A non-technical reader can evaluate
those claims even though they cannot yet see them demonstrated. Requirements are free of
framework and language names; the settled technical choices live in Assumptions.

**Assumptions carrying the most risk, in order:**

1. **Media is observed, not driven.** The kernel learns media position through an injected port
   rather than touching a media element. If media-gated advancement later needs to *seek* media
   rather than merely watch it, that port grows from one direction to two, and Wave 3's media
   work is where that would surface.
2. **Reduced motion is the consumer's decision.** The kernel says which effects are motion; the
   adapter decides whether to substitute. This is right for SSR — the preference cannot be read
   on a server — but it means the kernel cannot guarantee compliance on its own, and
   NFR-ACC-004 conformance therefore depends on Wave 2/3 honouring it.
3. **Lesson definitions arriving here are already valid.** The kernel is not a second
   validator. If a host bypasses `@cuestack/schema` and hands the kernel a malformed manifest,
   behaviour is undefined by design. Worth confirming that is acceptable before implementation
   rather than after.
