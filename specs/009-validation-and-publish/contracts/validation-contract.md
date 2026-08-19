# Contract: what the validation engine promises, and what it delegates

The engine's most important property is what it does **not** do. This repository already contains
three validators, two of which overlap, and the way this feature fails is by becoming the fourth.

---

## 1. The line between the two validators

There are now two things a caller can ask about a lesson, and they are not the same question.

| Ask | Answers | When |
|---|---|---|
| `validate` — `@cuestack/schema` | **Is this structurally a lesson?** Types, required fields, integer milliseconds, duplicate ids, references that point at something | Any time a manifest is loaded, saved, or edited |
| `checkLesson` — `@cuestack/core` | **Is this a lesson worth giving to a learner?** Dead ends, unreachable slides, missing alt text, elements outside their slide | Before publishing, and on request while editing |

**The test for which side a new rule belongs on**: could a well-formed lesson fail it? If yes, it is
semantic and belongs here. If a manifest failing it could not be loaded at all, it is structural and
belongs in the schema.

`checkLesson` runs the schema validator first and includes its issues, always as errors. A lesson the
format rejects is not publishable regardless of anybody's policy, and a report that omitted the
reason would send an author looking for a semantic problem that is not there.

---

## 2. What it composes

Four sources, none of them new except the last:

| Source | Already existed | Reports |
|---|---|---|
| `validate` (schema) | since Wave 0 | Structure and references |
| `checkReachability` (core) | since Wave 1 | A slide whose advance rule can never be satisfied |
| `collectProblems` (core) | since Wave 1 | An element outside its slide |
| `ElementPlugin.validate` | declared Wave 1, **never called and never implemented** | Whatever a type says about its own payload |

**This feature supplies the producers as well as the consumer.** There were no concrete
`ElementPlugin` implementations in the shipped framework — the seven MVP types carried a renderer and
an editor and no core plugin — so the seam was real and empty. The seven arrive here, with an inert
`resolve` so nothing about playback changes, and each `validate` covering only what the format does
not already reject (research R-12, FR-006a–c).

**What each source can emit is listed in full** in [data-model.md §3](../data-model.md). Two of those
codes — `UNKNOWN_ELEMENT_TYPE` and `UNKNOWN_EFFECT_TYPE` — are declared by *both* the schema and the
resolver, meaning different things at the two tiers, which is why every issue carries a `source`.

**A plugin's codes are its own.** `PluginIssue` is `{ code: string; message: string }`, and the
`string` is deliberate: an element type reports faults core has never heard of. They arrive under
`source: 'plugin'`, default to `error`, and a host may lower any of them by name. The engine supplies
their `path` and `location`, because a plugin sees a payload and cannot know which element it is.

**Accessibility metadata is the engine's own rule**, not a plugin's. `accessibility` sits beside
`payload` rather than inside it, so `validate(payload)` cannot see it — and BR-012's policy-governed
rule should have one implementation rather than one per plugin author (research R-10).

`ElementPlugin.validate` getting its first consumer is the ninth instance of the pattern this project
keeps naming. Its own header states the stake: "one missing `validate` passes publication checks it
should fail" — which has been true since Wave 1, because there were no publication checks.

**The one rule the engine owns** is the static dead end, and even that is delegated: `isDeadEnd` goes
in `interactions/policy.ts` beside the `isUnsatisfiable` it mirrors, because they are one rule asked
at two moments and separating them is how they come to disagree.

---

## 3. What the engine promises

1. **Pure.** No clock, no network, no DOM. Inputs are a manifest, a plugin registry, and a policy.
2. **Deterministic.** The same inputs produce the same issues in the same order, every time. Slides
   in document order, elements within a slide in document order, sources in a fixed order.
3. **Complete in one pass.** Every issue, not the first (FR-001). An author who fixes one problem and
   discovers a second is an author who stops trusting the report.

   **One exception, stated rather than hidden.** `checkReachability` answers with at most one problem
   per slide, so a slide with two advance faults reports the first. The conditions are mutually
   exclusive in practice — a slide advances on media *or* on an interaction — and reaching past that
   wrapper would give the engine its own copy of the advance rules, which is the failure §2 is
   arranged to prevent (research R-11).
4. **No branch on element type.** Type-specific knowledge comes from the registry. SC-001 measures
   this, and Constitution I calls the alternative a defect.
5. **Non-destructive.** The manifest is not modified, and the report holds no reference that would
   let a caller modify it by accident.
6. **Survivable.** A plugin whose `validate` throws produces one `PLUGIN_VALIDATE_FAILED` against
   that element, and every other issue is still reported.

7. **Message quality.** Every message names the problem, the object it concerns, and what to do about
   it (FR-004, NFR-USA-004). A code is not a message: "ELEMENT_BEYOND_SLIDE" tells an author nothing
   they can act on, and the existing sources already write full sentences — the engine must not
   degrade them on the way through.

**What it does not promise**: that a lesson is good. It reports what can be checked mechanically, and
a lesson can pass entirely and still be a bad lesson.

---

## 4. Severity, and what a policy may do

```text
severityFor(code, source, policy) -> 'error' | 'warning'
```

- Every code has an inherent severity, listed in [data-model.md §3](../data-model.md).
- A **policy-governed** code may be raised to `error` or lowered to `warning` by the host.
- **Plugin codes default to `error` and are always governable**, because core cannot judge a code it
  has never seen — but a plugin reporting a fault in its own payload is reporting something it
  believes makes the element wrong, so blocking is the honest default.
- No code may be silenced. There is no `off` (FR-010b).
- Schema issues are always errors and are never policy-governed.

Accessibility metadata is the policy-governed case BR-012 exists for, defaulting to `warning`. The
reasoning is in the spec's Assumptions, and the short version is that an `error` default refuses
lessons most organisations publish daily, which teaches people to route around the gate — and a gate
people route around protects nothing.

---

## 5. The asset pass, which is separate and optional

```text
collectAssetRefs(manifest) -> readonly AssetRef[]      // pure, shared
checkAssets(refs, assets)  -> Promise<Issue[]>         // async, optional
```

Which assets a lesson references is a fact about the manifest. Whether they exist is a question for
the outside world, and only the second needs to wait — so the first is pure and shared, and the
second is a pass a caller may skip entirely and still get every other issue (FR-016a).

**Both the warning pass and the publish check use `collectAssetRefs`.** FR-016b: "One rule reported
at two strengths is a courtesy; two rules disagreeing about which assets a lesson uses is a defect."
A separate walk in the publish path is exactly how a report comes to say a lesson is fine while
publishing refuses it for an asset the report never looked at.

**The publish check does not reuse the report's answer.** The answer's ability to change between the
two moments is the entire reason there are two, and BR-018 is about what the *published package*
references.

---

## 6. Jump to source

`IssueLocation` carries the slide id and, where there is one, the element id. That is all FR-005
needs: the editor goes to the slide and selects the element, using the same `goToSlide` and `select`
every other surface uses.

An issue with no element — a slide's advance rule, a lesson with no slides — navigates to the slide
alone rather than selecting something arbitrary. Selecting the first element to have something
selected would point a teacher at the wrong thing, confidently.

---

## 7. What this contract does not cover

- **Fixing anything.** The engine reports; it never edits. An offered action that repairs a lesson is
  a separate idea, and feature 006's "extend to fit" is the precedent for how one would be built.
- **Blocking a save.** Only publication is gated. A draft may be as broken as an author needs it to
  be while they work.
- **Ordering by importance.** Document order, not severity order. A report that reordered itself as
  an author fixed things would move the item they were about to click.
