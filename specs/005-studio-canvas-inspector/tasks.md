---

description: "Task list for Studio Canvas and Properties Inspector (Wave 4, ED-1 + ED-2)"
---

# Tasks: Studio Canvas and Properties Inspector

**Input**: Design documents from `/specs/005-studio-canvas-inspector/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks ARE included and are mandatory. Constitution II is NON-NEGOTIABLE. Every
contract in `contracts/` ends with a Test Obligations section, and those obligations are tasks here
rather than a promise made in a document nobody re-reads. Each test lives in the story whose
behaviour it proves, so a story's checkpoint means what it says.

**Organization**: Grouped by user story so each is independently implementable and testable.

**Revision**: amended after four `/speckit-analyze` passes.

1. Found one CRITICAL and five HIGH: FR-046 (sanitization) had zero tasks; FR-002 (multi-select) was
   tested but never implemented; copy had no state to write to; and the rule-coverage task was built
   on a false premise.
2. Checked the first pass's own work and found four inconsistencies it had introduced.
3. Found duplicate test coverage both earlier passes had missed — the same hidden-element assertion
   in three files, and a rendered paint-order check sitting in the no-DOM project *and* duplicating
   another task.
4. Audited two dimensions nobody had checked: the spec's fourteen edge cases, and the contracts' own
   Test Obligations. Three edge cases had no task, and `ElementPlugin.validate` turned out to have no
   consumer while three documents implied it did.

Task IDs were renumbered three times as a result. **This list is T001–T117; any reference to earlier
numbering is stale.**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete work)
- **[Story]**: US1–US4 from spec.md
- Exact file paths are included in every task

## Path Conventions

New package: `packages/studio/src/{draft,geometry,canvas,inspector,registry,session,styles}/` and
`packages/studio/test/{draft,geometry,canvas,inspector,registry,rules,session,keyboard,parity,a11y,perf,usability,harness}/`.
Touched elsewhere: `packages/core/src/elements/contract.ts` (one additive change, US2),
`tools/scripts/`, `.dependency-cruiser.cjs`, `eslint.config.js`, `vitest.config.ts`,
`.github/workflows/ci.yml`.

## Six sequencing notes

**The kernel does not change, and that is what makes this feature smaller than it looks.**
`resolve()` is used exactly as the player uses it (research R-01). Exactly one task below modifies
`@cuestack/core`, and it adds a member to `InspectorField` — authoring metadata that no manifest
serializes and no playback path reads. If a second core change appears during implementation, that
is a signal the design drifted, not a task that was missed.

**The geometry engine runs with no DOM, and that is enforced by configuration rather than by
discipline.** happy-dom computes no layout — a `<div>` with `width: 800px` reports a bounding rect
of zero, measured in this repo (research R-04). So `packages/studio/test/{geometry,draft}` get their
**own vitest project in the `node` environment**, where a `document` is not merely discouraged but
absent. A geometry test that starts needing a browser fails to run rather than quietly growing a
dependency on a layout engine that reports zeros. Any other pure module opts in by naming its suite
`*.pure.test.ts` — purity is a property of a module rather than of a directory, and `session/` holds
both a React hook that needs a DOM and the selection algebra that must not.

**The gates land in Phase 1, before there is anything for them to catch.** `check-studio-isolation`
passes trivially against an empty package and keeps passing; adding it in Polish would leave the
boundary it protects unguarded for the whole feature. This is the reasoning IN-2 used for the
original seven gates — "the job exists from day one so adding the check is a one-line diff". The
sanitization lint ban (T009) lands here for the same reason: it is a lock on a door that is currently
shut, and the moment to fit it is before anyone opens it.

**The `Edit` union grows story by story, and one test grows with it.**
`packages/studio/test/draft/read-only.test.ts` enumerates the union and asserts every variant is
refused (SC-017). Each story that adds a variant updates that test in the same task, or the guarantee
silently narrows to "the variants that existed when it was written".

**BR-010 and BR-011 are already covered for the kernel, and the rule gate cannot currently see this
package.** `check-rule-coverage.mjs` already lists both in `EXPECTED` against `core`, and
`packages/core/test/rules/BR-{010,011}.test.ts` already exist — the gate reports 12 of 18 rules
covered today, including both. What this feature adds is the *editor* half of each rule, and the
gate's scan list is hardcoded to `['schema','core','react','element']`, so a test placed in
`packages/studio/test/rules/` is invisible to it. T088 adds `'studio'` to that list. The gate permits
a rule found in more than one package, so the studio tests join the kernel's rather than replacing
them. **An earlier draft of this list asked for BR-010 and BR-011 to be added to `EXPECTED`; they
were already there, and that task has been deleted.**

**US1 is large, and deliberately not split.** It carries adding, text editing, transforms, snapping,
alignment, selection, the authoring-time scrub, and ghosts — because the spec's Independent Test for
US1 is "start from an empty slide and compose one", and a story that cannot do that is not the MVP.
If US1 needs to be cut, cut alignment and distribution (T028, T044, T052) first: they are
FR-CAN-007's second half and nothing else depends on them.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The package, its test projects, and its boundary gates. No feature code.

- [X] T001 Create the package scaffold at `packages/studio/{package.json,tsconfig.json,tsdown.config.ts}` per `contracts/studio-package-api.md` — exports map with **no `react-server` condition**, dependencies on `@cuestack/{react,core,schema}`, React 19 as a peer, and `sideEffects: ["./dist/styles.css"]`
- [X] T002 Add the DOM test project `@cuestack/studio` to `vitest.config.ts` — `environment: 'happy-dom'`, `include: ['test/**/*.test.{ts,tsx}']`, excluding `test/{geometry,draft}` and `**/*.pure.test.ts`, both of which T003 claims
- [X] T003 Add the **node-environment** test project `@cuestack/studio-pure` to `vitest.config.ts` covering `test/{geometry,draft}/**` **and `test/**/*.pure.test.ts`**, so those suites run with no `document` at all (research R-04). The filename marker is what lets a pure module living beside a DOM-bound one — the selection algebra beside `useEditorSession` — be held to the same standard as `geometry/`
- [X] T004 [P] Add `packages/studio/src/**/*.{ts,tsx}` to the coverage `include` list in `vitest.config.ts` — reported, with no numeric floor, per Constitution II's rule for UI packages
- [X] T005 [P] Add the `no-studio-in-player` rule to `.dependency-cruiser.cjs` forbidding anything under `packages/{react,core,schema}/src` from reaching `@cuestack/studio`, and add `studio` to the target lists of the existing `no-core-in-schema` and `no-adapters-in-core` rules
- [X] T006 [P] Add the `dom-measurement-confined` rule restricting `getBoundingClientRect`, `offsetWidth`, and `clientWidth` reads to `packages/studio/src/canvas/pointer.ts`, with a comment naming research R-04 as the reason. **Landed in `tools/eslint-config/index.js`, not `.dependency-cruiser.cjs` as this task originally specified**: dependency-cruiser reasons about the module graph, and this restricts *identifiers* — expressed as a graph rule it would have forbidden `Overlay.tsx` from importing `pointer.ts`, which is the one import the design requires. `.dependency-cruiser.cjs` carries a comment saying where it went and why
- [X] T007 [P] Create `tools/scripts/check-studio-isolation.mjs` mirroring `check-core-isolation.mjs` — pack `@cuestack/{react,core,schema}`, install into an empty directory with studio absent from disk, render a lesson — plus the `check:studio-isolation` script in the root `package.json` and a step in the `packaging` job of `.github/workflows/ci.yml`
- [X] T008 [P] Extend `tools/scripts/gates/theme-values.mjs` to scan `packages/studio`, so the armed gate cannot pass by not looking. **Note the gate's current reach**: it runs eslint over `packages/react/src/elements` only, so it checks TS/TSX and not CSS — colour literals in `packages/studio/src/styles/editor.css` are outside any gate. Extending it to studio's components is in scope here; building CSS colour checking is not, and is recorded as an open issue in the analysis pass
- [X] T009 [P] Add a workspace lint rule to `eslint.config.js` banning `dangerouslySetInnerHTML` across `packages/**` (FR-046, NFR-SEC-007). research R-11 verified the prop appears nowhere today, so sanitization holds by construction; the risk is the next renderer reaching for `innerHTML` under deadline. A lint rule fails that at review, and an unused sanitizer in the tree would not
- [X] T010 [P] Create the deterministic id source and studio fixtures at `packages/studio/test/harness/{ids.ts,corpus.ts}` — a counter-based `IdSource`, plus slides for: an element outside its window at both ends, a hidden element, a locked element, overlapping elements with equal `zIndex`, one element of each of the seven MVP types, an element whose text contains markup, and an empty slide
- [X] T011 Verify the negative controls for T005–T009 in one sitting, reverting each: a forbidden import in `packages/react/src/index.ts` must fail `.dependency-cruiser.cjs`'s `no-studio-in-player`; a stray `getBoundingClientRect` in `packages/studio/src/geometry/transform.ts` must fail `dom-measurement-confined`; a `@cuestack/studio` entry in `packages/react/package.json` must fail `tools/scripts/check-studio-isolation.mjs`; a `dangerouslySetInnerHTML` in `packages/studio/src/canvas/Overlay.tsx` must fail `eslint.config.js`. A gate never seen failing is documentation

**Checkpoint**: `pnpm test`, `pnpm lint`, `pnpm gates`, and `pnpm check:studio-isolation` all green against an empty package.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The reducer every mutation passes through, the session every surface reads, and the
canvas shell every story renders into.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests

- [X] T012 [P] Purity and immutability tests for `applyEdit` in `packages/studio/test/draft/purity.test.ts` — the input draft is never mutated, a refused edit returns no draft, and identical inputs with an identical `IdSource` produce identical output
- [X] T013 [P] Read-only refusal test in `packages/studio/test/draft/read-only.test.ts` — enumerate every `Edit` variant and assert each returns `{ ok: false, reason: 'read-only' }`. **This file is updated by every story that adds a variant** (sequencing note 4)
- [X] T014 [P] Post-edit validity test in `packages/studio/test/draft/validity.test.ts` — every accepted edit's result passes `validate()` from `@cuestack/schema/validate` (FR-045)
- [X] T015 [P] Session invariant tests in `packages/studio/test/session/session.test.ts` — selection only holds ids present on the slide, authoring time clamps to `[0, durationMs]`, changing slide or selection clears `textEditing` after committing it

### Implementation

- [X] T016 Define the `Edit` union, `EditContext`, `EditResult`, and `EditRefusal` types in `packages/studio/src/draft/edit.ts` per `contracts/edit-contract.md` — all twelve variants declared now, so the read-only test can enumerate them, even though most are implemented in their own stories
- [X] T017 [P] Implement `IdSource` and the `crypto.randomUUID()` default in `packages/studio/src/draft/ids.ts` (FR-050)
- [X] T018 Implement the reducer frame in `packages/studio/src/draft/reducer.ts` and `packages/studio/src/draft/guard.ts` — the read-only refusal, the post-edit `validate()` call, and the locked-element skip, with per-variant handlers dispatched to and left unimplemented until their stories. **The `set-flag` exception belongs here**: the locked guard must not block an edit that unlocks, or a locked element can never be recovered (`contracts/edit-contract.md`)
- [X] T019 Implement `useEditorSession` in `packages/studio/src/session/useEditorSession.ts` holding `draft`, `slideId`, `selection`, `authoringTime`, `mode`, `textEditing`, and `clipboard` per data-model.md §2
- [X] T020 [P] Define `ElementEditor`, `ElementDefaults`, `TextSurface`, and `createElementEditorRegistry` in `packages/studio/src/registry/editors.ts` per `contracts/element-editor-contract.md`, refusing incomplete registrations at registration time as `createRendererRegistry` already does
- [X] T021 Implement the canvas shell in `packages/studio/src/canvas/EditorCanvas.tsx` — `Stage` and `SlideView` from `@cuestack/react`, called with exactly the props the player passes, plus an `Overlay` sibling. No editor prop crosses into the render layer (`contracts/overlay-contract.md` rule 2)
- [X] T022 [P] Create `packages/studio/src/canvas/Overlay.tsx` as the empty affordance layer each story fills, and `packages/studio/src/styles/editor.css` with chrome sized in absolute units and every colour a theme token with a readable fallback (`contracts/overlay-contract.md` rules 5 and 6)
- [X] T023 Wire the public entry `packages/studio/src/index.ts` with what exists so far, per `contracts/studio-package-api.md`

**Checkpoint**: The canvas renders a slide through the player's renderer, the reducer refuses everything in read-only mode, and no story behaviour exists yet.

---

## Phase 3: User Story 1 — A teacher composes a slide (Priority: P1) 🎯 MVP

**Goal**: Start from an empty slide; add elements, type into them, select and arrange them, and scrub
the slide's authoring time.

**Independent Test**: Add three elements to an empty slide, type into one, drag/resize/rotate
another, move the authoring time, then render the manifest through the learner player and confirm
every element lands at the authored position and appears at the authored moment.

### Tests for User Story 1 ⚠️

- [X] T024 [P] [US1] Transform tests in `packages/studio/test/geometry/transform.test.ts` — move, resize, and rotate in logical units; extents clamp positive rather than producing a manifest the schema rejects (FR-007); rotation leaves stored `x`/`y` untouched; and **geometry outside the canvas bounds is permitted and never clamped back** — an element may legitimately start off-stage and slide in, so a clamp here would break a pattern the format supports (spec Edge Cases #1)
- [X] T025 [P] [US1] Display-size independence test in `packages/studio/test/geometry/scale-free.test.ts` — the same logical delta yields the same geometry with no display size supplied, because the engine is never told one (FR-004, FR-009, SC-009)
- [X] T026 [P] [US1] Snap boundary tests in `packages/studio/test/geometry/snap.test.ts` — an edge 7 units away snaps, one 9 units away does not, `SNAP_THRESHOLD_UNITS` of 0 disables snapping, and a snapped edge differs from its candidate by exactly zero (FR-005, SC-009)
- [X] T027 [P] [US1] Snap candidate tests in `packages/studio/test/geometry/candidates.test.ts` — sibling edges and centres and the canvas's edges and centre are all candidates; a rotated element's candidates come from authored geometry, not visual bounds
- [X] T028 [P] [US1] Alignment and distribution tests in `packages/studio/test/geometry/align.test.ts` — align needs ≥2 and distribute ≥3; below those the operation is `'unsupported'` rather than a silent no-op (FR-006)
- [X] T029 [P] [US1] `add-element` reducer tests in `packages/studio/test/draft/add.test.ts` — each of the seven MVP types produces a valid element, consumes exactly one id, lands inside the canvas, receives a `zIndex` above the current maximum, and spans the slide's duration so it is visible at any authoring time (FR-013, FR-014, SC-011)
- [X] T030 [P] [US1] `transform-elements` reducer tests in `packages/studio/test/draft/transform-edit.test.ts` — a multiple selection moves as a unit preserving spacing; a locked member is skipped and reported while unlocked members move; a selection of only locked elements refuses (FR-003, FR-008)
- [X] T031 [P] [US1] `set-text` reducer test in `packages/studio/test/draft/text.test.ts` — text is written through the type's `textSurface` with no branch on element type, and `write(payload, read(payload))` is the identity for every type declaring one (FR-015)
- [X] T032 [P] [US1] Selection model tests in `packages/studio/test/session/selection-model.pure.test.ts` — additive selection accumulates, re-selecting a selected element removes it, clearing empties the selection, selection order is preserved, and a locked element is selectable (FR-001, FR-002, FR-008). The `.pure.test.ts` name puts this in the node project, so T048's purity claim is enforced rather than asserted
- [X] T033 [P] [US1] Pointer adapter tests in `packages/studio/test/canvas/pointer.test.ts` — screen deltas convert to logical deltas against an **injected** scale, exercising the adapter without depending on a layout engine that reports zeros
- [X] T034 [P] [US1] Authoring-time tests in `packages/studio/test/canvas/authoring-time.test.ts` — the canvas renders `resolve(slide, t)` at the scrub's value, defaults to the slide's start, and clamps to the slide duration (FR-010, FR-012)
- [X] T035 [P] [US1] Out-of-view affordance tests in `packages/studio/test/canvas/out-of-view.test.ts` — an element outside its window at either end and a hidden element each produce a selectable, labelled ghost carrying the right reason; a ghost invokes no element renderer (FR-011, research R-02); and an element positioned outside the canvas bounds is indicated as such while remaining selectable (spec Edge Cases #1). One suite, because these are one category: the editor showing you something the learner will not see, whether the reason is time, visibility, or position
- [X] T036 [P] [US1] Text-edit fidelity test in `packages/studio/test/canvas/text-surface.test.ts` — the edit surface and the committed element resolve to the same typography class and the same box, so committing changes no visible metric. **This is the bound on the one declared Constitution V deviation** (FR-017, research R-05)
- [X] T037 [P] [US1] Sanitization test in `packages/studio/test/canvas/sanitization.test.ts` — text containing markup, entered through the canvas text surface and through the inspector, renders as text and never as elements, on the editor path **and** on the player path (FR-046, NFR-SEC-007)
- [X] T038 [P] [US1] Geometry parity test in `packages/studio/test/parity/geometry.test.ts` — for all seven MVP types, position, size, rotation, and paint order are identical in a player render and an editing-canvas render (FR-042, SC-003)
- [X] T039 [P] [US1] Resolved-state parity test in `packages/studio/test/parity/state.test.ts` — at several times within each slide, the state the canvas shows at authoring time *t* matches the player's state at the same *t* (SC-004)
- [X] T040 [P] [US1] Overlay isolation test in `packages/studio/test/parity/overlay.test.ts` — the DOM inside `.cs-stage` is identical with the overlay mounted and unmounted, and no ghost markup appears in a player render of the same manifest (FR-043)

### Implementation for User Story 1

- [X] T041 [P] [US1] Geometry types and named constants in `packages/studio/src/geometry/{types.ts,constants.ts}` — `SNAP_THRESHOLD_UNITS` 8, `NUDGE_UNITS` 1, `NUDGE_UNITS_COARSE` 10, each with its bounds documented per data-model.md §5
- [X] T042 [US1] Implement `moveBy`, `resizeBy`, and `rotateBy` in `packages/studio/src/geometry/transform.ts` — logical units in and out, no DOM
- [X] T043 [US1] Implement snap candidate collection and resolution in `packages/studio/src/geometry/snap.ts`
- [X] T044 [US1] Implement `align` and `distribute` in `packages/studio/src/geometry/align.ts`
- [X] T045 [US1] Implement the `add-element`, `transform-elements`, `set-text`, `align`, and `distribute` handlers in `packages/studio/src/draft/reducer.ts`, and add their cases to `packages/studio/test/draft/read-only.test.ts`
- [X] T046 [US1] Register all seven MVP element editors in `packages/studio/src/registry/editors.ts` — `defaults` for every type, `textSurface` for `text` and `button`, with a test enumerating the registry against `ELEMENT_TYPES` from the schema so a future type fails until registered
- [X] T047 [US1] Implement the pointer adapter in `packages/studio/src/canvas/pointer.ts` — the only module that measures anything, reading the stage's rendered size once per gesture and converting to logical deltas
- [X] T048 [P] [US1] Implement the selection algebra in `packages/studio/src/session/selection.ts` — add, toggle, replace, clear — pure and independent of pointer handling, so multi-selection is testable without a browser (FR-002)
- [X] T049 [US1] Implement drag, resize, and rotate gestures in `packages/studio/src/canvas/Overlay.tsx` with handles, writing `--cs-x` and `--cs-y` directly to the element node during the gesture and committing one edit on release (research R-10, SC-001)
- [X] T050 [US1] Implement selection interaction and indicators in `packages/studio/src/canvas/Overlay.tsx` — click to select, modifier-click to add or remove, drag on empty canvas to marquee-select, click empty canvas to clear — plus snap guide rendering (FR-001, FR-002, FR-005)
- [X] T051 [US1] Implement the out-of-canvas indication in `packages/studio/src/canvas/Overlay.tsx` — an element whose authored geometry falls wholly or partly outside the canvas is marked as such and is **not** clamped back inside. Permitted, not prevented: an element may legitimately start off-stage and slide in, and the obvious implementation — clamp to bounds — silently breaks that (spec Edge Cases #1)
- [X] T052 [US1] Implement alignment and distribution controls in `packages/studio/src/canvas/Overlay.tsx`, unavailable rather than inert below their minimum selection sizes
- [X] T053 [P] [US1] Implement `packages/studio/src/canvas/Ghost.tsx` — outlined, labelled, selectable, focusable, stating why the element is not rendered
- [X] T054 [P] [US1] Implement `packages/studio/src/canvas/TextEditSurface.tsx` carrying the renderer's class name so typography comes from `stage.css` rather than from this component (research R-05)
- [X] T055 [US1] Wire the authoring-time scrub control into `packages/studio/src/canvas/EditorCanvas.tsx`, resolving the slide at the session's authoring time
- [X] T056 [US1] Implement the Add menu in `packages/studio/src/canvas/Overlay.tsx`, offering every registered type and selecting what it adds
- [X] T057 [US1] Emit the element-insertion authoring event through the optional `AnalyticsAdapter` in `packages/studio/src/draft/reducer.ts` — `LessonEvent` has no field a learner identifier could occupy, so FR-048's privacy clause holds by construction. **This required a second change to `@cuestack/core`**, which sequencing note 1 says to treat as a signal: `LessonEvent.kind` modelled playback only, so FR-AN-001's declared authoring events had nothing to emit. Added `element_inserted` and an optional `elementType` rather than a parallel event type in the editor, because FR-AN-005 specifies one replaceable analytics adapter

**Checkpoint**: A teacher can compose a slide from an empty one, and the composed lesson plays back identically. US1 is independently demonstrable.

---

## Phase 4: User Story 2 — A teacher changes the selected element's settings (Priority: P2)

**Goal**: The inspector shows the settings that belong to the current selection, sourced from the
element type's registered plugin.

**Independent Test**: Select each of the seven MVP types in turn — programmatically, no dragging
needed — and confirm the panel shows that type's fields and no other type's; change one field of each
and confirm the manifest reflects it.

### Tests for User Story 2 ⚠️

- [X] T058 [P] [US2] Plugin-sourced field tests in `packages/studio/test/inspector/fields.test.ts` — each of the seven types renders the fields its `ElementPlugin.inspector` declares and none belonging to another type, with zero branches on element type in the inspector (FR-018, SC-010)
- [X] T059 [P] [US2] `list` field kind test in `packages/studio/test/inspector/list-kind.test.ts` — a question's options render, add, and remove as a repeating group (FR-019, research R-06)
- [X] T060 [P] [US2] Commit isolation test in `packages/studio/test/draft/set-field.test.ts` — committing a field updates that element and leaves every other element byte-identical (FR-020)
- [X] T061 [P] [US2] Rejected-value test in `packages/studio/test/inspector/rejection.test.ts` — a value the schema refuses produces a message naming the problem, the element, and the recommended action, and the draft does not change (FR-023)
- [X] T062 [P] [US2] Inspector lifecycle test in `packages/studio/test/inspector/lifecycle.test.ts` — an edit in flight when the selection changes, or when the element behind it is deleted, is never written to a different element and never resurrects a deleted one (spec Edge Cases #12). T015 covers the canvas text surface's version; this is the inspector's, and the likelier one — a field holds focus while a keyboard shortcut deletes the selection
- [X] T063 [P] [US2] Slide settings test in `packages/studio/test/inspector/slide.test.ts` — with nothing selected the panel shows name, duration, background, transition, and accessibility, and **does not expose the advance mode** (FR-024)
- [X] T064 [P] [US2] Duration-reduction test in `packages/studio/test/draft/duration.test.ts` — cutting a slide's duration below an element's end leaves that element's authored values intact and clamps only the authoring time (FR-052)
- [X] T065 [P] [US2] Multiple-selection test in `packages/studio/test/inspector/multi.test.ts` — common settings shown, differing values indicated (FR-024)
- [X] T066 [P] [US2] Unknown-type test in `packages/studio/test/inspector/unknown.test.ts` — an element whose type has no registered plugin is selectable and shows the common settings, with its type reported as unrecognised (FR-026)
- [X] T067 [P] [US2] Scoped-access test in `packages/studio/test/inspector/scope.test.ts` — a plugin supplying fields receives only its own payload and the theme; no lesson, slide, or sibling is reachable (FR-025)
- [X] T068 [P] [US2] Accessibility metadata test in `packages/studio/test/inspector/alt-text.test.ts` — alt text is present for an image element without opening an advanced section, and captions appear where the type supports them (FR-021)

### Implementation for User Story 2

- [X] T069 [US2] Add the `list` kind to `InspectorField` in `packages/core/src/elements/contract.ts` with `of` and `minItems`, and export it from `packages/core/src/index.ts` — **the only change to `@cuestack/core` in this feature**. Additive to authoring metadata that no manifest serializes, so no `schemaVersion` bump (`contracts/element-editor-contract.md`)
- [X] T070 [P] [US2] Implement one field component per kind in `packages/studio/src/inspector/fields/` — `text`, `number`, `boolean`, `select`, `asset`, `colour`, `list` — each labelled, keyboard-operable, and reporting its value programmatically
- [X] T071 [P] [US2] Define the common field set every element type carries in `packages/studio/src/inspector/common.ts` — position, size, rotation, layer order, lock, hide, and timing (FR-022)
- [X] T072 [P] [US2] Define the slide field set in `packages/studio/src/inspector/slide.ts` — name, duration, background, transition, accessibility; advance mode deliberately absent
- [X] T073 [US2] Implement `packages/studio/src/inspector/Inspector.tsx` composing common fields, plugin fields, and the slide panel, with the unknown-type and multiple-selection cases
- [X] T074 [US2] Implement the `set-field` and `set-slide-field` handlers in `packages/studio/src/draft/reducer.ts`, and add their cases to `packages/studio/test/draft/read-only.test.ts`
- [X] T075 [US2] Implement the rejected-value message surface in `packages/studio/src/inspector/Inspector.tsx`, stating problem, object, and recommended action per NFR-USA-004

**Checkpoint**: Every MVP element type is fully editable through the inspector, including a question's options. US1 and US2 both work independently.

---

## Phase 5: User Story 3 — A teacher manages the elements on a slide (Priority: P3)

**Goal**: Layer order, lock, hide, duplicate, copy, paste, and a delete that asks first.

**Independent Test**: On a slide with overlapping elements, reorder them and confirm the render order
changes; hide one and confirm it is absent from playback but present in the draft; lock one and
confirm it resists transforms; delete one and confirm it cannot happen without confirmation.

### Tests for User Story 3 ⚠️

- [X] T076 [P] [US3] Layer order tests in `packages/studio/test/draft/reorder.test.ts` — moving an element forward or backward changes `zIndex` as expected, values stay distinct, and ordering stays deterministic when two elements share a `zIndex` (FR-027, FR-028). **Pure reducer assertions only**: this suite runs in the node project with no DOM, and the *rendered* comparison of editor paint order against player paint order belongs to T038, not to a second copy here
- [X] T077 [P] [US3] BR-010 test in `packages/studio/test/rules/BR-010.test.ts` — the **editor half** of the rule: a hidden element remains in the draft, is absent from `resolve()` and therefore from preview and playback, and stays visible-as-hidden and selectable on the canvas, where it can be unhidden (FR-029, FR-030, FR-031, SC-014). This absorbs what was a separate hidden-on-canvas suite — the same assertion had been spread across three tasks and three files, which is three places to update and two to forget
- [X] T078 [P] [US3] BR-011 test in `packages/studio/test/rules/BR-011.test.ts` — the **editor half** of the rule: a locked element is selectable, refuses transforms and text edits, renders normally, and **can be unlocked** (FR-008, FR-029, SC-014, and the `set-flag` exception from `contracts/edit-contract.md`)
- [X] T079 [P] [US3] Duplicate and paste tests in `packages/studio/test/draft/duplicate.test.ts` — each new element receives a distinct identity and a visible offset, and consumes exactly one id per element created (FR-032)
- [X] T080 [P] [US3] Copy and clipboard tests in `packages/studio/test/session/clipboard.test.ts` — copy captures **detached** copies, so editing or deleting the source afterwards does not change what pastes; copy performs no edit, leaving the draft byte-identical (FR-032, SC-007); and **in read-only mode copy succeeds while paste is refused** (FR-051). That last pair is the one the reducer cannot assert, because copy never reaches it (`contracts/edit-contract.md`)
- [X] T081 [P] [US3] Delete confirmation tests in `packages/studio/test/canvas/delete.test.ts` — nothing is removed without an explicit confirmation; the prompt names what will be removed; a multiple selection is confirmed **once** and states the count (FR-033, SC-013)
- [X] T082 [P] [US3] Selection-invariant test in `packages/studio/test/session/selection-lifecycle.test.ts` — deleting an element removes it from the selection in the same edit, so no id in the selection is ever absent from the slide. This is the deletion-specific case of the invariant T015 asserts generally; the overlap is deliberate, because deletion is the only operation that can break it from the *draft* side rather than the selection side

### Implementation for User Story 3

- [X] T083 [US3] Implement the `reorder`, `set-flag`, `duplicate`, `paste`, and `delete` handlers in `packages/studio/src/draft/reducer.ts`, and add their cases to `packages/studio/test/draft/read-only.test.ts`
- [X] T084 [US3] Implement copy as a **session action** in `packages/studio/src/session/useEditorSession.ts`, writing detached element copies into `session.clipboard`, from which `paste` draws its `elements` (data-model.md §2). Copy is deliberately not an `Edit` — it changes no authored data, and routing it through `applyEdit` would put it inside the surface SC-007 requires to be inert. The consequence is that read-only cannot be enforced for copy by the reducer, and must not be: copying in read-only is permitted, pasting is refused (FR-051)
- [X] T085 [P] [US3] Implement layer, lock, and hide controls in `packages/studio/src/canvas/Overlay.tsx`
- [X] T086 [P] [US3] Implement `packages/studio/src/canvas/DeleteConfirmation.tsx` — names what will be removed, states the count for a multiple selection, and is the only route to a `delete` edit
- [X] T087 [US3] Extend the hidden-element treatment in `packages/studio/src/canvas/Ghost.tsx` so `hidden` takes precedence over a time-window reason when both apply (data-model.md §7)
- [X] T088 [US3] Add `'studio'` to the hardcoded package list in `tools/scripts/check-rule-coverage.mjs` so `packages/studio/test/rules/` is scanned at all — without it, T077 and T078 are invisible to the gate. `EXPECTED` already declares BR-010 and BR-011 against `core` and both already have kernel tests there; the gate permits a rule found in more than one package, so the studio tests join rather than replace them. **Do not add these rules to `EXPECTED`** — they are already present (sequencing note 5)

**Checkpoint**: A slide's elements can be ordered, locked, hidden, duplicated, copied, pasted, and safely deleted. US1–US3 all work independently.

---

## Phase 6: User Story 4 — A teacher authors without a mouse (Priority: P4)

**Goal**: Every action in US1–US3, performed with no pointing device.

**Independent Test**: Perform the full compose-describe-manage flow with pointer events disabled.

### Tests for User Story 4 ⚠️

- [X] T089 [P] [US4] Traversal test in `packages/studio/test/keyboard/traversal.test.ts` — selection moves between elements in an order predictable from what is visible, including ghosts, and the current selection is announced (FR-034, FR-041)
- [X] T090 [P] [US4] Nudge test in `packages/studio/test/keyboard/nudge.test.ts` — an arrow key moves the element 1 logical unit and 10 with a modifier, in logical coordinates and with no scale involved (FR-035)
- [X] T091 [P] [US4] Action coverage test in `packages/studio/test/keyboard/actions.test.ts` — every action in US1–US3 is reachable by keyboard alone with pointer events disabled: add, select and multi-select, resize, reorder, lock, hide, duplicate, copy, paste, delete through the confirmation, enter and leave text-edit mode, and reach every inspector field (SC-005)
- [X] T092 [P] [US4] Shortcut suppression test in `packages/studio/test/keyboard/text-mode.test.ts` — typing `d` while editing text inserts `d` rather than duplicating the element (FR-016)
- [X] T093 [P] [US4] Scrub keyboard test in `packages/studio/test/keyboard/scrub.test.ts` — the authoring-time control is operable by keyboard and conveys its current value **with a subject**, not as a bare number (FR-037)
- [X] T094 [P] [US4] Focus management test in `packages/studio/test/keyboard/focus.test.ts` — the delete confirmation takes focus, is dismissible by keyboard, and returns focus predictably on both confirm and cancel (FR-039)
- [X] T095 [P] [US4] Announcement test in `packages/studio/test/keyboard/announce.test.ts` — a keyboard-driven change is conveyed to assistive technology, including the selection and the result of a transform (FR-040)

### Implementation for User Story 4

- [X] T096 [US4] Implement keyboard selection traversal and roving focus in `packages/studio/src/canvas/Overlay.tsx`, including keyboard multi-selection, with a visible focus indicator on every focusable affordance (FR-038)
- [X] T097 [US4] Implement arrow-key nudging in `packages/studio/src/canvas/Overlay.tsx`, calling the geometry engine directly rather than through the pointer adapter
- [X] T098 [P] [US4] Implement the shortcut map for copy, paste, duplicate, and delete in `packages/studio/src/canvas/shortcuts.ts`, suppressed entirely while `textEditing` is non-null (FR-036)
- [X] T099 [P] [US4] Implement the live region announcing selection changes and transform results in `packages/studio/src/canvas/Announcer.tsx`
- [X] T100 [US4] Add keyboard operation and value announcement to the authoring-time scrub in `packages/studio/src/canvas/EditorCanvas.tsx`
- [X] T101 [US4] Implement focus trapping and restoration in `packages/studio/src/canvas/DeleteConfirmation.tsx`

**Checkpoint**: The entire editor is operable from the keyboard. All four stories work independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T102 [P] Determinism replay test in `packages/studio/test/draft/determinism.test.ts` — an edit sequence replayed against the same starting manifest with the same injected `IdSource` produces a byte-identical manifest, and **fails** when the source is swapped for `crypto.randomUUID()` (SC-016)
- [X] T103 [P] Edit-sequence validity sweep in `packages/studio/test/draft/validity-sweep.test.ts` — a generated sequence of edits with `validate()` asserted after each, plus the negative control from quickstart §3: removing the extent clamp must turn this red (SC-012)
- [X] T104 [P] Session isolation test in `packages/studio/test/session/no-leak.test.ts` — a session that changes only selection, hover, authoring time, and clipboard leaves the manifest byte-identical (SC-007, FR-044)
- [X] T105 [P] Accessibility sweep in `packages/studio/test/a11y/axe.test.ts` — zero violations with a selection active, a ghost present, the text surface open, and the delete confirmation open (SC-006)
- [X] T106 Add editor budgets to `tools/scripts/gates/perf.mjs` against `tools/scripts/fixtures/heavy-lesson.mjs` — interaction feedback 100 ms, authoring-time change 100 ms, interactive at 50 slides / 300 elements 3 s, each with the 10% margin the constitution requires. The gate must state that it measures the editor's own work and not paint, because happy-dom has no compositor and a green line reads as a frame-rate claim
- [X] T107 Verify the T106 negative control — insert a 200 ms synchronous delay into the drag commit path in `packages/studio/src/canvas/Overlay.tsx`, confirm `tools/scripts/gates/perf.mjs` goes red, revert
- [X] T108 [P] Editor perf tests in `packages/studio/test/perf/editor.test.ts` covering SC-001, SC-002, and SC-018
- [X] T109 [P] Write `packages/studio/README.md` — what the package is, why it is separate from `@cuestack/react`, and the read-only mode a host maps roles onto
- [X] T110 [P] Add a `.changeset/studio-canvas-inspector.md` entry describing the new package and the additive `InspectorField.list` change to `@cuestack/core`
- [X] T111 Add the editor to `examples/nextjs` as a client-only route rendering `StudioEditor` over the existing tour lesson, proving the package is consumable the way a host consumes it
- [X] T112 Confirm the acceptance job in `.github/workflows/ci.yml` is **unchanged** and still named "A, B, C, F" — scenario D needs save recovery, which needs persistence, which is ED-5. Renaming it here would be the third time a gate in this project claimed more than it enforced
- [X] T113 Implement the read-only presentation in `packages/studio/src/canvas/Overlay.tsx` and `packages/studio/src/inspector/Inspector.tsx` — every affordance that would change the draft is disabled and states why, and the reason reaches assistive technology as well as the screen (FR-051). The reducer refusal (T018) is invisible to a Reviewer: without this half, read-only mode looks like a broken editor rather than a deliberate one
- [X] T114 [P] First-use interaction-count test in `packages/studio/test/usability/first-use.test.ts` — from an empty slide, adding an element, entering its text, sizing it, and setting alt text takes no more than **eight** discrete interactions, with no step requiring a submenu, a settings dialog, or documentation (SC-008). A countable proxy for NFR-USA-001, chosen because a first-use timing study is not something this project can run
- [X] T115 Run every command in `specs/005-studio-canvas-inspector/quickstart.md` exactly as written and fix what is wrong, in the document or in the code. Feature 004's equivalent pass found three commands matching no tests at all, one of which claimed to run an acceptance scenario it did not
- [ ] T116 **NOT DONE — requires a human with a screen reader.** Complete the nine-step manual keyboard and screen-reader pass at the end of `specs/005-studio-canvas-inspector/quickstart.md` and record what it found in that file
- [X] T117 Flip the plan glyphs for ED-1 and ED-2 in `docs/cuestack_framework_plan.md`, update the Next steps section, and record the two obligations this feature opened — the delete confirmation ED-5 owes a *removal* of, and the authoring-time control ED-3 owes a merge with

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T001 precedes T002–T004; the rest are parallel
- **Foundational (Phase 2)**: depends on Phase 1. **Blocks every user story**
- **US1 (Phase 3)**: depends on Phase 2 only
- **US2 (Phase 4)**: depends on Phase 2 only. Independent of US1 — its Independent Test sets selection programmatically
- **US3 (Phase 5)**: depends on Phase 2 only. T087 touches `Ghost.tsx`, which US1 creates, so it additionally waits on T053
- **US4 (Phase 6)**: depends on Phase 2, and on whichever of US1–US3 exist — it makes *their* actions keyboard-reachable, so T091's coverage is bounded by what has been built
- **Polish (Phase 7)**: depends on all desired stories

### Within Each Story

Tests are written and failing before implementation. Pure modules (`geometry/`, `draft/`,
`session/selection.ts`) before the components that call them. Overlay affordances after the engine
they drive.

### Parallel Opportunities

- Phase 1: T004–T010 all parallel after T001–T003
- Phase 2: T012–T015 parallel; T017, T020, T022 parallel with each other
- US1: T024–T040 are seventeen parallel test tasks — the largest parallel block in the feature
- US2: T058–T068 parallel; T070–T072 parallel
- US3: T076–T082 parallel
- US4: T089–T095 parallel
- Polish: T102–T105, T108–T110, and T114 parallel

### Files Touched by More Than One Task

Sequence these; they are where parallel work collides.

| File | Tasks | Note |
|---|---|---|
| `packages/studio/src/draft/reducer.ts` | T018, T045, T057, T074, T083 | The frame lands once; each story adds its handlers |
| `packages/studio/test/draft/read-only.test.ts` | T013, T045, T074, T083 | Grows with the `Edit` union, every time |
| `packages/studio/src/canvas/Overlay.tsx` | T022, T049, T050, T052, T056, T085, T096, T097 | The busiest file in the feature — consider splitting per affordance if contention bites |
| `packages/studio/src/canvas/EditorCanvas.tsx` | T021, T055, T100 | |
| `packages/studio/src/session/useEditorSession.ts` | T019, T084 | Clipboard arrives with copy |
| `packages/studio/src/canvas/Ghost.tsx` | T053, T087 | US3 extends what US1 creates |
| `packages/studio/src/canvas/DeleteConfirmation.tsx` | T086, T101 | |
| `packages/studio/src/registry/editors.ts` | T020, T046 | Contract, then registrations |
| `packages/studio/src/index.ts` | T023, and every story's exports | |
| `vitest.config.ts` | T002, T003, T004 | |
| `.dependency-cruiser.cjs` | T005, T006 | |
| `.github/workflows/ci.yml` | T007, T112 | |

---

## Parallel Example: User Story 1

```bash
# The seventeen US1 test tasks, all independent files:
Task: "T024 Transform tests in packages/studio/test/geometry/transform.test.ts"
Task: "T025 Display-size independence in packages/studio/test/geometry/scale-free.test.ts"
Task: "T026 Snap boundary tests in packages/studio/test/geometry/snap.test.ts"
Task: "T027 Snap candidates in packages/studio/test/geometry/candidates.test.ts"
Task: "T028 Align and distribute in packages/studio/test/geometry/align.test.ts"
Task: "T029 add-element in packages/studio/test/draft/add.test.ts"
Task: "T030 transform-elements in packages/studio/test/draft/transform-edit.test.ts"
Task: "T031 set-text in packages/studio/test/draft/text.test.ts"
Task: "T032 Selection model in packages/studio/test/session/selection-model.pure.test.ts"
Task: "T037 Sanitization in packages/studio/test/canvas/sanitization.test.ts"
# ... T033-T036, T038-T040 likewise

# Then the pure engine, in parallel:
Task: "T041 Geometry types and constants in packages/studio/src/geometry/{types,constants}.ts"
Task: "T048 Selection algebra in packages/studio/src/session/selection.ts"
# T042-T044 follow T041 sequentially (same directory, shared types)
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1: Setup — the package and its gates
2. Phase 2: Foundational — **blocks everything**
3. Phase 3: US1
4. **STOP and VALIDATE**: compose a slide from empty, play it back, confirm parity
5. This is a demonstrable product increment: the first time in the project's history that a lesson can be authored rather than hand-written

### Incremental Delivery

1. Setup + Foundational → the canvas renders through the player's renderer
2. US1 → a teacher can compose a slide → **MVP**
3. US2 → every element type is fully describable, including alt text
4. US3 → slides become comfortable to build a second time
5. US4 → the whole editor is keyboard-operable

US4 is last in priority and is not deferrable in practice: each surface ships keyboard-operable in
the change that introduces it (Constitution III), and Phase 6 is where that is *verified as a whole*
rather than where it is first attempted.

### Parallel Team Strategy

After Phase 2, three developers can take US1, US2, and US3 concurrently — they share only the reducer
and `index.ts`, both listed above. US4 is best taken by whoever finishes first, since it depends on
what the others built.

---

## Notes

- **117 tasks**: 11 setup, 12 foundational, 34 US1, 18 US2, 13 US3, 13 US4, 16 polish
- [P] tasks touch different files and depend on nothing incomplete
- Every test task is written to fail first; a test that passes before its implementation is testing
  something other than what it names
- Four negative controls are explicit tasks (T011, T102, T103, T107). This project has twice found a
  gate that was green while enforcing nothing, and both times the discovery came from trying to make
  it fail
- **The three scope decisions the analysis passes surfaced are now settled.** SC-008's usability
  criterion became a countable proxy with a task (T114); FR-051's read-only presentation gained an
  implementation task (T113); and the theme gate's blindness to CSS is recorded as a **known
  project-wide limitation** in plan.md rather than closed here — it predates this feature, the
  convention currently holds unenforced (46 of 46 colour literals already correct), and fixing it
  would retrofit the player's stylesheets inside a feature about the editor
- Commit after each task or logical group
