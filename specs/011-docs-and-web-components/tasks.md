---

description: "Task list for feature 011 — the authoring guide and the second adapter"
---

# Tasks: The Authoring Guide and the Second Adapter

**Input**: Design documents from `/specs/011-docs-and-web-components/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Required. Constitution II is NON-NEGOTIABLE, and this feature has an unusual case of it —
FR-006 makes the *guide's example* a test, because documentation drift must fail the build rather
than wait to be noticed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on incomplete work
- **[Story]**: US1 the guide, US2 the adapter, US3 the documentation

---

## Phase 1: Setup

**Purpose**: fill a package that has been a stub since Wave 0, and tell three config files about it.

- [X] T001 Fill `packages/element/package.json` — description stops saying "arrives in a later wave". **`dependencies`: `@cuestack/core` and `@cuestack/schema`, and nothing else — no UI framework, not even as a peer.** That absence is the package's entire claim (FR-013). **`devDependencies`: `@cuestack/react`, `react`, `react-dom`**, needed by T037's agreement suite and by nothing that ships. Verified rather than assumed: under pnpm's isolated `node_modules` a package declaring only core and schema **cannot import `@cuestack/react` even from a test** — the same import added to `packages/adapter-http` fails with "Cannot find package". `files: ["dist"]` publishes none of them, and FR-013's claim is about the dependency graph a host installs
- [X] T002 [P] **Move** `@cuestack/element` in `vitest.config.ts` from the node glob to a happy-dom project of its own. It is already listed at `packages/{schema,core,element,adapter-http}` — a stub with no tests needed no DOM — so adding a second registration would put one package in two projects and run its DOM suites in node, where `customElements` does not exist and the failure reads as a bug in the element. Verified before planning: happy-dom defines `customElements`, attaches open shadow roots, and provides `requestAnimationFrame` (research R-06)
- [X] T003 [P] Add two rules to `.dependency-cruiser.cjs`, both scoped `from: ^packages/<name>/src` like every rule already there: nothing under any package's `src` may depend on `@cuestack/element`, **and `packages/element/src` must not depend on `@cuestack/react`**. **The `src` scoping is load-bearing rather than conventional** — T037's agreement suite imports both adapters from a *test* directory, and a rule written `^packages/element/` would forbid the one suite that proves the adapters agree. The second is the one that matters — ten modules the adapter wants live in the React package and React is only a *peer* dependency there, so importing them would install nothing, break nothing visible, and quietly make a web-component adapter depend on the React adapter (research R-01)
- [X] T003a [P] Add `packages/element/src` to the `targets` list in `tools/scripts/gates/theme-values.mjs`, and to the `files` glob of **the block whose `no-restricted-syntax` carries the `no-theme-literals` selectors** — identify it by those selectors, not by position: `tools/eslint-config/index.js` has five blocks setting `no-restricted-syntax` and only one of them is the colour rule (today `files: ['packages/react/src/elements/**/*.{ts,tsx}']`). **Widen that rule's selector to match `TemplateElement` as well as `Literal`**: verified inside the scope where the rule does apply, a plain `"#336699"` fires and the same hex in backticks does not. `styles.ts` is a stylesheet in a template literal.
- [X] T003a1 Close the pre-existing gap T003a depends on: `gate:theme-values` runs ESLint over `packages/react/src/elements` **and** `packages/studio/src` and reports both clean, but the colour selectors never reach studio — the block at `tools/eslint-config/index.js:299` sets `no-restricted-syntax` for `packages/studio/src/**` and, as that file's own header warns at line 15, **the rule is replaced rather than merged**. Spread the colour selectors into that block the way `NO_INNER_HTML` already is. **Measured before being asked for: with the spread applied and a control violation firing, `packages/studio/src` produces zero violations** — nine features of editor code are clean and only the enforcement was missing, so this is two lines with no fallout. **Not `[P]`**: it edits `tools/eslint-config/index.js`, which T003a and T003a2 also edit
- [X] T003a2 Add an `innerHTML` prohibition for `packages/element/src` to `tools/eslint-config/index.js` — a `no-restricted-syntax` selector on `MemberExpression[property.name='innerHTML']` (and `outerHTML`, `insertAdjacentHTML`), spread into a block alongside `NO_INNER_HTML` rather than replacing it. **Not `[P]`**: it edits `tools/eslint-config/index.js`, the same file as T003a and T003a1, and parallel tasks on one file is the hazard this list otherwise avoids. **`NO_INNER_HTML` does not cover this**: its selectors are `JSXAttribute` and `Property[key.name='dangerouslySetInnerHTML']`, both React-only, and its own message explains why the ban mattered — "author-supplied text reaches the page as a React child, which escapes it". A custom element has no such child, and writing a DOM by hand is exactly what reaches for `innerHTML` (FR-015a, FR-015b, NFR-SEC-007)
- [X] T003b [P] Prove T003a **and T003a2** rather than assume them: add a deliberate `#336699` and a deliberate `node.innerHTML = x` to a file under `packages/element/src`, run `pnpm exec eslint` on it, confirm **both** fail, and remove them. **The check is not that the config now lists the package — it is that a violation is refused.** This feature has twice added enforcement whose mechanism was never run, and once did so inside a fix for that exact pattern
- [X] T004 [P] Add lesson fixtures to `packages/element/test/harness/lessons.ts` — one using only the covered types, one with a `video` and a `question`, and one whose slide advances `after_interaction` on a question this adapter cannot render. The third is the sharp case: a learner must be told rather than stranded
- [X] T005 Create the mount harness in `packages/element/test/harness/mount.ts` — creates the element, appends it, injects a hand-advanced clock, and returns the shadow root. Nothing waits on wall-clock time; the transport takes its clock as a port precisely so no test has to

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: one declaration of what this adapter covers, so nothing can disagree about it.

**⚠️ Blocks US2.** US1 and US3 do not depend on it and may start after Phase 1.

- [X] T006 Write `packages/element/test/covered.test.ts` — the covered set is exactly `text`, `shape`, and `image`; every other type in `ELEMENT_TYPES` is absent from it. Driven from the schema's own list rather than a hand-written one, so a new element type in the format fails here until somebody decides which side it is on
- [X] T007 Implement `packages/element/src/covered.ts` — the single list the renderers and the unavailable path both read. Two lists would let a type be rendered by one and apologised for by the other, which is a blank rectangle nobody can explain

**Checkpoint**: the boundary exists as a value, not as a comment.

---

## Phase 3: User Story 1 — A developer adds an element type without reading the kernel (Priority: P1) 🎯 MVP

**Goal**: one guide takes a developer to a working third-party element type.

**Independent Test**: a developer who has not worked on this codebase implements a working element
type from the guide alone, and reports the questions it did not answer.

**Depends on**: nothing. Shippable with no adapter in existence — it serves the people already here.

### Tests for User Story 1

- [X] T008 [P] [US1] Write `packages/core/test/fixtures/guide-example/plugin.test.ts` — the guide's example type registers successfully, and registration **throws naming the member** when any one is removed. Constitution I rejects partial plugins, so an author meets that refusal before they finish and the guide has to explain it (FR-006b)
- [X] T009 [P] [US1] Write `packages/core/test/fixtures/guide-example/complete.test.ts` — the example supplies every member of `ElementPlugin`, derived from the contract rather than from a list somebody typed. A member added to the contract fails here, which is what stops the guide teaching an incomplete type
- [X] T010 [P] [US1] Write `packages/core/test/fixtures/guide-example/inert.test.ts` — registering the example changes nothing about what an existing lesson renders. Feature 009 made the same assertion for the seven builtins and it is what makes an example safe to ship inside the test corpus
- [X] T011 [US1] Write `tools/scripts/__tests__/doc-snippets.test.ts` — the checker fails on a fenced block that has drifted from its source, passes when they match, and fails on a block naming a region that does not exist. The third case matters: a snippet pointing at a deleted region would otherwise pass by finding nothing. **`.test.ts`, not `.test.mjs`** — the `gates` vitest project includes `tools/scripts/**/*.test.ts`, so an `.mjs` suite is collected by nothing and the checker that makes documentation unable to rot would itself be untested

### Implementation for User Story 1

- [X] T012 [US1] Implement the example's plugin in `packages/core/test/fixtures/guide-example/plugin.ts` — a complete `ElementPlugin` for one invented type, with an inert `resolve` so registering it changes no rendered output
- [X] T013 [P] [US1] Implement the example's renderer in `packages/react/test/fixtures/guide-example/renderer.tsx` and its editor registration in `packages/studio/test/fixtures/guide-example/editor.ts`. **Four packages, which is the fact the guide exists to make visible** — no file in the codebase states it today (data-model §2)
- [X] T013a [US1] Write `packages/core/test/fixtures/guide-example/saves.test.ts` — a lesson using the example type is **refused by `validate`**, and the refusal names the type. This is the step three registrations make look unnecessary: the type registers, renders, and appears in the Add menu, and then the lesson will not save. Assert it explicitly, because it is the guide's most important sentence and the only one an author cannot discover by trying things that appear to work.
  **Assert the refusal only.** An earlier draft also asked for "and accepted with a variant", which is not implementable and should not be: `elementSchema` is a fixed const over a closed `variants` array with no extension point, so satisfying it means editing `packages/schema/src/validate/element.ts` — which `check:migrations` watches, requiring a migration step and a `schemaVersion` bump in the same revision. **A documentation example would be shipping an invented element type in the published lesson format.** Building a parallel schema in the test instead would not be `validate` and would prove nothing
- [X] T014 [US1] Implement `tools/scripts/check-doc-snippets.mjs` — every fenced block in the guide names a source file and region; the script extracts and compares, and a mismatch exits non-zero
- [X] T015 [US1] Write `docs/authoring-elements.md` — **the four pieces and their four packages**, with the fourth marked as a *format* change rather than a registration: an additive variant in the element union plus a migration, which is a MINOR schema change with a `schemaVersion` bump and its own rules (`check:migrations` enforces the chain).
  **State who can complete each piece, before listing them** (FR-002b): three are registrations a host supplies at runtime, and the fourth is a change to `@cuestack/schema`, a published package a host *consumes*. An in-repo contributor can finish; a host integrator cannot, and their route is an upstream change or a fork whose lessons fail validation elsewhere. This goes at the top rather than at the fourth step, because by the fourth step the first three have made everything look like it worked.
  **The guide demonstrates three pieces and describes the fourth, and must say so.** The example type cannot ship a format variant — that would put an invented type in the published lesson format for the sake of a document (see T013a) — so the fourth piece is prose: what to add to `variants` and `ELEMENT_TYPES`, and the migration step that keeps the chain unbroken. Note for the reader that an additive variant needs **no transformation** — manifests written before it are still valid — but still needs a registered step, exactly as `v1_0` does and for the same reason its header gives: "the chain must reach the current version by an unbroken path". There is no existing additive-variant migration to copy; the two that exist are a field rename and that terminal no-op. Draw the distinction the framework's claim actually rests on — **the kernel needs nothing**, which is Goal 5, and shipping a type to authors needs the format change. Then every plugin member and what its absence causes, **the four different failure modes** (a missing plugin member throws at registration, a missing renderer degrades, a missing editor registration is silent until a teacher looks, and a missing format variant refuses the save — last, after the other three have made everything appear to work), effects as well as elements, what a plugin can reach and **why** it cannot reach more, and the registry cliff a third-party author meets first. Every code block extracted, none typed by hand
- [X] T016 [US1] Add `check:docs` to the root `package.json` scripts and to `.github/workflows/ci.yml`. A checker nobody runs is a comment: `ElementEditor`'s header has described a framework that stopped existing since feature 009, through two releases, because nothing compared it to anything

**Checkpoint**: a developer can add an element type. Shippable with no adapter written.

---

## Phase 4: User Story 2 — A lesson plays with no React anywhere (Priority: P2)

**Goal**: the same kernel, a different screen-writing layer, and no UI framework in the package.

**Independent Test**: play the reference lesson in a page with no UI framework loaded, and compare
what a learner sees against the React player over the set both cover.

**Depends on**: Phase 2. Independent of US1 and US3 — they share no files.

### Tests for User Story 2

- [X] T017 [P] [US2] Write `packages/element/test/plays.test.ts` — give `<cuestack-lesson>` a manifest, advance the injected clock, and assert the shadow root holds what the slide should show at each instant, including elements entering and leaving on their own timing
- [X] T018 [P] [US2] Write `packages/element/test/unavailable.test.ts` — a `video`, `audio`, `button`, or `question` occupies its geometry and says it cannot be shown; an `image` with no `resolveAsset` does the same rather than rendering a broken picture. **With a proof-scoped adapter this is the ordinary path, not the edge one** — four of seven types take it (SC-006)
- [X] T019 [P] [US2] Write `packages/element/test/stranded.test.ts` — a slide advancing `after_interaction` on a question this adapter cannot render reports that it cannot advance. `resolve` already returns `blockingUnknownRequired`; this asserts the adapter surfaces it rather than leaving a learner on a slide that can never end (US2 scenario 4)
- [X] T020 [P] [US2] Write `packages/element/test/instances.test.ts` — two elements, two manifests, two clocks advanced independently, neither affecting the other's slide, timing, or styles. Then the one that gets forgotten: **disconnect cancels the frame loop**, because a loop outliving its element makes a page slower the longer somebody uses it and nobody traces that back to a lesson they closed (SC-010)
- [X] T020a [P] [US2] Write `packages/element/test/escaping.test.ts` — a lesson whose `text` payload contains `<script>alert(1)</script>` and whose alt text contains `<img onerror=…>` renders those characters **visibly**, executes nothing, and creates no element the manifest did not describe. FR-015b, and the half a lint rule cannot give: the rule stops `innerHTML`, and this proves the thing the rule exists to protect (SC-009a)
- [X] T020b [P] [US2] Write `packages/element/test/reduced-motion.test.ts` — with the preference set, an element whose effect declares a reduced alternative uses it, and one that does not falls back to no motion rather than to full motion. Assert **both halves**: that `frame.ts` emitted the `--cs-r-*` values and that the stylesheet's media block selects them. Either half alone passes while a learner still sees the movement they asked not to see (FR-015)
- [X] T021 [P] [US2] Write `packages/element/test/a11y.test.ts` **and register it in `tools/scripts/gates/a11y.mjs`**, whose `{ project, dir, ext }` list names react and studio only. SC-009 says "measured the same way the React player is", and a suite absent from that list runs under `pnpm test` and is invisible to `pnpm gates` — measured differently, by a different command, with a different consequence. **State in the suite's header which of FR-015's clauses this scope can exercise and which it cannot**: the covered types are `text`, `shape`, and `image`, none interactive, so "keyboard-operable controls with accessible names" has almost nothing to clear and must not be read as assurance it was tested. What is live here is the unavailable notice — the thing most likely to ship as a grey box conveying its meaning by being grey — and reduced motion, which T020b covers (SC-009, FR-015)
- [X] T022 [P] [US2] Write `packages/element/test/theme.test.ts` — `--cs-*` custom properties set on the host reach elements inside the shadow root. This is why shadow DOM is affordable: the theming contract works unchanged, and if it did not, isolation would have cost the theme (research R-02)
- [X] T023 [P] [US2] Write `packages/element/test/api.test.ts` — `manifest` is a property and `src` an attribute; `play`, `pause`, and `seekToSlide` behave; the four events fire with the shapes [contracts/element-adapter.md §4](./contracts/element-adapter.md) declares, bubbling and composed. Assert no event carries anything about a learner — the rule `LessonEvent` follows, enforced by shape rather than by review. **This task was marked done against a file that tested none of it** (registration, the manifest property, and disconnect only). `observedAttributes` returned `['src', 'autoplay']` with no `attributeChangedCallback`, which is worse than omitting them: it announces to the platform that the element reacts to those names. Corrected under T047–T049 below

- [X] T023a [P] [US2] Write `packages/element/test/one-kernel.test.ts` — a structural assertion that `packages/element/src` **imports** `resolve`, `createClock`, and `createTransport` from `@cuestack/core` and **defines** none of them, and that no file under it declares a second clamp, a second effect implementation, or its own resolution pass. FR-009 is this feature's central claim and nothing else tests it. It is also the plan's stop condition — "if the adapter needs its own resolve or its own clock, stop and report rather than fork" — and a stop condition nobody can trigger is a sentence

### Implementation for User Story 2

- [X] T024 [P] [US2] Implement `packages/element/src/frame.ts` — a `RenderState` to style values, applied to a node. **About forty lines, and duplicated deliberately**: the ten React-free modules that already do this live in `@cuestack/react` (recorded as eight during Phase 0; re-measured during implementation), and the three routes to sharing them are all worse (research R-01). Bounded by the covered set — geometry, opacity, transform, and the effect properties FR-010 brings with effects. **Emit the reduced set as well as the ordinary one.** Reduced motion is two halves and the earlier scoping dropped one: the kernel emits a reduced alternative, this writes it under mirrored `--cs-r-*` names, and T025's stylesheet chooses between them at paint time. Writing only the ordinary set leaves the media block nothing to select and reduced motion silently unhonoured (FR-015, research R-12)
- [X] T025 [P] [US2] Implement `packages/element/src/styles.ts` — the stylesheet, adopted into the shadow root, consuming the same `--cs-*` names the React player's does, **including a `@media (prefers-reduced-motion: reduce)` block with the nested-fallback structure `stage.css` uses**: `--cs-opacity: var(--cs-r-opacity, var(--cs-opacity, 1))` and its siblings. The nesting is the mechanism, not a flourish — where the kernel emitted a reduced value it wins, and where it did not the element falls back to no motion. **It must be CSS rather than a script**, for the reason `stage.css`'s own header gives: the preference cannot be read on a server, so a script would defer the choice and a learner who asked for less motion would see the full motion first
- [X] T025a [P] [US2] Write `packages/element/test/tokens.test.ts` — read the emitted stylesheet **as a string** and assert every colour, font, and spacing value resolves from `var(--cs-…)`. This is the assertion Constitution III actually needs: a lint selector can be evaded by how a string is assembled, and a test that reads the CSS the shadow root receives cannot. T003a's rule is the backstop for anything written outside a template literal
- [X] T026 [US2] Implement `packages/element/src/renderers.ts` — `text` and `shape` unconditionally, `image` given a `resolveAsset`. **Author-supplied content reaches the DOM through `textContent` and attribute assignment, never through markup** (FR-015a). React escaped children for us and its escape hatch was banned; neither protection survives the move, and a lesson imported from elsewhere may have been written by anybody. Registry-driven: an unregistered type takes the unavailable path rather than reaching a branch (Constitution I)
- [X] T027 [US2] Implement `packages/element/src/unavailable.ts` — reuse the React adapter's *answer*, not a second vocabulary. A learner meeting two different apologies depending on which adapter their school runs is the failure this avoids (research R-04)
- [X] T028 [US2] Implement `packages/element/src/LessonElement.ts` — the custom element: an open shadow root **built by constructing nodes and adopting the stylesheet, never by assigning `innerHTML`** (FR-015a; the stylesheet is framework-authored and safe, but the habit is what leaks into element content), a `requestAnimationFrame` loop started in `connectedCallback` and **cancelled in `disconnectedCallback`**, and per-instance clock and transport. Everything from core: `createClock`, `createTransport`, `resolve`. No second clock — `CLAMP_CEILING_MS` lives in core's, and an adapter writing its own would lose the reason it exists (research R-05)
- [X] T029 [US2] Implement `packages/element/src/index.ts` — define the element, export its type, and delete `ELEMENT_WAVE`, the constant that has stood in for this package since Wave 0
- [X] T030 [US2] Write `packages/element/README.md` — what it is, and **the things it does not do** (media, interactions, gestures, progress, and server rendering — five, not the four this task originally said, because FR-017's server-rendering clause was missing from it), stated as prominently as what it does. A host reading "adapter" and installing a partial player is the predictable failure here (FR-010a, SC-014). Also state **why agreement with the React player is reported rather than gated** (FR-011a): preview-versus-playback is one renderer compared against itself, where a difference is a bug; two adapters are two renderers by design over one kernel. Somebody who reads Constitution V and then finds an ungated comparison will otherwise conclude the rule is being ignored

- [X] T044 [US2] **Added after implementation, from reading FR-010 back against the built adapter.** Slide advance and transitions in `packages/element/src/LessonElement.ts` and `styles.ts` — neither was in this list, and the word *transition* appeared nowhere in `plan.md` or `tasks.md` despite FR-010 naming it a MUST **and `contracts/element-adapter.md` listing both under Covered since Phase 1**. Every fixture in the harness was a single slide, so nothing failed. Advance goes through `createAdvanceController` (the kernel's rule, not a duration comparison of our own, which would be wrong about `after_media_ends`, `after_interaction`, and the per-instance replay decision); transitions reuse the React player's DOM hooks exactly so one host stylesheet themes both
- [X] T044a [P] [US2] Write `packages/element/test/transitions.test.ts` and add two-slide fixtures to `test/harness/lessons.ts` — the second slide arrives on duration, the first leaves, both halves are marked while the transition runs, the authored type and duration reach CSS, it ends on **lesson** time, the leaving half is `aria-hidden`, and no transition runs when none is authored
- [X] T045 [US2] Extend `packages/element/test/one-kernel.test.ts` to name `createAdvanceController`. The original checked `resolve` and `createTransport` only — both of which an adapter that never advanced shared *truthfully*, so a missing feature passed a claim about sharing the kernel. Strip comments before the code-shape checks: the first pattern matched the prose explaining why a duration comparison is wrong
- [X] T046 [US2] FR-017's server-rendering statement in `packages/element/README.md`, and the SSR-safe base class in `LessonElement.ts`. `class extends HTMLElement` is evaluated at module load, so a bare declaration throws on `import` in any node process — every host doing SSR, before a browser is involved. The package must import on a server and render nothing there; both halves are the requirement
- [X] T047 [US2] Implement `attributeChangedCallback` in `packages/element/src/LessonElement.ts` for the `src` and `autoplay` attributes `observedAttributes` has declared since the first draft and nothing honoured. `src` fetches and **does not retry** (§5 makes fetching the host's job) but reports `LESSON_FETCH_FAILED` rather than leaving a blank rectangle
- [X] T048 [US2] Implement `play()`, `pause()`, and `seekToSlide(id)` — contract §3. By **id**, not index: an id is what a host has, and an unknown one does nothing rather than throwing at a caller holding a stale reference. **`autoplay` now decides whether a lesson starts itself**, matching the React player's prop and the contract's "absent means the host calls `play()`"; the test harness sets it, as the React suite's `play()` helper passes `autoPlay: true`
- [X] T049 [US2] Implement `cuestack:started`, `cuestack:slide`, and `cuestack:completed` — contract §4 declares four events and only `cuestack:problem` existed. One `#emit` path so every event bubbles **and composes**; without composed an event stops at the shadow boundary and a host listening on its own container hears nothing, which reads as the element being broken. Start and completion fire once per lesson, not once per resume or per frame

**Checkpoint**: a lesson plays with no UI framework present. DX-2's claim is testable.

---

## Phase 5: User Story 3 — The framework's own documentation says what it is (Priority: P3)

**Goal**: seven READMEs joined up, and the claims that stopped being true corrected.

**Independent Test**: a reader unfamiliar with the project names the package they need for a stated
goal, from the documentation alone.

**Depends on**: Phase 1. **Its content depends on US1 having been written** — see the note in
Dependencies.

### Tests for User Story 3

- [X] T031 [P] [US3] Write `tools/scripts/__tests__/doc-links.test.ts` — every relative link in `docs/` and in the root `README.md` resolves. A guide that points at a moved file is a guide that fails in the reader's hands rather than in CI

### Implementation for User Story 3

- [X] T032 [P] [US3] Write `docs/packages.md` — what each package is, which a host needs for a stated goal, and how they depend on one another. It must answer the three questions a reader asks before any other: does this ship a backend, does it run a server, must I use its editor (FR-019)
- [X] T033 [P] [US3] Correct `packages/studio/src/registry/editors.ts` — its `ElementEditor` header still explains that "the seven built-in types have no `ElementPlugin`" and that "core's plugin registry is empty by default". Feature 009 falsified both and two features have shipped since (FR-007)
- [X] T034 [US3] Record the host-visible constraints in `docs/packages.md` — no clock in the editor, one manifest as the source of truth, published versions immutable, a supplied element registry replaces the default. A host should meet these in prose rather than in a failing build (FR-020)
- [X] T035 [US3] Update the root `README.md` to point at `docs/authoring-elements.md` and `docs/packages.md`. Documentation reachable only from a specification folder is documentation for people who already know where to look (FR-021)
- [X] T036 [US3] List every documentation claim corrected during this feature, and what made each false, in `docs/cuestack_framework_plan.md`. The list is expected to grow while T015 is written — a claim only turns out to be false when somebody tries to state it precisely (research R-09)

**Checkpoint**: all three stories delivered.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T037 Write `packages/element/test/agreement.test.ts` — play one manifest through **both** adapters at matched instants and report what differs: slide, element, property, and the two values. It lives in a suite rather than a script because a plain node process has neither React nor a DOM and cannot drive either adapter; the existing parity gate solves the same problem the same way, by spawning vitest rather than computing in-process. It imports `@cuestack/react` from a **test** directory, which T003's `src`-scoped dependency rules permit deliberately and which T001's `devDependencies` make resolvable — both halves are needed, and neither works alone
- [X] T037a Implement `tools/scripts/check-agreement.mjs` and add `check:agreement` to the root `package.json` — spawn `vitest run --project @cuestack/element agreement`, print what it reported, and **exit zero whatever it found** (FR-011). Report which types were covered, because a report omitting that reads as "the adapters agree" when it means "the adapters agree about text and shapes" (data-model §6). **Not in `tools/scripts/gates/`**, deliberately: `run-all.mjs` runs everything in that directory and fails on a non-zero exit, so a reporter there works today and is a category error — the next reader will make it fail, silently reversing FR-011's decision
- [X] T038 [P] Assert SC-007 structurally: `pnpm lint` passes both new boundary rules, and `@cuestack/element` loads in a process with no UI framework installed
- [X] T039 Confirm SC-008 by running `pnpm test` with `packages/element` temporarily absent from `vitest.config.ts`'s project list — **not `[P]`**, because it mutates the same file T002 edits and restoring it is part of the task — every existing suite still passes, and no `package.json` outside `packages/element/` names it
- [X] T040 Update `docs/cuestack_framework_plan.md` — DX-1 and DX-2 to ✅, **Wave 5 closed**, and the findings this feature exists to produce: the eight React-free modules in `@cuestack/react` and the extraction they want, plus anything else the adapter turned up about the kernel **including what was not acted on** (SC-012). A second adapter that reported nothing would be the surprising outcome, not the good one
- [X] T041 Run `pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm gates && pnpm check:rules && pnpm check:docs && pnpm check:agreement && pnpm check:packaging && pnpm check:isolation && pnpm check:studio-isolation && pnpm check:data-model && pnpm check:migrations` and confirm every one is green. `check:rules` must still read **18 of 18**. **`pnpm test:coverage` is a known red** at 89.03% branches against a 90% floor — pre-existing, recorded in the framework plan, not this feature's to fix, and it must not get worse
- [X] T042 Verify the negative controls by deliberate breakage across `packages/element/src/` and `tools/scripts/`, restoring each afterwards: make `image` render without a resolver (T018 must fail); drop the `disconnectedCallback` cancellation (T020 must fail); render a `question` instead of reporting it unavailable (T018 and T019 must fail); let the shadow root be closed (T022 must fail, because the theme assertion cannot reach in); make the snippet checker compare nothing when a region is missing (T011 must fail); and remove one member from the guide's example plugin (T009 must fail)
- [X] T050 Update the Phase 1 artifacts to match what was built: `contracts/element-adapter.md` gains the advance-controller and transition DOM contract, `data-model.md` gains the advance controller, slide index, and running transition in `InstanceState` plus `compared` on `AgreementReport`, and `quickstart.md` gains scenarios for transitions and for importing on a server
- [X] T051 Add a `## Requirement coverage` table to `plan.md` — one row per functional requirement and the artifact that satisfies it. **Keyed to requirements rather than to tasks**, because a table of tasks would have looked complete: FR-010 was in the spec and in the contract and absent from every task
- [X] T052 Write `tools/scripts/__tests__/plan-coverage.test.ts` — every FR in a spec appears in its plan's coverage table, for any plan that declares one. Opt-in per feature, because a test failing until nine shipped features were retrofitted would be switched off rather than satisfied. **It took three attempts to fail when it should**: `includes('FR-010')` is satisfied by a row naming only `FR-010a`; boundary matching still passed because the prose beneath the table says "FR-010's row is the one to read"; it now reads table rows alone. Each failure was found by running the negative control, not by inspecting the test
- [X] T053 Re-audit `contracts/element-adapter.md` clause by clause against `packages/element/src/` — the method that found T047–T049, after the same method applied to `spec.md`'s FR list found T044. Record the result in `docs/cuestack_framework_plan.md`
- [X] T054 [US2] **I1.** Add the transform and filter properties to `test/agreement.test.ts`'s compared set and an effect-bearing fixture to `test/harness/lessons.ts`, then sample densely through both effects' windows. SC-005 names effects and the suite compared geometry and opacity over effect-free lessons. **It immediately found `highlight` and `dim` silently inert**: `packages/element/src/frame.ts` wrote no `--cs-brightness`/`--cs-blur` and `styles.ts` had no `filter` declaration — fixed in both, with the reduced-motion mirror extended to match
- [X] T055 [US2] **I2.** Add a mid-transition lesson to `test/a11y.test.ts`'s axe loop — every existing lesson was single-slide, so the one moment two full stages coexist was never audited. Passes; assert also that only the *outgoing* half is `aria-hidden`, because hiding both would silence the lesson for the length of every slide change
- [X] T056 **I3.** Write `packages/element/test/perf/frame.test.ts` and add it to `tools/scripts/gates/perf.mjs`. plan.md's Principle IV row said "no budget is touched", written before transitions made a slide change deep-clone a stage. **The wall-clock half has ~9x headroom** — measured after 40 extra clones per slide change failed to trip it — so the assertion carrying the weight is the invariant beside it: structure built once per element, never per frame, checked by node identity and confirmed by a control that rebuilds
- [X] T057 [US2] **J1.** Adopt canvas-relative layout in `packages/element/src/styles.ts` — `container-type: size`, `aspect-ratio` from the canvas, and every coordinate as a proportion via container-query units, matching `react/src/styles/stage.css` character for character. `frame.ts` gains `canvasPropertiesFor` (the six-number `CANVAS` map duplicated per research R-01) and `LessonElement` writes `--cs-canvas-w/h` on the stage before the first frame. **The transform order was backwards in a first pass** — scale then rotate, not rotate then scale; transforms do not commute
- [X] T058 [US2] **J2.** Write `--cs-rotation` in `frame.ts`'s `geometryOf` and apply it in the stylesheet. Authored rotation rendered flat. Missed by T054's own remediation, which added the *effect* transform properties and stopped — geometry rotation is a different property with a nearly identical name
- [X] T059 [US2] **J4.** Compare **evaluated layout**, not CSS inputs, in `test/agreement.test.ts` — importing the evaluator `packages/react/test/harness/css.ts` already provides. Three controls run: fixed-pixel layout (caught), wrong divisor with right unit (caught), and divisor-and-unit swapped together (**not** caught, and correctly — it is an algebraic identity when the stage ratio is derived from the canvas)
- [X] T060 [US2] **J3.** Write `packages/element/test/reference-lesson.test.ts` — play `examples/nextjs/app/tour.ts` end to end, the manifest nobody wrote for this adapter. SC-004 asked for exactly this and every fixture until now was hand-made here, which is the shape that hid FR-010
- [X] T061 [US2] **K1 + K2.** Correct `packages/element/README.md` — `autoplay` in the opening example with the sentence explaining why it is not decoration, and a complete API surface: attributes (`src`, `autoplay`), properties, the three methods, and all four events with their detail shapes. The example was verified by executing it, not by reading it
- [X] T062 [US2] **K3 + K4.** Say in the README that `ports` is a test seam rather than part of an integration, and correct `data-model.md`'s "no ports" — accurate in spirit, inaccurate in print, since the property is settable. Add the `autoplay` step to `quickstart.md` §1's described sequence, which the harness performs and the prose omitted
- [X] T063 [US2] Write `packages/element/test/documented.test.ts` — **the first check in this package that runs code → documents.** Public methods, settable properties, `observedAttributes` entries and dispatched events are read out of `LessonElement.ts` and required to appear in the README, and the opening example must autoplay or call `play()`. Three controls run: removing `autoplay` from the example, undocumenting `seekToSlide`, and undocumenting an event — all three fail it
- [X] T064 **L1.** Correct `packages/react/README.md`'s opening example — `PlaybackControls` inside the player, and the three ways playback can begin stated plainly. **Not** by adding `autoPlay`, which would contradict the prop's documented rationale (audible media needs a gesture). Verified by running the corrected example: three controls render, pressing play advances the lesson
- [X] T065 **L2.** Write `tools/scripts/__tests__/readme-examples.test.ts` — every package README plus the root: a first code block that puts a player on a page must show what starts it. **The class-level fix for a defect found twice in two packages a pass apart**, after the first fix was scoped to one package. Later blocks are exempt as fragments, and the document must say so
- [X] T066 [US2] **L3.** Document `COVERED`, `NOT_COVERED` and `covers()` in `packages/element/README.md`, with the pre-embed check they exist for, and widen `test/documented.test.ts` from members to exports — skipping type-only ones, since a type alias has nothing a README row can add
- [X] T067 **M1 + M2.** Remove the volatile counts from `plan.md` and `docs/cuestack_framework_plan.md` — "61 tests", "53 tasks", "2770 across the workspace", "twenty-three findings", "4 of 30 code blocks". **Every one was true when written and false within the same session**, in the documents recording this feature's fight against exactly that. What survives is counts that mean something when they move (the coverage threshold) or carry an argument (the analysis-pass count, because yield tracked distinct questions rather than passes)
- [X] T068 **M3.** Write `tools/scripts/__tests__/readme-api.test.ts` — the repo-wide half of `packages/element/test/documented.test.ts`, which stayed scoped to one package after finding a defect there. Surfaces are **declared**, not guessed: a blanket export rule was measured and rejected (ninety false positives in the editor alone). `@cuestack/adapter-http` was added, failed, and removed — its README disclaims completeness in bold, so it is not a reference. Scoped to table rows after the first draft passed its own negative control
- [X] T069 [US2] **N1.** Add a pause-then-resume test to `test/api.test.ts` exercising the `#announcedStart` guard. The existing `toHaveLength(1)` passed with the guard deleted — `play()` was called once in that test's lifetime, so it proved one-call-one-event and never repeated-calls-one-event
- [X] T070 [US2] **N2.** Remove `#announcedComplete` from `src/LessonElement.ts` and assert that a replayed lesson completes again. **Not cleanup — a defect**: the flag read as redundant over the kernel's per-instance decision, and was live for exactly the case it got wrong. Seeking back bumps the visit count, the kernel decides again, and the flag swallowed the second completion. A host counting completions lost every repeat
- [X] T071 [US2] **O1 + O2 + O3.** Derive the problem notice from state each frame in `src/LessonElement.ts` instead of appending once and deduping with a `Set` — the notice followed a learner onto slides with no question, and a returning learner was told nothing. Clear on slide entry so a revisit reports again. Follows `LessonPlayerClient`'s `reportedCode`/`setUnreachable(null)` shape, which is why the declarative player cannot have this bug
- [X] T072 [US2] **The sweep.** Twelve deliberate breakages against the suite; six passed. Write `packages/element/test/stage.test.ts` — `container-type`, `aspect-ratio`, `overflow`, the `--cs-canvas-w/h` writes, `data-cs-element-type`, and both transition halves' duration. All six now fail when broken. Shared values are compared against `react/src/styles/stage.css` rather than restated, so a change there fails here
- [X] T073 [US1] **P1.** Write `packages/react/test/fixtures/guide-example/renderer.test.tsx` and `packages/studio/test/fixtures/guide-example/editor.test.ts` — SC-013 asks the guide's example be *exercised*, and two of its four pieces were type-checked and never run. The renderer is now registered, drawn, given a payload it did not expect, and given a `<script>`; the editor is registered, found in the Add menu's type list, and checked for the field-list duplication the guide warns against. Four controls run: a renderer that throws at draw time, one that assembles markup, an editor defaulting a payload the type would reject, and one restating its fields
- [X] T074 [US2] **Q1.** Extract `packages/element/src/ports.ts` and give the default visibility port a real `visibilitychange` subscription, mirroring `react/src/player/browserPorts.ts`. The inline default was inert, so a backgrounded tab never paused the lesson while the React player's did — measured at five seconds hidden: slide one with a subscription, slide two without
- [X] T075 [US2] **Q2.** Write `packages/element/test/ports.test.ts` — the path every real host takes and no test had ever run, because all of them inject `ports` for a hand-driven clock. Covers monotonic time, hidden reporting, subscribe/unsubscribe, an element mounted with no ports at all, and parity with the player's source. Three controls run; the third needed comments stripped before it would bite
- [ ] T043 **(outstanding — requires a person, cannot be done by the implementing agent)** Put both documents in front of somebody who has not worked on this codebase, and record what they could not do. **SC-001**: given `docs/authoring-elements.md`, they add an element type with no change to the kernel. **Ask them first whether they read themselves as able to change `@cuestack/schema`** — and record which answer they gave, because the guide succeeds or fails differently for the two readers and a tester who happens to be an in-repo contributor would not notice the wall the other one hits. **SC-011**: given `docs/packages.md`, they name the package they would install for a stated goal, and answer the three questions without being told — does this ship a backend, does it run a server, must I use its editor. Both halves record every question the documents did not answer; that list is the more useful output and belongs in the pull request

---

## Dependencies & Execution Order

```text
Phase 1 (Setup)
   ├──► Phase 3 (US1 — the guide)     ── shippable alone, MVP
   │       └──► Phase 5 (US3 — the documentation)   ── content-dependent, see below
   └──► Phase 2 (the covered set)
           └──► Phase 4 (US2 — the adapter)
```

**US2 is independent of US1 and US3.** They share no files, so one developer can take the adapter while
another takes the guide.

**US3 follows US1 for a reason that is not a file dependency.** Writing a guide precisely is the
mechanism that finds what else is untrue — `ElementEditor`'s stale header is one instance already
confirmed, and research R-09 expects the list to grow. T036 collects that list, so it cannot be
written before T015.

**A correction to the plan.** [plan.md](./plan.md)'s Phase 2 note says "the guide is written last",
which contradicts US1 being the P1 MVP and is wrong. The accurate ordering is above: the guide comes
first and US3's corrections are its *output*. The adapter is independent of both.

**T044–T049 sit out of numeric order inside US2, deliberately.** They were added after the feature
shipped, from two audits — FR-010 read back against the adapter, then the contract read back clause by
clause — and renumbering the phase to hide that would erase the only record of how they were found.
Their position in the phase is where the work belongs; their numbers are when it was discovered.

**Inside US2, `covered.ts` comes before the renderers.** T026 and T027 both read it, and an adapter
where the renderer list and the unavailable path disagree produces a blank rectangle nobody can
explain.

## What this list got wrong, and how it was found

Two audits after implementation, both asking *is each thing that was promised actually here* rather
than *is anything wrong with what was written*:

| Audit | Found | Why the earlier passes missed it |
|---|---|---|
| `spec.md`'s FR list vs. the adapter | FR-010's slide playback and transitions; FR-017's server-rendering statement | The requirement was absent from plan and tasks, so there was no wrong-looking artifact to analyse. It sat in `contracts/element-adapter.md` under Covered the whole time |
| `contracts/element-adapter.md` clause by clause vs. `packages/element/src/` | §2's `src` and `autoplay`, §3's three methods, three of §4's four events | T023 named every one of them and was marked complete against a test file that tested registration, the manifest property, and disconnect |

Eight `/speckit-analyze` passes over spec, plan, and tasks found twenty-three findings and neither of
these. The requirement half is now mechanical — `tools/scripts/__tests__/plan-coverage.test.ts` — and
the contract half is still a reading, recorded as T053.

## Parallel opportunities

**Phase 1** — T002, T003, and T004 are three separate files; T005 waits on T001.

**Phase 3** — T008, T009, T010 are three independent test files.

**Phase 4** — T017 through T023 are seven independent suites, the largest fan-out in the feature, and
T024/T025 are two independent modules.

**Across phases** — one developer takes US1 then US3; another takes Phase 2 then US2. They meet only
at the root configuration files, all touched in Phase 1.

## Implementation strategy

**MVP is Phase 1 + Phase 3.** Sixteen tasks, and it ships without a line of the adapter: the guide
serves the people already here, and a developer who can add an element type is what Goal 5 has been
claiming for eleven features without anybody outside the project testing it.

**Then Phase 2 + Phase 4**, the adapter, which is where the disprovable claim lives.

**Then Phase 5**, whose content is the first phase's output.

**Test-first throughout, with one unusual case.** FR-006 makes the guide's example *a test* rather
than a prose sample. That is not decoration: `ElementEditor`'s header has described a framework that
stopped existing two features ago, and the audience for a guide is by definition the people who cannot
tell it is wrong.

**T042 is not optional.** Six of this feature's guarantees pass by accident if nobody checks: an image
rendering with no resolver, a frame loop outliving its element, a question rendered instead of
reported, a shadow root that blocks the theme, a snippet checker that passes when it finds nothing,
and a guide example missing a contract member. Every one of those leaves the rest of the suite green.

**T040 is the feature's actual deliverable.** DX-2 exists to establish whether the kernel is
framework-agnostic. Phase 0 already answered "yes, and the packaging is not" — the rest of the
findings arrive while the adapter is built, and a version of this feature that recorded none would be
the surprising outcome rather than the good one.
