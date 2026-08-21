# Research: The Authoring Guide and the Second Adapter

Phase 0. Checked against the code rather than recalled, and where checking changed the answer that is
said plainly.

---

## R-01: The headline finding — the kernel is not React-shaped, but the *packaging* is

**What was checked.** Every module in `packages/react/src` that a second adapter would need, tested
for whether it actually imports React.

| Module | Lines | Imports React? | What it does |
|---|---|---|---|
| `frame/properties.ts` | 56 | **no** | Every `--cs-*` custom property name, declared once |
| `frame/applyVisual.ts` | 93 | **no** | A `RenderState` → style values |
| `theme/tokens.ts` | 55 | **no** | Theme values → stage properties, canvas sizing |
| `frame/FrameWriter.ts` | 136 | **no** | Applies those to an `HTMLElement` |
| `player/browserPorts.ts` | — | **no** | The browser's clock and visibility |
| `player/browserTiming.ts` | — | **no** | Scheduler and connectivity |
| `elements/assets.ts` | — | **no** | Asset id → address |
| `player/problems.ts` | — | **no** | Playback problems → something a learner reads |

**Eight modules, none of which needs React, all of which live in the React package** — because React
was the only consumer and there was no reason to put them anywhere else.

**This is DX-2's deliverable**, and it arrived before a line of the adapter was written. The kernel
survives the test: `resolve`, `createClock`, `createTransport`, and the effect implementations are
genuinely framework-agnostic. What does not survive is the assumption that everything DOM-shaped
belongs to React.

**Decision: the adapter writes its own small DOM layer, and the extraction is recorded rather than
performed.** Three routes were available and two are worse:

- *Depend on `@cuestack/react`.* React is a peer dependency there, so nothing would install React —
  but a web-component adapter declaring a dependency on the React adapter is absurd on its face and
  would fail FR-013's structural assertion immediately.
- *Move the pure modules into `@cuestack/core`.* They would pass `headless.test.ts` — `properties.ts`
  is string constants and `applyVisual.ts` returns a record — so this is genuinely possible and is
  probably the right long-term answer. It is also a change to two shipped packages' public surfaces,
  and the spec's Assumptions say a kernel change this feature turns out to need is **a finding to
  report, not a licence to reshape the core**. Recorded as a recommendation for its own feature.
- *A sixth package.* A `@cuestack/dom` for eight files, decided in passing, inside a feature about
  documentation.

**What the duplication actually costs, measured rather than feared.** A proof-scoped adapter needs
geometry, opacity, and transform — not the whole visual vocabulary and not the theme token mapping
beyond canvas sizing. That is roughly forty lines, bounded by FR-010's scope.

**And it makes the agreement suite mean something.** If both adapters shared the style computation,
SC-005 would compare a helper against itself and prove nothing about the kernel. Two independent DOM
layers over one kernel is what makes agreement evidence.

---

## R-02: Shadow DOM, and why

**Decision.** An open shadow root per instance.

**Rationale.** SC-010 requires several instances on one page not to interfere, and FR-016 says nothing
shared between them may be global. A shadow root gives that structurally rather than by naming
discipline — styles cannot leak in or out, and two lessons cannot collide over an id.

**The theme still reaches through, which is why this is affordable.** CSS custom properties inherit
across a shadow boundary. `--cs-*` set on a host element applies inside, so the theming contract the
React player uses works unchanged; only the stylesheet has to live inside the root.

**Open rather than closed.** A closed root is unreachable from tests and from a host debugging its own
page, and the isolation it adds over an open one is against the page's own author, who is not the
adversary here.

**Alternatives considered.** Light DOM with prefixed class names — cheaper, and it puts multi-instance
independence back on a naming convention that nothing enforces.

---

## R-03: What "the element types that need nothing from the host" actually means

**Decision.** `text` and `shape` render fully. `image` renders when the host supplies an asset
resolver and reports itself unavailable otherwise. `video`, `audio`, `button`, and `question` are out
of scope and report themselves unavailable.

**Rationale, per type rather than as a rule**, because the boundary is only defensible if it was drawn
by looking:

| Type | In? | Why |
|---|---|---|
| `text` | yes | Needs nothing but the payload |
| `shape` | yes | Same |
| `image` | conditionally | Needs an `assetId` → address function, which is a host capability the React adapter also requires |
| `video`, `audio` | no | Need the media ports, media-end advance, and playback synchronisation — the React adapter's hardest code, and the least likely to say anything about whether the kernel is React-shaped |
| `button` | no | `on_click` advance is unreachable in **both** adapters — the reference lesson's last slide uses it and the example ships a second lesson because of it. Implementing it here would be building a capability the primary adapter lacks |
| `question` | no | Needs interaction state, gating, and attempt policy. Out by FR-010 |

**`button` is worth noting**, because it is out of scope for a reason that is not this feature's:
navigation buttons render their action and do not act, awaiting the delegation seam. A second adapter
implementing it would put the two adapters out of step in the *opposite* direction.

---

## R-04: How an unavailable type is reported

**Decision.** Reuse the React adapter's answer rather than inventing one: the element occupies its
geometry and says it is unavailable, the way `Placeholder` does for an unknown type.

**Rationale.** FR-014 requires it, and with a subset adapter this is the **ordinary** path rather than
the edge one — four of seven types take it. Inventing a second vocabulary for "this cannot be shown"
would mean a learner meeting two different apologies depending on which adapter their school runs.

**The slide-gating case is the sharp one.** A slide with `after_interaction` advance whose question
this adapter cannot render can never be left. `checkReachability` already reports exactly this
condition, and `resolve` already returns `blockingUnknownRequired` — so the adapter reports it and
does not strand anybody, using machinery that exists (US2 scenario 4).

---

## R-05: The frame loop, and what the adapter owns

**Decision.** The adapter owns a `requestAnimationFrame` loop and a `FrameWriter`-shaped applier of
about forty lines. Everything else comes from core: `createClock`, `createTransport`, `resolve`.

**Rationale.** `useFrameLoop` is the only genuinely React-shaped piece in the player, and it is
fifty-two lines of `useEffect` around a rAF loop. A custom element does the same thing in
`connectedCallback`/`disconnectedCallback`, which is the platform's own version of the same lifecycle.

**The clamp matters and is not the adapter's.** `CLAMP_CEILING_MS` lives in core's clock: machine
sleep and a paused debugger produce enormous deltas and none of them happened to the learner. An
adapter that wrote its own clock would lose that, which is precisely the sort of divergence FR-009
forbids.

---

## R-06: Testing a custom element

**Decision.** happy-dom, in a new vitest project, using the platform APIs directly.

**Checked rather than assumed**: happy-dom defines `customElements`, attaches open shadow roots, and
provides `requestAnimationFrame`. A probe confirmed all three before this was written down.

**No DOM testing library.** `@testing-library/react` is React's; the platform's own API — create the
element, append it, read `shadowRoot` — is both sufficient and more honest for a package whose entire
claim is that it needs no framework.

**Time is injected, as everywhere else.** Constitution II forbids a timing test that waits, and the
transport takes its clock as a port precisely so it never has to.

---

## R-07: The agreement suite, and how a non-blocking suite exists in a repo where tests block

**Decision.** A suite under `gates/` that runs, reports, and exits zero — the same shape as the
existing gates, reporting rather than asserting.

**The problem this solves.** `pnpm test` is a blocking CI gate, so any test inside it blocks by
definition. FR-011 asks for agreement to be visible without blocking, which means it cannot be an
ordinary test file.

**How it reports.** It resolves the same manifest through both adapters at the same instants and
prints what differs — slide, element, and the properties whose values disagree. A difference is
information, not a failure.

**What it compares.** `RenderState` at matched times, and the geometry and opacity each adapter
actually writes. Not the DOM structure: two adapters produce different trees by design, and comparing
them would fail on the first `<div>`.

**The tension with Constitution V is real and is not a violation.** Preview-versus-playback parity is
gated because both are the *same* renderer, and a difference there is a bug. Two adapters are two
renderers over one kernel; agreement is the goal and divergence is a finding. The spec states this at
FR-011a, and states the condition under which the decision expires: if the adapter grows toward full
coverage, gating becomes the right answer.

---

## R-08: Keeping the guide from rotting

**Decision.** The guide's example element type is a real, registered type in
`packages/core/test/...`-adjacent fixtures, exercised by a suite. The guide contains **no code block
that is not extracted from that source**, and a check compares the two.

**Mechanism.** Fenced blocks in the guide carry a marker naming a source file and region; a script
reads the file, extracts the region, and compares. A mismatch fails the build.

**Why a script rather than review.** `ElementEditor`'s header currently explains that "the seven
built-in types have no `ElementPlugin`" and that "core's plugin registry is empty by default". Feature
009 made both false. Two features have shipped since. Nobody noticed — and the audience for a guide is
by definition the people who cannot tell it is wrong.

**The example supplies the whole contract** (FR-006b). Constitution I rejects partial plugins, so an
example omitting a member would teach an author to write something the framework refuses at
registration.

**Alternatives considered.** Doc-tests that execute fenced blocks — more machinery, and the blocks
here are declarations rather than assertions. Generating the guide from source — the reasoning is the
half that matters and cannot be generated.

---

## R-09: What else the documentation has to correct

**Decision.** Fix what is provably false, list what is merely dated.

**Found so far**, and the count is expected to grow while the guide is written:

- `ElementEditor`'s header in `@cuestack/studio` — states built-in types have no `ElementPlugin` and
  that core's registry is empty by default. Feature 009 falsified both.
- `packages/element/src/index.ts` — "Empty in Wave 0. Wave 5 uses this to prove the kernel is
  genuinely framework-agnostic." Correct, and about to become the thing it describes.

**The guide is written last, not first.** Writing it is the mechanism that finds the rest: a claim only
turns out to be false when somebody tries to state it precisely.

---

## R-11: What React was doing that nobody had to write down

**Decision.** Author-supplied content reaches the DOM through `textContent` and attribute assignment.
`innerHTML`, `outerHTML`, and `insertAdjacentHTML` are banned in `packages/element/src` by a lint rule,
and the protection is asserted by a test rather than trusted.

**How this was found, because the method matters more than the finding.** Four analysis passes checked
requirements against tasks and missed it, because **NFR-SEC-007 is not a requirement in this spec** —
it is a constitution constraint that the React adapter satisfies structurally. It surfaced only from
asking what `NO_INNER_HTML` actually bans: `JSXAttribute[name.name='dangerouslySetInnerHTML']` and
`Property[key.name='dangerouslySetInnerHTML']`. Both are JSX. Its own message explains the reasoning —
"author-supplied text reaches the page as a React child, which escapes it" — and a custom element has
no React child.

**So the protection was never a rule anybody wrote; it was a property of the renderer.** Removing the
renderer removes it silently, and nothing in a requirements-to-tasks matrix would show that.

**This is likely not the only one.** The premise of DX-2 is that nobody has examined what the primary
adapter provides structurally rather than deliberately. Escaping is the clearest case; anything else
found belongs beside the kernel findings in T040.

**Alternatives considered.** A sanitizer — rejected: this framework renders text, not rich markup, so
there is nothing to sanitize *into*; escaping by construction is both stronger and smaller. Trusting
the manifest — rejected: feature 010 established that the format permits a `javascript:` address
today, so hostile content in a lesson is a live concern in this project rather than a hypothetical.

---

## R-12: Reduced motion, and the shape this keeps taking

**Decision.** `frame.ts` emits the reduced property set alongside the ordinary one; `styles.ts` carries
a `@media (prefers-reduced-motion: reduce)` block with the nested fallbacks `stage.css` uses.

**Why it must be CSS.** `stage.css`'s own header settles it: "the preference cannot be read on a
server, so a script would have to defer the choice to hydration and a learner who asked for less
motion would see the full motion first. CSS chooses at paint time, which means both answers have to
already be in the markup — and they are, because the resolver emits both."

**Why it was nearly lost.** The adapter's frame layer was scoped to "geometry, opacity, transform, not
the whole visual vocabulary" — a reasonable-sounding simplification that happens to exclude the
mirrored `--cs-r-*` names. Half a mechanism is not half honoured; it is not honoured, because the
media block would have nothing to select.

**This is the second finding of the same shape**, after escaping (R-11), and the pair is the more
useful output than either alone: **React satisfies several constitutional requirements as properties
of how it works rather than as rules anybody wrote down.** Removing React removes them silently, and
no requirements-to-tasks check can see it — the requirement is covered, the task exists, and the
mechanism the task inherits is gone. The way to find them is to ask what the primary adapter provides
structurally, and then look at how.

**What the pair suggests is exhausted.** React's structural contributions to a *learner-facing* surface
are escaping, reduced motion, and the ARIA on components this adapter does not have — progress, the
gesture prompt, the controls. The first two are now requirements; the third does not apply. T040
should record any further instance found while building, because the list is the deliverable.

---

## R-13: A third-party element type is four pieces, not three

**Decision.** The guide teaches four contributions across four packages, and marks the fourth as a
*format* change rather than a registration: an additive variant in `@cuestack/schema`'s element union,
plus a migration and a `schemaVersion` bump.

**What made this necessary.** `element.ts` declares `z.discriminatedUnion('type', variants)` over seven
literals. A manifest naming any other type is refused by `validate` — so a plugin, a renderer, and an
editor registration produce a type that registers, renders, and appears in the Add menu, and then
**cannot be saved**. It fails last, after the most work, for a reason none of the earlier failures
hints at.

**The project already knew and had not written it where an author would look.** `plugins.ts:21` says
it exactly: "a registered but unversioned type cannot appear in a schema-valid manifest — by design.
Adding an element or effect type is an additive MINOR schema change with a migration." That comment is
in a test harness.

**SC-001 had promised the stronger thing.** "No change to any existing package" is not Goal 5; Goal 5
is that new types are addable "without rewriting the canvas, timeline, or player" — the **kernel**
needs nothing, which remains true and is the claim worth making. The success criterion overreached it
into something the closed union makes false, and a guide written to it would have sent a developer
through three packages to a validation error they could not fix from outside.

**What this costs the guide, and it is a real cost.** The example can demonstrate three pieces and
only describe the fourth. Demonstrating it means adding a variant to the published element union —
`elementSchema` is a fixed const with no extension point — which `check:migrations` watches, so it
would arrive with a migration step and a `schemaVersion` bump. **A documentation example would be
shipping an invented element type in the lesson format.** The guide therefore says what the change
looks like rather than performing one, and says that it is doing so.

Two facts the prose has to supply because nothing in the repository demonstrates them: an additive
variant transforms nothing, so its migration's `up` returns its input unchanged; and it still needs a
registered step, because the chain must reach the current version unbroken. The only two steps that
exist are a field rename and a terminal no-op.

**And the part that only became visible on the fourth look at this: the fourth piece is not the
reader's to make.** `@cuestack/schema` is published (`publishConfig: { access: 'public' }`) with no
catchall in the element union, so a host integrator — the developer US1's own opening describes, with
"a diagram their institution already renders" — consumes the package that holds the union. They can
register a plugin, a renderer, and an editor entry; they cannot make a lesson that saves. Upstream
change or fork, and a fork's lessons fail validation everywhere else.

The product spec anticipated this and the implementation split it. FR-FWK-002 says a plugin "shall
define its **data schema**, editor component, player renderer, inspector configuration, and
validator" — five things. What shipped is a payload guard on the plugin, which an author can supply,
and a union variant in the format, which they cannot. The guide's job is to say which is which.

**Alternatives considered.** An open union with a passthrough for unknown types — rejected, and not
this feature's to propose: the closed union is what makes a manifest's meaning knowable from its
version, and feature 009's registry cliff already showed what "unknown type" costs at the other end.
Teaching the three registrations and omitting the fourth — rejected: it is the difference between a
guide and a trap.

---

## R-10: What this feature does *not* do

- **No kernel change.** Findings are recorded; R-01's extraction is proposed for its own feature.
- **No media, no interactions** in the second adapter (FR-010).
- **No server rendering** from the second adapter — a custom element cannot, and FR-017 requires that
  said rather than discovered.
- **No documentation site.** Markdown in the repository; there is no site infrastructure and shipping
  one is not this feature's job.
- **No third adapter.** The plan already defers Vue and Svelte on the grounds that a third proves
  nothing DX-2 does not.
