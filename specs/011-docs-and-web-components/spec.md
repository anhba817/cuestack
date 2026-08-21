# Feature Specification: The Authoring Guide and the Second Adapter

**Feature Branch**: `011-docs-and-web-components`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "Complete DX1 and DX2"

Wave 5's last two items, and the two that close it:
[`docs/cuestack_framework_plan.md`](../../docs/cuestack_framework_plan.md)'s **DX-1** (documentation
and a plugin authoring guide) and **DX-2** (`@cuestack/element`, the web-component adapter).

They are specified together because each is the other's evidence. The guide claims a plugin author
can extend this framework without touching its internals; the second adapter is where that claim
either holds or visibly fails. And the plan says so plainly: DX-2 exists to prove "the core is
genuinely framework-agnostic rather than React-shaped."

Nobody has tested that. Ten features have been built by people who wrote the kernel, reading it as
they went. `@cuestack/element` has been a stub since Wave 0 — one exported constant and a comment
saying a later wave would fill it. This is that wave, and the interesting outcome is not the adapter:
it is the list of things the kernel turns out to assume about React that nobody noticed while React
was the only consumer. Every previous feature in this project has produced such a list. There is no
reason to expect this one not to.

It also settles a debt the documentation has already started accruing. `ElementEditor`'s header in
`@cuestack/studio` still explains that "the seven built-in types have no `ElementPlugin`" and that
"core's plugin registry is empty by default" — both true when written, both made false by feature
009, and both exactly the kind of thing a plugin author would read and believe. A guide assembled on
top of stale comments teaches the wrong framework.

## Clarifications

### Session 2026-08-20

- Q: How much of the player must the second adapter cover? → A: Proof-scoped. Playback, effects, transitions, and the element types that need no cooperation from the host. Media and interactions are deliberately absent and documented as absent. The item exists to prove the kernel is framework-agnostic, and a second full player is the most expensive way to learn that.
- Q: Is adapter-to-adapter agreement a merge gate, or a suite that can fail without blocking? → A: A suite. Divergence stays visible without making every future change to the primary adapter cost twice. The proof-scoped surface is small, which is what makes the weaker mechanism defensible here.
- Q: Can the authoring guide's examples rot? → A: No. The guide's element type is a real registered type exercised by the suite, and the guide quotes from it. `ElementEditor`'s header is the argument: it has described a state feature 009 falsified for two features running, and the person a stale guide misleads is by definition the one who cannot tell.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A developer adds an element type without reading the kernel (Priority: P1)

A developer wants a lesson to contain something this framework does not ship — a countdown timer, a
poll, a diagram their institution already renders. They read one guide, implement the pieces it names,
register them, and the type works: it authors on the canvas, plays for a learner, validates before
publishing, and appears in the inspector. They do not read the resolver, the timeline, or the player.

**Two developers are hiding in that paragraph, and the guide must tell them apart.** An in-repo
contributor can complete all four pieces. A host integrator — which is what "their institution already
renders" describes — consumes `@cuestack/schema` as a published package and cannot add a variant to
its element union, so they can complete three and are then blocked: the type registers, renders, and
appears in the Add menu, and no lesson using it can be saved. Their route is an upstream change or a
fork, and a fork's lessons fail validation everywhere else, which the portability this framework
promises makes more costly rather than less.

**Why this priority**: This is Goal 5 — new element types are addable without rewriting the canvas,
timeline, or player — and it is the framework's central extensibility claim. Ten features have
asserted it structurally; none has had somebody try it from outside. It is also the half that stands
alone: a guide is worth having with no second adapter, because the people it serves are the ones
already here.

**Independent Test**: A developer with no prior knowledge of this codebase implements a working
element type using only the guide — reaching a lesson that **saves and validates**, not merely one
that renders — and reports which questions the guide did not answer.

**Acceptance Scenarios**:

1. **Given** the guide and the ability to land a change to the format, **When** a developer follows it
   end to end, **Then** they produce an element type that authors, plays, validates, and inspects —
   with no change to the kernel. The qualifier is not pedantry: it is the difference between the two
   developers scenario 1a separates.
1a. **Given** a plugin, a renderer, and an editor registration but no schema variant, **When** a
   teacher saves a lesson using the new type, **Then** it is refused by the format — and the guide
   must have said so before they got there, because it is the one failure the other three pieces make
   look like success.
1b. **Given** a reader who consumes these packages rather than contributing to them, **When** they
   reach the fourth piece, **Then** the guide has already told them it needs a change to a package
   they do not control, and what their options are — rather than leaving them to discover it at the
   point where everything else appeared to work.
2. **Given** the guide, **When** a developer looks for what the contract requires, **Then** every
   member is listed, in one place, with what happens if it is omitted.
3. **Given** a partially implemented type, **When** it is registered, **Then** the refusal names the
   missing member, and the guide explains that refusal.
4. **Given** the guide, **When** it describes something the code does, **Then** the description is
   true of the code as it stands rather than as it once was.

---

### User Story 2 - A lesson plays with no React anywhere (Priority: P2)

A team runs a site that does not use React — or uses it, and does not want a second copy in a page
that shows one lesson. They drop in a custom element, point it at a manifest, and a learner sees the
lesson: slides advancing on time, elements appearing and leaving, effects running, questions
answerable.

**Why this priority**: This is the extensibility claim's other half, and the only *disprovable* one.
The kernel is framework-agnostic by construction and nothing has tested the construction. Second
because the guide serves people who are already here, and this serves people who have not arrived.

**Deliberately not a second full player.** It covers playback, effects, transitions, and the element
types needing nothing from the host; media and interactions are absent and said to be absent. The
purpose is proof, and a second implementation of media synchronisation would be the most expensive
possible way to learn whether `resolve` is React-shaped.

**Independent Test**: Play the reference lesson in a page with no React loaded at all, and compare
what a learner sees against the React player.

**Acceptance Scenarios**:

1. **Given** a page with no React, **When** the custom element is given a manifest, **Then** the
   lesson plays.
2. **Given** a lesson using only what this adapter covers, **When** it plays through both adapters,
   **Then** a learner sees the same thing at the same times, to the tolerance the project already
   holds preview and playback to.
3. **Given** a lesson containing media or a question, **When** it plays through this adapter,
   **Then** those elements are reported as unavailable in the way the React player reports an
   unknown type — never rendered as a gap, and never silently skipped.
4. **Given** a slide that waits for a question this adapter cannot show, **When** a learner reaches
   it, **Then** they are not stranded: the adapter reports the condition rather than leaving them
   on a slide that can never advance.
5. **Given** the adapter's package, **When** a host installs it, **Then** it pulls in no UI framework.
6. **Given** a host that wants only the React player, **When** they install, **Then** they do not
   receive this adapter.

---

### User Story 3 - The framework's own documentation says what it is (Priority: P3)

Somebody evaluating this framework — or returning to it after three months — reads the repository's
documentation and learns what the packages are, which one they need, what the framework will never do,
and where the boundaries are. They do not have to reconstruct that from eleven specification folders.

**Why this priority**: The per-package READMEs are good and there are seven of them; nothing joins
them up, and the two documents in `docs/` are a product specification and a build plan rather than
anything a reader outside this project would start with. Third because it serves comprehension rather
than capability.

**Independent Test**: A reader unfamiliar with the project can, from the documentation alone, say what
each package is for and which they would install for a stated goal.

**Acceptance Scenarios**:

1. **Given** the documentation, **When** a reader wants to play a lesson, **Then** they can determine
   which packages they need without reading source.
2. **Given** the documentation, **When** a reader asks whether the framework ships a backend, a
   server, or an editor they must use, **Then** the answer is stated rather than implied.
3. **Given** the documentation, **When** a reader looks for the constraints that shaped it, **Then**
   the ones that affect a host — no clock in the editor, one manifest as source of truth, immutable
   published versions — are findable.

---

### Edge Cases

**The guide**

- What happens when the guide and the code disagree? The code is right and the guide is a defect —
  and something has to notice, because a guide nobody checks is a guide that rots in one release.
- What happens when a plugin author implements only what they need — a renderer, no validator? The
  registry refuses, and the guide must explain that refusal before they meet it.
- What happens when a contract gains a member? Every guide example becomes wrong at once.
- What does the guide say about the pieces that live in three different packages? A type's plugin,
  its renderer, and its editor registration are in core, an adapter, and the studio; nothing today
  tells an author that.

**The second adapter**

- What happens when the kernel turns out to assume something React-shaped? That is the finding this
  item exists to produce, and it is recorded rather than worked around.
- What happens to an element type that has a React renderer and no web-component one? A learner sees
  something honest rather than a gap, matching what the React player already does for an unknown type.
- What happens with reduced motion, keyboard interaction, and screen readers? The learner-facing
  accessibility bar does not move because the rendering technology did.
- What happens when a page has several lessons on it? Nothing shared between them may be global.
- What happens to server rendering? The React adapter renders a first slide on a server; a custom
  element cannot, and the difference must be stated rather than discovered.

## Requirements *(mandatory)*

### Functional Requirements

**The authoring guide (US1)**

- **FR-001**: The framework MUST publish a guide that takes a developer from nothing to a working
  third-party element type.
- **FR-002**: The guide MUST name every piece such a type requires and where each lives, including
  that they live in **four different packages** — and that the fourth is a *versioned format change*
  rather than another registration. A plugin, a renderer, and an editor registration produce a type
  that works everywhere except in a saved lesson, because `validate` rejects a manifest naming a type
  the format's closed union does not contain.
- **FR-002b**: The guide MUST state **who can complete each piece**. Three are registrations a host
  supplies at runtime; the fourth is a change to a published package, so a host integrator cannot make
  it and an in-repo contributor can. Saying so is the single most useful sentence the guide contains
  for the reader its own opening describes, and omitting it walks that reader into a wall the first
  three pieces hide.
- **FR-002a**: The guide MUST distinguish what the **kernel** needs from what **shipping to authors**
  needs. The kernel needs nothing: no change to resolution, timing, the canvas, the timeline, or the
  player, which is the extensibility this framework claims. The format needs an additive variant and a
  migration, which is a MINOR schema change with its own rules — and conflating the two is how a
  developer concludes either that the framework is closed or that they can skip a step.
- **FR-003**: The guide MUST state what happens when a piece is omitted, because the framework
  refuses a partial registration and an author will meet that refusal before they finish.
- **FR-004**: The guide MUST cover effects as well as elements, since both are registered
  contributions and only one of them is obvious.
- **FR-005**: The guide MUST describe what a plugin can and cannot reach, and why the restriction
  exists rather than only that it does.
- **FR-006**: Every claim the guide makes about the code MUST be true of the code as it stands, and
  **drift MUST fail the build rather than wait to be noticed**. The guide's example element type MUST
  be a real type the suite registers and exercises, and the guide MUST quote from that source rather
  than restate it.
- **FR-006a**: The correspondence between the guide and the source it quotes MUST itself be checked.
  A guide that quotes a file nobody compares it against is a guide that drifts one edit later — which
  is precisely how `ElementEditor`'s header came to describe a framework that no longer exists.
- **FR-006b**: The example type MUST supply the **whole** contract, not a convenient subset.
  Constitution I rejects partial plugins, so an example that omitted a member would be teaching an
  author to write something the framework refuses.
- **FR-007**: The framework MUST correct existing documentation that has become untrue, including
  `ElementEditor`'s account of built-in types having no plugin, which feature 009 falsified.

**The second adapter (US2)**

- **FR-008**: The framework MUST ship an adapter that plays a lesson with no UI framework present.
- **FR-009**: The adapter MUST use the same kernel — the same resolution, the same timing, the same
  effect implementations — as the React adapter. A second timing engine or a second resolver MUST NOT
  be written.
- **FR-010**: The adapter MUST cover slide playback, timing, effects, transitions, and the element
  types that need nothing from the host. Media and interactions are **out of scope**, deliberately:
  the item exists to prove the kernel is framework-agnostic, and a second implementation of media
  synchronisation is the most expensive possible way to learn that.
- **FR-010a**: Because the covered set is a subset, what is **absent** MUST be as visible as what is
  present. A host reading the package's name and installing a partial player is the predictable
  failure here, and the only defence is saying so everywhere it would be found: the package
  description, its documentation, and its behaviour when it meets something it cannot show.
- **FR-011**: A learner MUST see the same thing at the same times through either adapter, over the
  set both cover, to the tolerance this project already holds preview and playback to. This MUST be
  asserted by a suite that runs and reports, and it is **not** a merge gate.
- **FR-011a**: The distinction from Constitution V MUST be stated where somebody would otherwise
  assume it. Preview-versus-playback parity is gated and a divergence there is a severity-2 defect,
  because both are the *same* renderer and a difference means a bug. Two adapters are two renderers
  by design, over a shared kernel; agreement is the goal and divergence is a finding rather than a
  contradiction. The proof-scoped surface is small, which is what makes the weaker mechanism
  defensible — if the adapter later grew to full coverage, this decision would need revisiting.
- **FR-012**: The adapter MUST NOT be required by any existing package, and a host wanting only the
  React player MUST receive none of it.
- **FR-013**: The adapter MUST depend on no UI framework, asserted structurally rather than by
  inspection.
- **FR-014**: An element type with no renderer in this adapter MUST be reported the way the React
  player reports an unknown type, rather than rendering nothing.
- **FR-015**: The adapter MUST meet the same learner-facing accessibility bar as the React player:
  keyboard-operable interactive controls with accessible names, reduced motion honoured, and nothing
  essential conveyed by colour alone. **Which clauses this scope can exercise MUST be stated rather
  than left to be assumed**: the covered types are `text`, `shape`, and `image`, none of them
  interactive, so the keyboard clause has almost nothing to clear here and a passing suite is not
  evidence it was tested. Reduced motion and the colour clause are live, and the unavailable notice
  is the surface both bear on.
- **FR-015c**: Reduced motion MUST be honoured **the way the React player honours it** — the kernel's
  reduced alternative emitted under mirrored property names, and the choice made in CSS at paint
  time. It cannot be made in script: the preference is unreadable on a server, so a script defers the
  choice and a learner who asked for less motion sees the full motion first. Emitting only the
  ordinary values leaves nothing for the media query to select, which honours nothing while appearing
  to.
- **FR-015a**: Author-supplied content MUST reach the page as **text**, never as markup. A lesson's
  text, labels, and alternative text come from whoever wrote the lesson, and a package imported from
  elsewhere may have been written by anybody (feature 010 established that the format permits a
  `javascript:` address today). The constitution requires rich text and plugin-supplied content to be
  sanitized against script injection.
  **React satisfied this structurally and that protection does not come along.** Children are escaped
  by the renderer, and the escape hatch — `dangerouslySetInnerHTML` — is banned by a lint rule whose
  selectors are React-specific. A custom element assigning `innerHTML` matches neither, and writing a
  DOM by hand is exactly the situation that reaches for it.
- **FR-015b**: The prohibition MUST be enforced by a rule rather than by care, and asserted by a test
  that renders a lesson containing markup in a text payload and confirms a learner sees the characters
  rather than the effect.
- **FR-016**: Several instances on one page MUST NOT interfere with one another.
- **FR-017**: The framework MUST state what this adapter does **not** do, including server rendering,
  which the React adapter provides and a custom element cannot.

**The documentation (US3)**

- **FR-018**: The repository MUST document what each package is, which a host needs for a stated
  goal, and how they depend on one another.
- **FR-019**: The documentation MUST state what the framework will never do — ship a backend, run a
  server, own a lesson's storage — because those are the questions a reader asks first.
- **FR-020**: The documentation MUST record the host-visible constraints that shaped it, so a host
  meets them in prose rather than in a failing build.
- **FR-021**: The documentation MUST be reachable from the repository's front page rather than only
  from a specification folder.

### Key Entities

- **Authoring guide**: The document that takes a developer to a working element type. Its subject is
  the contracts, not the internals.
- **Element contribution**: What a third-party type consists of — a plugin, a renderer per adapter,
  and an editor registration — spread across three packages, which is the fact the guide exists to
  make visible.
- **Web-component adapter**: A package that plays a lesson using the platform's own component model
  and no UI framework.
- **Adapter agreement**: The claim that two adapters show a learner the same lesson, and whatever
  mechanism holds it true.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer implements a working third-party element type using only the guide, **with no
  change to the kernel** — no edit to resolution, timing, the canvas, the timeline, or the player.
  That is Goal 5's actual claim. It is **not** "no change to any existing package": the lesson format's
  element `type` is a closed union, so shipping a type to authors additionally needs an additive schema
  variant and a migration. An earlier wording promised the stronger thing, which the format makes
  false, and a guide written to it would send a developer through three packages to a validation error
  they cannot fix from outside.
- **SC-002**: 100% of the contract members a type must supply are listed in the guide, verified
  against the contracts rather than against memory.
- **SC-003**: Every claim the guide makes about the code is true when the feature lands, and no
  existing comment that contradicts the code survives it.
- **SC-004**: The reference lesson plays through the second adapter in a page with no UI framework
  loaded.
- **SC-005**: A learner sees the same slides, elements, and effects at the same times through both
  adapters, over the set both cover, within the tolerance the project already applies to preview and
  playback. Reported by a suite; not a merge gate (FR-011).
- **SC-006**: Every element type the adapter does **not** cover is reported as unavailable rather
  than rendered as a gap, and a slide that waits for one leaves a learner told rather than stranded.
  This replaces an earlier criterion about interaction parity, which the proof-scoped decision put
  out of reach — and it matters more, because with a subset adapter the unavailable path is the
  ordinary case rather than the edge one.
- **SC-007**: The second adapter's published package pulls in no UI framework, asserted by a check
  rather than by reading a manifest.
- **SC-008**: Installing the framework without the second adapter leaves every existing test passing
  and adds nothing to what a host downloads.
- **SC-009**: The second adapter reports no accessibility violations on the learner-facing surface,
  measured the same way the React player is.
- **SC-009a**: A lesson whose text payload contains `<script>` renders those characters visibly and
  executes nothing, and no file under the adapter's source assigns `innerHTML` — the second asserted
  by a rule, because the first only catches the case somebody thought to write a test for.
- **SC-010**: Two instances on one page play independently, with neither affecting the other's timing
  or state.
- **SC-011**: A reader unfamiliar with the project names the package they need for a stated goal,
  from the documentation alone.
- **SC-012**: Every finding about the kernel that this adapter exposes is recorded, including those
  not acted on.
- **SC-013**: The guide's example type compiles, registers, and is exercised by the suite; a change
  to any contract it depends on fails the build rather than leaving the guide wrong.
- **SC-014**: What the adapter does not cover is stated in the package's description, its
  documentation, and its behaviour — three places, because a host who reads only one of them is the
  one this criterion exists for.

## Assumptions

- **The kernel is not expected to be perfect, and the findings are the deliverable.** Every feature in
  this project has found something by trying to use a contract nobody had used — ten instances of a
  member declared with no producer, an interface that made a requirement impossible, a lint rule that
  reshaped a design. A second adapter is the largest such attempt yet, and a version of this feature
  that reported nothing would be the surprising outcome rather than the good one.
- **A partial adapter is the accepted trade, and its risk is a host mistaking it for a whole one.**
  Nothing about "web-component adapter" tells a reader that questions and media are missing, so the
  absence is stated in three places rather than one, and the adapter's behaviour on meeting something
  it cannot show is a requirement rather than a detail.
- **Adapter agreement is a suite because the covered surface is small.** That reasoning is load-bearing
  rather than decorative: it is the thing that stops being true if the adapter later grows, and
  whoever grows it should revisit the decision rather than inherit it.
- **The guide is executable because prose has already failed here once.** `ElementEditor`'s header has
  described a framework that stopped existing two features ago. A guide is read by people who cannot
  tell it is wrong, which is the opposite of a code comment's audience.
- **Documentation lives in the repository as Markdown.** There is no site infrastructure and shipping
  one is not this feature's job.
- **The guide is written for a developer, not a teacher.** The teacher-facing surface is the editor,
  which nine features have already built.
- **Losing React means losing what React was doing silently.** Escaping is the clearest instance and
  the reason FR-015a exists, but it is unlikely to be the only one — the whole premise of this feature
  is that nobody has looked at what the primary adapter provides structurally rather than
  deliberately. Anything else found belongs in the same list as the kernel findings.
- **The second adapter targets the browser only.** Its whole premise is the platform's component
  model, which is a browser feature.
- **`@cuestack/element` is the package**, already reserved in the workspace since Wave 0 with a
  comment saying this wave fills it.
- **Constitution V is not in tension with a second adapter.** "One renderer, one timing engine, one
  implementation of each effect" governs preview against playback within an adapter. What is shared
  between adapters is the kernel — resolution, timing, effects — and what differs is only the layer
  that writes to the screen. If that turns out not to be true, it is the most important finding this
  feature could produce.
- **No existing package changes shape.** This feature adds a consumer and a guide; a kernel change it
  turns out to need is a finding to report, not a licence to reshape the core.

## Dependencies

- **EN-5** (registries) — complete. The plugin contract is what the guide documents and what the
  second adapter consumes.
- **RC-1** (the React player) — complete. It is the reference the second adapter is compared against,
  and the source of the tolerance FR-011 borrows.
- **Feature 009's builtin plugins** — complete, and the reason FR-007 exists: registering them
  falsified a comment that is still in the tree.
- **The existing parity harness** — complete. It compares preview to playback within the React
  adapter; whether it extends across adapters is FR-011's open question.
