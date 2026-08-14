# Phase 0 Research: Headless Kernel

**Date**: 2026-08-14 · **Feature**: `002-headless-kernel`

No new dependencies are introduced by this feature, so there are no versions to verify. Every
decision below is a design choice about shape, and each is recorded with what it buys and what
it forecloses.

---

## R-01: `resolve()` is a fold, not a state machine

**Decision**: `resolve(slide, timeMs) -> RenderState` evaluates every effect active at `timeMs`
and composes their contributions. It holds no state between calls and takes no previous state
as input.

**Rationale**: Four spec requirements collapse into one property. FR-002 (pure), FR-003 (no
browser), FR-004 (seek recomputes rather than replays), and SC-002 (playing to *t* equals
seeking to *t*) are all consequences of the resolver having nothing to remember. A state machine
satisfying them would need a proof that its accumulated state is a function of time alone —
which is the same thing, arrived at expensively.

The seek case is where the alternative fails concretely. A state machine seeking from 8000 ms
back to 1000 ms must either replay forward from zero (slow, and spec §30.5 forbids it) or invert
its transitions (only sometimes possible). A fold has no such case: 1000 ms is just an argument.

**Alternatives considered**:
- *Incremental state machine advanced per frame* — the conventional animation-runtime shape, and
  the reason most timeline tools cannot seek accurately. Rejected on §30.5.
- *Memoised fold keyed on time* — a later optimisation if SC-001 is threatened, and safe
  precisely because the fold is pure. Not now; unmeasured caching is a guess.

---

## R-02: Effect contributions compose associatively

**Decision**: An effect at progress *p* yields a partial contribution — an opacity multiplier, a
transform delta, a filter delta. Contributions combine by multiplying opacities and summing
transform deltas, so composition is associative and commutative within a phase.

**Rationale**: This makes FR-010's deterministic ordering a safety net rather than the only
thing preventing a slide from looking different on a second viewing. Two independently correct
orderings produce identical output, so an ordering bug cannot manifest as a visual difference.

It also makes FR-011 (each effect computable independently of the others) true by construction,
which is what allows the eight built-in effects to be eight small pure functions with no
knowledge of each other — the precondition for a ninth arriving as a registration.

The cost is that genuinely non-commutative effects — a rotate-then-translate that differs from
translate-then-rotate — cannot be expressed as bare deltas. The MVP set contains none. When one
arrives it will need an explicit ordered transform list, and FR-010 is why the ordering
information will still be there to use.

**Alternatives considered**:
- *Last-writer-wins per property* — simpler, but two overlapping fades would produce a jump as
  one effect's value replaced the other's rather than blending.
- *An ordered transform list from the start* — more general, and correct for a case we do not
  have. It would make every effect aware of its position in a sequence to serve a requirement
  nobody has asked for.

---

## R-03: The clock is injected, and per-tick deltas are clamped

**Decision**: The kernel never reads a clock. A `TimeSource` — a function returning monotonic
milliseconds — is supplied at construction. Real playback passes the browser's high-resolution
source; tests pass a hand-advanced counter. Every tick clamps its delta to a ceiling
(250 ms default); a larger delta is treated as elapsed real-world time that did not happen in
the lesson.

**Rationale**: Injection is Constitution II's requirement and SC-006's mechanism — a suite that
waits in real time cannot run in five seconds, and one that flakes gets muted.

The clamp answers FR-017 without depending on platform behaviour we cannot verify from here.
Whether a given browser's monotonic source keeps advancing while the machine sleeps varies, and
the same enormous delta is also produced by a blocked main thread or a debugger pause. All three
should have the same effect on lesson time — none of it happened to the learner — so the clamp
handles them uniformly and the platform question becomes moot rather than researched.

Tests use a hand-written counter rather than Vitest's fake timers. A test whose subject is
"does our clock behave correctly" should not be mediated by another timer implementation whose
own semantics it would then also be asserting.

**Alternatives considered**:
- *Read the browser source directly, inject only in tests* — makes production and test paths
  structurally different, so the tested path is not the shipped one.
- *Detect sleep by comparing a monotonic source against wall-clock time* — more precise about
  *why* the gap occurred, and the extra information changes no decision.

---

## R-04: Media is observed through a port, not driven

**Decision**: A `MediaPort` reports position, duration, and ended-state for a media element id.
The kernel reads it; it never writes.

**Rationale**: The kernel cannot touch a media element and stay headless. Read-only keeps the
port one-directional, which keeps the kernel's role clear: it decides *what media position
means* for advancement, while the adapter decides *how position is learned*.

FR-021's requirement — a paused video postpones advancement rather than cancelling it — falls
out of this naturally: pausing changes what the port reports, and the controller re-evaluates.
No cancellation state is needed.

**Known limitation, recorded before it bites**: if Wave 3 needs media-gated advancement to
*seek* media (scrubbing the timeline dragging the video with it), the port becomes
bidirectional. That is a genuine design change, not an extension, and the checklist for this
feature already flags it as the highest-risk assumption. Wave 3's media work is where it
surfaces.

**Alternatives considered**:
- *Kernel owns media elements* — impossible while headless.
- *Bidirectional port now* — designing for a requirement Wave 3 may not have, at the cost of a
  more complex contract every adapter must implement.

---

## R-05: One advance decision per slide instance, enforced by identity

**Decision**: The controller keys its single-fire guard on a slide *instance* identity — the
slide id paired with a monotonically increasing visit counter — not on the slide id alone.

**Rationale**: FR-019 requires at most one advance per instance; FR-022 requires late signals to
be ignored. Keying on slide id alone would break the legitimate case of a learner navigating
backward and replaying a slide, which must be able to advance again. Keying on instance makes
"already advanced" and "a fresh visit" distinguishable without the controller tracking history.

The exhaustive combination sweep in SC-005 exists because this is the requirement most likely to
be satisfied for the cases someone thought of and violated by the one they did not — three
conditions firing in the same tick is not a scenario anyone writes by hand.

**Alternatives considered**:
- *Debounce by time window* — would suppress a genuine second advance after a backward
  navigation, and picking the window would be arbitrary.
- *Idempotent advance at the player level* — pushes a kernel invariant into every consumer, so
  each adapter would have to re-derive it.

---

## R-06: Registries are typed maps, and switching on type is lint-forbidden

**Decision**: Element and effect types live in registries keyed by type string. A new ESLint
rule forbids `switch` on `element.type` or `effect.type` outside a registry module.

**Rationale**: Constitution I states the rule; feature 001 taught us what happens when a
boundary rule is stated but not mechanically enforced — the core/UI dependency-cruiser rule was
green while enforcing nothing. A `switch` on element type is the exact shape the principle
forbids, it is easy to write when in a hurry, and it is invisible in review once the file is long
enough. A lint rule is cheap and catches it at authoring time.

FR-026's completeness requirement is enforced at the type level: `ElementPlugin` requires all
five members, so a partial registration does not compile. The runtime check exists too, for
plugins arriving as untyped data.

**Alternatives considered**:
- *Convention plus review* — feature 001's evidence is against it.
- *Runtime-only validation* — catches it, but a day later and with a worse message than the
  compiler's.

---

## R-07: Unknown types degrade by criticality, not uniformly

**Decision**: An unregistered element type resolves to a placeholder marked unavailable and the
rest of the slide resolves normally (FR-027). An unregistered *required interaction* type
produces a blocking problem (FR-028).

**Rationale**: The asymmetry is the whole point and comes from the spec: a decorative element
that fails to render costs the learner some content, while a silently-skipped question that
gates progression strands them on a slide with no way forward. The failure modes are not
comparable, so the responses should not be either.

**Alternatives considered**:
- *Fail the slide on any unknown type* — makes every lesson hostage to its least important
  element and forecloses graceful forward compatibility.
- *Skip everything unknown silently* — produces the stranding case.

---

## R-08: Adapter saves carry an opaque version token

**Decision**: `StorageAdapter.saveDraft` takes an opaque token from the previous load and may
reject with a conflict. The kernel treats the token as a value it does not interpret.

**Rationale**: FR-031's "never silently overwrite a newer version" is a property of the
*interface*, not of any implementation. Putting the token in the signature makes it impossible
for a host to accidentally implement last-writer-wins, because there is nowhere to put the
token that isn't the conflict check. Leaving it out would make the guarantee a hope about
somebody else's endpoint.

Opaque because an ETag, a row version, a vector clock, and a content hash are all valid and the
kernel has no reason to prefer one.

**Alternatives considered**:
- *Timestamps* — requires synchronised clocks and invites the determinism problem this codebase
  bans elsewhere.
- *Full manifest comparison to detect conflict* — expensive, and cannot distinguish "changed by
  someone else" from "changed by me in another tab".

---

## R-09: Effects declare whether they are motion

**Decision**: Each effect descriptor carries a `motion: boolean`. The kernel exposes it and
takes no action on it.

**Rationale**: NFR-ACC-004 requires reduced-motion to be honoured, and BR-015 requires
non-essential movement to be replaced. Neither can happen here: the preference cannot be read on
a server, and the substitution mechanism is a stylesheet. What the kernel *can* do is remove the
need for Wave 2 to keep its own list of which effects move — a list that would silently rot the
first time a ninth effect is registered.

**Consequence to state plainly**: the kernel cannot guarantee reduced-motion compliance. It
supplies the fact; Wave 2 and Wave 3 must act on it, and the accessibility gate that arms in
Wave 2 is what will check that they did.

---

## Resolved unknowns

Every Technical Context item is settled above. Two decisions are inherited rather than
re-litigated:

- **Toolchain** — TypeScript 6.0.3 and the rest, per feature 001 research R-01. The TS 7
  re-open trigger is unchanged and still unmet.
- **DOM over canvas** — settled in the framework plan. This feature touches no renderer, but the
  headless requirement it enforces is what keeps the choice viable.
