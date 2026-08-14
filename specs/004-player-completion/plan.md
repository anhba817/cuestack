# Implementation Plan: Player Completion

**Branch**: `004-player-completion` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-player-completion/spec.md`

## Summary

A lesson becomes completable: questions answer, slides advance, media keeps the lesson's time,
and motion respects a stated preference.

The wave turns on three decisions, and the first is the one that keeps everything else cheap.

**Interaction state never enters `resolve()`.** A learner's answer changes what a question element
*shows*, and it changes whether a slide may advance — but it changes nothing about which elements
are visible, where they are, or how opaque they are. So the resolver stays a pure fold over
`(slide, time)`, exactly as Waves 1 and 2 left it, and answers reach the two places that need
them: the advance controller, which already accepts a set of completed interactions, and the
question renderer, as a prop. Nothing about seeking, server rendering, or parity has to be
renegotiated.

**The media port becomes bidirectional, with a single authority rule.** The transport remains the
only clock. Media may *request* a position change and the lesson may *command* one, but every
change is applied to the transport first and the transport then commands the media. One direction
of authority, both sides able to ask. The echo that this invites — command, report, re-command —
is suppressed by tolerance rather than by a flag, because a flag is state and state gets stale.

**Reduced motion stays in CSS, and the kernel supplies both answers.** `resolve()` emits each
element's normal visual and, when a motion effect is active, its reduced alternative alongside.
The stylesheet chooses. That is what keeps FR-028 true — the preference is honoured on the first
server-rendered frame, before any script runs — while giving per-effect substitution rather than
Wave 2's blunt "neutralise every transform".

**One thing this wave must build that the last wave claimed to have.** `specs/003-…/quickstart.md`
says "If you press play and reach the end of a slide, it advances." It does not. `slideIndex` is a
fixed prop on the player, `createAdvanceController` exists in `@cuestack/core` and nothing calls
it, and no test asserted otherwise because every player test renders one slide. Slide-to-slide
advancement is built here, and until it exists US1's gating requirement is vacuously satisfied.

## Technical Context

**Language/Version**: TypeScript 6.0.3, `strict`, unchanged from features 001–003.

**Primary Dependencies**: No new runtime dependencies are expected in any package. React 19.2.x
stays a peer dependency of `@cuestack/react`; `@cuestack/core` gains nothing — a new dependency
there requires explicit justification (Constitution, Technology Constraints) and none is needed.

**Testing**: Vitest 4.1.x, happy-dom 20.11.x, `@testing-library/react` 16.3.x, axe-core 4.13.x —
all present. Media is exercised through a scripted fake implementing the media port, never a real
`<video>`: Constitution II forbids a test depending on real media playback, and a real element in
happy-dom has no decoder anyway.

**Storage**: N/A. Interaction responses live for the session only; cross-session resume is
FR-PLY-015 and out of scope.

**Target Platform**: Unchanged — the server (Node 24, no DOM) and the latest two major versions of
Chrome, Edge, Safari, and Firefox.

**Project Type**: Library (kernel plus published adapter) and one example application.

**Performance Goals**: This is the wave where the playback budgets arm. 60 fps target and 30 fps
floor (NFR-PERF-004), seek to correct rendered state within 100 ms including media and
interactions (NFR-PERF-003), and the 50-slide / 300-element fixture the Constitution requires in
CI with a 10% regression threshold. Wave 2's perf gate covers resolution only.

**Constraints**: No second clock (FR-033). No interaction or media state inside `resolve()`. No
reading of the reduced-motion preference in JavaScript on the server path (FR-028). No learner
identifier in any emitted event (FR-006). Every new learner-facing surface keyboard-operable and
announced, in the same change that introduces it (Constitution III).

**Scale/Scope**: ~10 new modules in `@cuestack/core`, ~12 in `@cuestack/react`, one perf fixture,
four MVP acceptance scenarios as end-to-end tests. 37 functional requirements, 14 success criteria.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | Assessment |
|---|---|---|
| **I. Code Quality & Modular Boundaries** | Yes | PASS. Reduced-motion alternatives are declared on the effect descriptor, so they arrive through the registry rather than through a list of "effects that move" maintained by each consumer. Media commands join the existing port rather than being reached for directly. `@cuestack/core` gains no dependency and no UI import. The one boundary question is where interaction *policy* lives; research R-01 places it in core, because completion policy is a rule about lessons and not about React. |
| **II. Test-First & Deterministic Verification** | **Yes — a threshold** | PASS, and this is the wave where two standing obligations come due. **MVP acceptance scenarios A, B, C, and F become automated end-to-end tests**, which Constitution II requires "before the corresponding feature is called done" — none has existed until now because none had subject matter. **Two business rules gain subject matter**: BR-014 (gesture before audible autoplay) and BR-015 (reduced-motion substitution), taking `check-rule-coverage.mjs` from 10 of 18 to 12 of 18, derived rather than asserted. BR-005, BR-006, and BR-007 are *already* covered by unit tests in `@cuestack/core` and gain their first **end-to-end** exercise here through the §34 scenarios — a different thing from gaining coverage, and worth not conflating: a first draft of this row claimed five new rules and 15 of 18, which the filesystem disproved. Media is driven by a scripted fake and time by the existing virtual clock. |
| **III. User Experience Consistency** | Yes | PASS. Every surface this wave adds is learner-facing — feedback, the gesture prompt, progress, completion, and error states — so each carries its keyboard and announcement obligation in the change that introduces it, and the axe gate armed in Wave 2 extends to cover them. Error messages must state the problem, the affected object, and the recommended action (NFR-USA-004), which FR-030 restates in learner terms and FR-024 bounds: the affected object named to a learner is never an internal id. |
| **IV. Performance as a Contract** | **Yes — the budgets arm** | PASS **with an obligation this wave discharges**. The Constitution requires a 50-slide / 300-element fixture in CI failing on a 10% regression; Wave 2 armed resolution only and deferred the playback budgets to "when there are frames to drop". There are now. QA-4 arms 60 fps and the 100 ms seek. The architectural precondition was met in Wave 2 by keeping the frame loop out of React; what this wave must not do is undo it — a transition or a progress bar that re-renders React per frame would spend the whole budget on reconciliation. |
| **V. Preview-Player Parity** | **Yes — under new load** | PASS. Parity now has to hold across two things that did not exist when it was proven: a learner's recorded answers and a media element's position. Both are handled the same way — as *inputs* rather than accumulated state — so seeking stays a recomputation. The reduced-motion work is the subtle case: emitting two visuals means there are two answers per element, and the guarantee is that each is independently a pure function of the same inputs. SC-009 extends Wave 2's rendered-parity sweep to cover both. |

**Post-Phase-1 re-check**: PASS. The design strengthens Principle V rather than straining it, in a
way worth recording. The obvious implementation of "questions gate advancement" is to let the
resolver know about answers; that would have made `resolve` a function of history, and seeking
would have had to replay. Keeping interaction state out of it (R-01) means the only new coupling
is at the advance controller, which already took a set of completed interactions before this wave
began — the seam was cut in Wave 1 and this is the first thing to use it.

The residual risk is the media reconciliation (R-02). Two clocks now exist by necessity, and the
guarantee degrades from "identical" to "within tolerance" for media-synchronised elements only.
That boundary is stated in the contract rather than left to be discovered.

## Project Structure

### Documentation (this feature)

```text
specs/004-player-completion/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── interaction-contract.md
│   ├── media-port-contract.md
│   └── reduced-motion-contract.md
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/core/src/
├── interactions/
│   ├── evaluate.ts             # response + definition -> outcome; pure
│   ├── policy.ts               # the three completion policies, one place
│   └── state.ts                # InteractionState: a map, and how it changes
├── media/
│   ├── reconcile.ts            # the one authority rule (R-02); pure
│   └── link.ts                 # transport <-> media port, the only place they meet
├── ports/media.ts              # gains play/pause/seek commands
├── effects/
│   ├── registry.ts             # EffectDescriptor gains `reduced`
│   └── builtin/                # each moving effect declares its alternative
├── resolve/
│   ├── index.ts                # emits reduced visuals alongside normal
│   └── contribution.ts         # unchanged
└── advance/controller.ts       # unchanged — it already takes completed interactions

packages/react/src/
├── player/
│   ├── LessonPlayerClient.tsx  # owns slide index; wires the advance controller
│   ├── SlideTransition.tsx     # two slides on screen, one leaving
│   ├── LessonProgress.tsx      # host-enabled
│   ├── LessonComplete.tsx      # the state after the last slide
│   ├── PlaybackProblem.tsx     # blocking conditions, in learner terms
│   ├── GesturePrompt.tsx       # BR-014
│   └── useInteractions.ts      # session-held responses
├── elements/builtin/
│   ├── QuestionElement.tsx     # answerable
│   ├── VideoElement.tsx        # attaches to the media link
│   └── AudioElement.tsx        # attaches to the media link
├── media/
│   └── domMediaPort.ts         # the real port over HTMLMediaElement
└── styles/
    ├── stage.css               # per-effect reduced-motion substitution
    └── transition.css

tools/scripts/
├── fixtures/heavy-lesson.mjs   # 50 slides, 300 elements — generated, not committed as JSON
└── gates/perf.mjs              # playback budgets armed
```

**Structure Decision**: `media/` is a directory in **core**, not in the adapter, and that placement
is the point. What a media position *means* for a lesson — when a slide may advance, which of two
disagreeing positions wins — is a rule about lessons. Only the part that touches an
`HTMLMediaElement` is React's, and that is one file (`domMediaPort.ts`) implementing a port core
defines. Putting reconciliation in the adapter would mean a second adapter reimplements it, and
two implementations of "which clock is right" is precisely the divergence Principle V exists to
prevent.

`interactions/` is in core for the same reason: `completionPolicy` is a lesson rule. The renderer
decides what a radio group looks like; it does not decide what counts as complete.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| The media port becomes bidirectional, amending a Wave 1 design decision | Wave 2 shipped a seek control. On any slide with a video, dragging it desynchronises the lesson from its media, and a control that visibly lies is worse than one that was never shipped. Wave 4's editor timeline needs media seeking regardless, so the change is postponed rather than avoided by declining it. | Keeping the port read-only satisfies every framework MUST, which is why Wave 1 chose it. What changed is that a learner-facing seek control now exists. The mitigation is that authority stays singular: the transport is the only clock, media may request but never decide, and the reconciliation rule lives in one pure function (R-02) rather than at each call site. |
| `resolve()` emits two visuals per element — normal and reduced — where an effect moves | FR-028 requires the reduced-motion preference honoured on the first rendered frame, before any script. That frame is produced on a server that cannot read the preference, so the choice must be made by CSS, which means both answers must already be in the markup. | Reading `prefers-reduced-motion` in JavaScript is the ordinary approach and it cannot work here: it would defer the decision to hydration, so a learner who asked for less motion would see the full motion first. Emitting one visual and neutralising transforms in CSS is what Wave 2 does; it satisfies the floor and cannot express "a slide-in becomes a fade", which is what BR-015 asks for. Cost is contained by emitting the second set only when a motion effect is active. |
| Two slides are resolved and rendered simultaneously during a transition | A transition is, definitionally, both slides being visible. Nothing about it can be expressed with one. | Rendering only the incoming slide and cross-fading a snapshot of the outgoing one would avoid the second resolve, and would freeze any effect still running on the outgoing slide at the moment the transition began — visible, and wrong. Each slide is resolved at its own slide time throughout, which costs one extra `resolve()` call per frame for the duration of the transition only. |
| The playback perf fixture generates 50 slides and 300 elements at build time rather than committing a manifest | A committed 300-element manifest is a large file nobody reads, that drifts from the schema silently, and that invites being edited to make a failing budget pass. | Committing it is simpler and was rejected because feature 001 already found a checked-in artefact disagreeing with the schema on its first real run. Generating it from the schema's own types means a format change breaks the fixture loudly. |
