# Cuestack framework — development plan

Build the Cuestack lesson framework from zero: a headless timing/render kernel plus a
React adapter that server-renders under Next.js App Router. Scope is the MVP in
`docs/Cuestack_Framework.md` §35, governed by `.specify/memory/constitution.md`.
**In scope:** schema, kernel, React adapter, SSR, player, Studio editor, validation/publish
contracts, portable export/import, persistence adapters, test+perf harnesses.
**Out of scope:** running a backend, auth, asset storage, LMS features — the framework
defines adapter interfaces for those, ships an in-memory reference plus an HTTP reference
adapter, and always lets the user export their design as a portable package. Sibling
artifacts: the spec (requirements) and the constitution (gates); this plan is the sequencing.

## Classification

| Prefix | Track |
|---|---|
| IN | infra / tooling / CI |
| SCH | schema + migrations |
| EN | headless kernel (`@cuestack/core`) |
| RC | React adapter (`@cuestack/react`) |
| NX | SSR / Next.js |
| PL | player runtime features |
| ED | Studio editor |
| PB | validation + publishing |
| QA | testing + perf harnesses |
| DX | docs + framework-agnosticism proof |

## Status legend

✅ complete · 🔄 in-progress · 💡 proposed · ⏸️ deferred · 🔲 not started

## Phase diagram

    Wave 0 — foundation
      ✅ IN-1 ──→ ✅ IN-2                          (toolchain, then constitution gates)
      ✅ IN-1 ──→ ✅ SCH-1 ──→ ✅ SCH-2              (critical path starts)

    Wave 1 — headless kernel  (after SCH-1)
      ✅ SCH-1 ──→ ✅ EN-5 ──→ ✅ EN-4 ──→ ✅ EN-1 ──→ ✅ EN-2 ──→ ✅ EN-3   (critical path)
                                                        └──→ ✅ QA-1
      ✅ SCH-1 ──→ ✅ EN-6                             (adapter interfaces; parallel)

    Wave 2 — React + SSR  (after EN-3; the headline milestone)
      ✅ EN-3 ──→ ✅ RC-1 ──→ ✅ NX-1 ──→ ✅ NX-3 ──→ ✅ QA-2   (critical path)
                    └──→ ✅ RC-2 ───────────┘
      ✅ NX-2 ─────────────────→ ✅ NX-1            (CSS scaling; startable in Wave 0)

    Wave 3 — player completion  (after Wave 2)
      ✅ RC-2 ──→ ✅ PL-1 ──┐
      ✅ RC-2 ──→ ✅ PL-2 ──┼──→ ✅ QA-3 ──→ ✅ QA-4   (QA-3 covers §34 A/B/C/F only —
      ✅ RC-2 ──→ ✅ PL-3 ──┘                          D and E need an editor and a
      ✅ NX-2 ──→ ✅ PL-4                              publishing pipeline)

    Wave 4 — Studio editor  (after Wave 3)
      ✅ EN-5 ──→ ✅ ED-1 ──→ ✅ ED-2
                    ├──→ ✅ ED-3 ──→ ✅ ED-4
                    └──→ ✅ ED-5
      ✅ RC-1 ──→ ✅ ED-6 ──→ ✅ QA-5               (preview reuses the player — parity by construction)

    Wave 5 — publish, portability, extensibility proof
      ✅ SCH-2 ──→ ✅ PB-1 ──→ ✅ PB-2
      ✅ SCH-2 ──→ ✅ SCH-3                           (portable export/import package)
      ✅ EN-6 ──→ ✅ PB-3                           (HTTP reference adapter)
      ✅ EN-5 ──→ 🔲 DX-1
      ✅ RC-1 ──→ 🔲 DX-2                           (second adapter proves the core is framework-agnostic)

    Critical path:
      IN-1 → SCH-1 → EN-5 → EN-4 → EN-1 → EN-2 → EN-3 → RC-1 → NX-1 → NX-3

## Implementation order

Ordered by wave (dependencies dominate), then by score within wave.
U/C/E/R are 0–3; Score = U + 2C + E − R (see rubric).

| Wave | Item | Prereqs | U | C | E | R | Score | Status |
|---|---|---|---|---|---|---|---|---|
| 0 | IN-2 CI gates from the constitution | IN-1 | 0 | 3 | 2 | 0 | 8 | ✅ |
| 0 | IN-1 monorepo, build, exports maps | — | 0 | 3 | 2 | 1 | 7 | ✅ |
| 0 | SCH-1 manifest schema + types + validators | IN-1 | 0 | 3 | 2 | 2 | 6 | ✅ |
| 0 | SCH-2 schemaVersion + migration harness | SCH-1 | 0 | 2 | 2 | 1 | 5 | ✅ |
| 1 | EN-2 monotonic clock + transport | EN-1 | 1 | 3 | 2 | 1 | 8 | ✅ |
| 1 | EN-3 advance controller (4 modes) | EN-2 | 2 | 3 | 2 | 2 | 8 | ✅ |
| 1 | EN-4 effect registry + 8 MVP effects | EN-5 | 2 | 3 | 1 | 1 | 8 | ✅ |
| 1 | QA-1 virtual-clock harness + BR-001..018 suite | EN-2 | 0 | 3 | 2 | 0 | 8 | ✅ |
| 1 | EN-6 storage/asset/analytics adapter interfaces | SCH-1 | 1 | 3 | 2 | 1 | 8 | ✅ |
| 1 | EN-1 timeline resolver (pure) | EN-4 | 1 | 3 | 2 | 2 | 7 | ✅ |
| 1 | EN-5 element registry + plugin contract | SCH-1 | 0 | 3 | 2 | 2 | 6 | ✅ |
| 2 | RC-1 React player component | EN-3 | 3 | 3 | 2 | 1 | 10 | ✅ |
| 2 | NX-2 CSS-driven logical-canvas scaling | IN-1 | 2 | 3 | 2 | 1 | 9 | ✅ |
| 2 | NX-3 Next.js App Router example app | NX-1 | 3 | 2 | 2 | 0 | 9 | ✅ |
| 2 | NX-1 RSC/client boundary + hydration safety | RC-1, NX-2 | 3 | 3 | 1 | 2 | 8 | ✅ |
| 2 | RC-2 React renderers for MVP element types | RC-1 | 3 | 2 | 2 | 1 | 8 | ✅ |
| 2 | QA-2 SSR + hydration test suite | NX-3 | 0 | 3 | 2 | 0 | 8 | ✅ |
| 3 | PL-4 reduced-motion (CSS-only, SSR-safe) | NX-2 | 2 | 1 | 3 | 0 | 7 | ✅ |
| 3 | QA-3 §34 **A/B/C/F** acceptance e2e | PL-1..3 | 0 | 3 | 1 | 0 | 7 | ✅ |
| 3 | QA-4 perf fixture + budget gates | QA-3 | 0 | 3 | 1 | 0 | 7 | ✅ |
| 3 | PL-1 interactions (MC, true/false) + gating | RC-2 | 3 | 2 | 1 | 2 | 6 | ✅ |
| 3 | PL-2 media sync, gesture gate, media-end advance | RC-2 | 3 | 2 | 1 | 2 | 6 | ✅ |
| 3 | PL-3 transitions, progress, completion, errors | RC-2 | 2 | 1 | 2 | 1 | 5 | ✅ |
| 4 | ED-6 preview harness (from start/slide/time) | RC-1 | 3 | 2 | 2 | 0 | 9 | ✅ |
| 4 | ED-4 Simple Sequence Mode ↔ timeline | ED-3 | 3 | 2 | 1 | 1 | 7 | ✅ |
| 4 | QA-5 editor↔player parity harness | ED-6 | 0 | 3 | 1 | 0 | 7 | ✅ |
| 4 | ED-2 properties inspector (plugin-driven) | ED-1 | 3 | 1 | 1 | 0 | 6 | ✅ |
| 4 | ED-5 undo/redo, autosave, offline queue | ED-1 | 3 | 2 | 0 | 2 | 5 | ✅ |
| 4 | ED-1 canvas: move/resize/rotate, snap, layers | EN-5 | 3 | 1 | 0 | 1 | 4 | ✅ |
| 4 | ED-3 timeline UI: tracks, playhead, drag | ED-1 | 3 | 1 | 0 | 1 | 4 | ✅ |
| 5 | DX-2 `@cuestack/element` web-component adapter | RC-1 | 1 | 3 | 1 | 0 | 8 | 🔲 |
| 5 | PB-3 `@cuestack/adapter-http` reference REST adapter | EN-6 | 3 | 2 | 2 | 1 | 8 | ✅ |
| 5 | SCH-3 portable export/import package | SCH-2 | 3 | 2 | 1 | 1 | 7 | ✅ |
| 5 | DX-1 docs + plugin authoring guide | EN-5 | 1 | 2 | 2 | 0 | 7 | 🔲 |
| 5 | PB-1 validation engine (errors/warnings/jump) | SCH-2 | 2 | 2 | 1 | 1 | 6 | ✅ |
| 5 | PB-2 immutable publish + version history | PB-1 | 2 | 2 | 1 | 2 | 5 | ✅ |

## Next steps

**Waves 0 through 3 are complete.** `@cuestack/schema` holds the format, `@cuestack/core` holds
the kernel, and `@cuestack/react` plays it — on a server and in a browser, from the same
computation. 1,168 tests. See `specs/001-framework-foundation/`, `specs/002-headless-kernel/`,
`specs/003-react-ssr-player/`, and `specs/004-player-completion/`.

**The headline milestone is met: the first slide is in the HTML document.** Real content, at the
authored geometry, readable with JavaScript disabled, hydrating into playback without moving.
The single decision that bought it is that scaling lives in CSS — every visual value is a custom
property and every dimension a container query unit — so nothing measures anything and a server
can emit a layout for a viewport it cannot know. The same indirection gave reduced motion two
waves early, for free and without script.

Parity gained its second consumer and held. Feature 002 proved the *computed* state of seeking
equals playing; Wave 2 proves it of the rendered output, with the renderer in the path. That
sweep earned its keep immediately by finding a `will-change` hint applied on React's schedule
rather than the kernel's, which would otherwise have shipped.

Constitution III went live: WCAG 2.2 AA is a merge gate, and the accessibility and theme-literal
gates that had been passing placeholders since Wave 0 are armed and negative-controlled. Arming
them found the theme gate silenceable by an inline `eslint-disable` — a gate green for three
tasks while enforcing nothing that a comment could not switch off.

Three defects in earlier waves surfaced only because Wave 2 consumed them, which is the argument
for building in this order: `@cuestack/core` never exported its transport or advance controller;
`ResolvedElement` carried no accessibility metadata, putting an image's alt text out of reach of
the only component that needs it; and the static player used a hook, so it could not have
rendered any slide with an element on it as a Server Component. The last was invisible twice
over — `renderToString` is not RSC, and the reference lesson's first slide is empty at time zero.

**Wave 3 closed both costs it opened with.** The media port became bidirectional — the design
change R-04 flagged, not an extension — with a reconciliation rule deciding who is authoritative
when the lesson and an element disagree about position. And the playback budgets armed against the
Constitution's 50-slide/300-element fixture, which Wave 2 deferred on the stated grounds that there
were no frames to drop.

**QA-3 covers §34 A, B, C, and F — not D and E.** D needs an editor and E needs a publishing
pipeline, so the four that are automatable are automated and the tally says which. Marking QA-3
complete as "A–F" would have been false.

Wave 3 repeated Wave 2's lesson about ordering. Defects invisible in their own wave surfaced the
moment this one consumed them: **no element ever appeared or disappeared during playback**, because
the transport emits on command rather than on a timer and every player test drove `seek()`. The
lesson also never advanced. Both had shipped green.

**Wave 4 has begun: ED-1 and ED-2 are complete.** `@cuestack/studio` is a fourth published package,
and a lesson can now be *authored* rather than hand-written — every manifest this project had
rendered until now was TypeScript someone typed or a JSON fixture. 1,515 tests.

**The kernel did not change to accommodate an editor**, which is the result worth reporting. Wave 1
cut the seam this rests on before anything needed it: `ResolvedElement.geometry` is documented as
*authored* position, with a comment saying the editor will want that value while the player wants
the effective one. A drag handle attaches to geometry, an effect's displacement stays in
`transform`, and `resolve(slide, timeMs)` is called with the same two arguments from both sides.

Elements the resolver omits — hidden, or outside their window — are drawn by an *overlay* as
selectable ghosts, computed from a diff. That keeps Constitution V structural rather than
disciplinary: the render layer is byte-identical with the overlay removed, and the player cannot
grow a ghost because the player has no overlay.

**Two core changes, both additive to authoring metadata no manifest serializes.** `InspectorField`
gained a `list` kind, because a question's options are a repeating group and the alternative was a
branch on the seventh element type. `LessonEvent` gained `element_inserted`: FR-AN-001 has always
declared that the authoring application emits insertion events, and the union modelled playback
only, so the requirement had nothing to emit.

**Wave 4's own version of the recurring lesson.** Building the inspector found that
`ElementPlugin.inspector` had no consumer *and no producer* — the seven built-in types have no
`ElementPlugin` at all, being served by the schema, the resolver, and the React renderer registry.
Three documents implied otherwise. The inspector now reads a registered plugin's spec first and
falls back to the editor registry, so FR-018 stays literally true for third-party types while the
built-ins have a home.

**The parity gate is still a placeholder, and that is correct.** This feature builds the editor,
but QA-5 compares *preview* to playback and preview is ED-6. Marking it armed here would be the
third time a gate in this project claimed more than it enforced. What ED-1 and ED-2 did was make
the comparison possible for the first time.

**ED-6 armed it.** `gate:parity` now runs four suites and exits non-zero when they disagree, with
a negative control in `check-gates.test.ts` that changes what a question *says* — not what
affordances it carries, since the two renderer sets are supposed to differ there. Finding the
right comparison took several attempts and is worth recording: preview-versus-playback is
tautological, because the preview *is* the player, so it reduces to `resolve(s, t) === resolve(s, t)`
and passes forever including after parity breaks. Canvas-versus-player is real and feature 005
had already written it. What was genuinely untested is the **renderer sets**: `staticRenderers`
and `builtinRenderers` differ in exactly one member, and the editor draws with one while a learner
gets the other.

**`gate:a11y` reached the editor package**, for the first time and for a specific reason: a preview
is a learner-facing surface living in the studio, and CI gate 6 covers learner-facing components.
`perf.mjs` and `theme-values.mjs` had already followed the editor as it grew; a11y had not needed to.

**ED-6 is complete: the lesson, as a learner receives it, inside the editor.** A teacher can preview
from the beginning, from the current slide, or from the current moment; drive it; move past any gate
with one switch; see that a lesson cannot be finished before a learner does; and check it at three
sizes. No renderer, clock, or effect implementation was written — the preview mounts
`<LessonPlayer>` and everything a learner sees comes from `@cuestack/react`.

**Two contract members gained producers, and one prop changed shape.** `allowOverride` and
`overrideAdvance` had been declared test-only since Wave 1 with nothing passing either — the fifth
instance of the declared-but-unproduced pattern, after `ElementPlugin.inspector`,
`EffectDescriptor.parameters`, `RenderState.problems`, and `ResolveContext.effects`. Analysis found
a sixth on the way past: `Ports.assets` is declared and read by nobody, assets reaching the player
through the `resolveAsset` prop instead. That one is left alone deliberately — unifying two asset
paths is a kernel decision, not a preview one.

The prop that changed is `ports`, from `Ports` to `Partial<Ports>`, merged per member instead of
replacing the object. The preview needs the browser's clock, the player's *own* DOM media port, and
an analytics adapter that discards — a combination the all-or-nothing prop could not express, since
the media port closes over a frame writer the player owns and exposes to nobody. It also closes a
trap any host could already have hit: supplying ports to set analytics silently lost media.

**Two things a preview does that nobody had written down.** It emits no analytics — the player
records `lesson_started` on mount and a `slide_completed` for every slide it passes, so a preview
wired to a host's telemetry would report a teacher's checking as a learner's progress, and every
gate the override skipped as a completion nobody earned. And restart is a *fresh run* rather than a
seek: the answers live in the player's interaction state, which exposes no reset, and the advance
controller never re-decides a slide whose instance id has not moved — which `transport.restart()`
does not move. A seek-based restart replays a lesson whose gates are all already satisfied, which is
the opposite of what a teacher restarts to check.

**One defect found in implementation rather than in review.** The kernel's override short-circuits
*every* condition, duration included — correct for the test affordance it was written as, and wrong
for a preview: raised unconditionally, it made a lesson race to its own ending the instant the
switch went on, so a teacher could skip a question and then see nothing. The signal is gated on the
slide's own duration now, so the override releases a **gate** and never a slide's length.

**ED-3 and ED-4 are complete: time is visible, editable, and sequenceable.** A teacher can see a
track per element, drag its timing, play the slide on the player's own clock, author any of the
eight effects, and order events in words rather than milliseconds. 1,7xx tests.

**The framework's own effect library became reachable.** Eight effects have been implemented,
tested, and unusable by a teacher since Wave 1 — `Element.effects` was a field only a hand-written
manifest could populate. That is the largest single thing this tranche changed, and it needed one
core addition: `EffectDescriptor` gained `parameters`, reusing `InspectorField`. Reading the eight
implementations to write it found that `slide.from` is a *direction string* while `zoom.from` is a
*starting scale number* — one key, two types, in two effects a teacher picks between in the same
menu. A central parameter table would have offered `zoom` a direction dropdown; per-descriptor
declaration is not merely tidier, the alternative was wrong.

**One clock, and a lint rule rather than an intention.** The editor drives `createTransport`, which
has been in the kernel since Wave 1. `no-clock-in-studio` forbids `performance.now`, `Date.now`,
`setInterval`, `setTimeout`, and `requestAnimationFrame` in the studio package **with no
exemption** — possible only because `@cuestack/react` now exports `browserPorts`, which existed
since Wave 3 and had never been exported because every consumer was inside that package.

**Wave 4's version of the recurring lesson, twice.** `ResolveContext.effects` has always accepted a
registry and **nothing has ever passed one** — every call site in the player and the editor is
two-argument. And `RenderState.problems` has carried `ELEMENT_BEYOND_SLIDE` since Wave 1 with no
reader, so US5 is a consumer for a mechanism that already existed. That is now four instances of
the same shape — `ElementPlugin.inspector`, `EffectDescriptor.parameters`, `RenderState.problems`,
`ResolveContext.effects` — and the pattern is worth naming: the kernel has been built ahead of its
consumers, so the reliable way to review one of its contracts is to try to use it.

**Wave 3's defect, nearly reproduced.** `EditorCanvas` resolves at render time from
`session.authoringTime`, which playback deliberately leaves stale — so an element entering
mid-slide would never have mounted, and every planned test drove a seek, which re-renders. The
suite now carries one test that plays through an element's `startMs` with **no seek at all**. That
is the same sentence `useFrameLoop`'s header already records about the player.

**Wave 4 is closed.** ED-5 landed undo, autosave, offline recovery, conflict refusal, and version
history, and with it the wave's last item.

**The pattern the wave kept finding, one more time — and this was the sharpest instance.** ED-5 is
the first consumer of `Ports.storage`, which `browserPorts()` had been filling from the in-memory
reference since Wave 1 with nothing reading it. Trying to use `StorageAdapter` found the gaps in
one afternoon: a save could not declare itself a checkpoint, an entry could not say when it was
recorded, and an earlier version's content could not be fetched **at all** — so FR-DAT-009 was not
difficult against that boundary, it was impossible. That is the seventh member of the
declared-with-no-producer family, after `ElementPlugin.inspector`, `EffectDescriptor.parameters`,
`RenderState.problems`, `ResolveContext.effects`, `AdvanceControllerOptions.allowOverride`, and
`Ports.assets`.

The eighth turned up in the same feature and is worth recording separately, because it was only
*safe* to ignore by accident. `migrate()` has been in `@cuestack/schema` since Wave 1 with no
consumer anywhere, because nothing had ever loaded a lesson it did not itself construct. ED-5 loads
one twice. Once restoring went through `applyEdit` — which validates against the *current* schema —
a version written under an earlier format would have been refused, and the refusal would have read
as data corruption to a teacher whose lesson was perfectly intact.

**A lint rule shaped the design, and was not amended.** `no-clock-in-studio` bans `setTimeout`,
`setInterval`, `requestAnimationFrame`, `Date`, and `performance.now` across `packages/studio/src`
with no `ignores`, and ED-5 needs three delays. The route taken is the one the rule's own comment
describes and ED-3 already used: the primitive lives in `@cuestack/react` and the studio imports it.
The rule still has no exemptions. The same rule decided how a checkpoint's time is rendered —
`new Date(ms)` fails it, `Intl.DateTimeFormat().format(ms)` does not.

**What the timeline turned out to owe.** `timeline/Track.tsx` calls `onRetime` from
`onPointerMove`, so a two-second drag is roughly 120 applied changes where `canvas/gesture.ts`
commits once on release. Run-collapsing was specified for arrow keys and turned out to be what makes
undo work on the timeline at all. The CPU cost of one clone and one full validation per frame is
feature 006's and remains outstanding — collapsing hides it from history, not from the machine.

Obligations carried forward:

- **Navigation buttons render their action but do not act**, and `on_click` advance is therefore
  unreachable. The reference lesson's last slide uses it, which is why the example app ships a
  second, completable lesson beside it. Awaiting the delegation seam through the player.
- ~~**Asset ids are resolved by a host-supplied function**, with BR-018's publishing rule left to
  Wave 5.~~ **Discharged by PB-2.** `collectAssetRefs` is pure and shared by the warning pass and
  the publish check, so the two cannot disagree about which assets a lesson uses; `checkAssets` is
  the round trip, and the publish check runs its own rather than reusing the report's answer.
- **`set-timing` is emitted once per `pointermove`**, so a timeline drag costs one manifest clone
  and one full Zod validation per frame. ED-5's run-collapsing removes the *history* consequence —
  a drag is one undo step — and leaves the CPU cost, which belongs to feature 006 rather than here.
- ~~**A dead-end lesson is authorable.**~~ **Discharged by PB-1.** `isDeadEnd` sits in
  `interactions/policy.ts` immediately below the `isUnsatisfiable` it mirrors — one rule asked at
  two moments, and separating them is how they come to disagree. The author is told before a
  learner meets it, and the code is an error no policy can lower.
- ~~**Deletion is confirmed, not undoable.**~~ **Discharged by ED-5.** All three confirmations are
  deleted — `DeleteConfirmation`, `CustomConfirmation`, and the inline effect-removal prompt — and
  a repository check in `check-gates.test.ts` keeps them gone. Their suites were rewritten rather
  than removed: what each was really guarding is now asserted as reversibility.
- ~~**The authoring-time scrub is a second control writing a value the playhead will also
  write.**~~ **Discharged by ED-3.** `canvas/AuthoringTime.tsx` is deleted rather than deprecated,
  and its five focus tests migrated to the playhead — they were the playhead's requirements
  restated. There is one authoring time and one control writing it.
- ~~**BR-017 is unenforceable.**~~ **Discharged by ED-3.** A shortened slide clamps nothing and the
  overrun is reported on the timeline, with an offered action that computes the target from the
  draft. PB-1 still owns blocking a *publish*, which is a different job.
- **A slide of zero duration is legal and now handled.** `Slide.durationMs` is `msInt` — integer
  ≥ 0, not the positive `msDuration` an earlier design document asserted from memory — so a slide
  advancing `on_click` may carry none. Every element on it overruns, correctly; the timeline says
  so once, about the slide.
- ~~**`ElementPlugin.validate` still has no consumer.**~~ **Discharged by PB-1 — and it needed a
  producer too**, which nobody had noticed. See the Wave 5 note below.
- **The theme-values gate cannot see CSS.** It delegates to ESLint, which does not parse
  stylesheets, so colour literals there are convention-enforced project-wide — measured at 46 of 46
  already correct in the player's CSS. Recorded rather than closed, because fixing it would retrofit
  a check onto the player inside a feature about the editor.

**Wave 5's validation and publishing are complete.** PB-1 gave the framework a report a teacher can
act on; PB-2 gave it the first thing it produces that has no edit path at all. `check:rules` now
reports **18 of 18** — every business rule in the specification has a rule-named test, and the
deferred set is empty for the first time.

**The declared-with-no-producer pattern, and the sharpest instance yet.** `ElementPlugin.validate`
was recorded above as the ninth member — but the finding when PB-1 went to use it was worse than
"no consumer": **there were no concrete `ElementPlugin` implementations in the shipped framework at
all.** The seven MVP types carried a renderer and an editor registration and no core plugin, so the
seam was real and empty, and SC-001's "no branch on element type" was vacuous — there was nothing
behind the seam to branch away from. The seven arrived here with an inert `resolve`
(`{ visible: true }`, exactly what the resolver already did with no plugin) so that adding them
changed nothing a learner sees; a parity test asserts that across the change rather than assuming
it. `ElementPlugin.schema` was the tenth, found the same afternoon and for the same reason.

**Registering them turned off an escape, deliberately.** `resolve/element.ts` reads
`elements.types().length === 0` as "every type is known", which is why the player worked without
plugins — and why `UNKNOWN_ELEMENT_TYPE` could never fire. With a non-empty default it can. The
consequence a host meets: a supplied registry **replaces** the default rather than extending it, so
a custom type must be composed as `createElementRegistry([...builtinElements, mine])` or all seven
MVP types are reported unknown. Written down in `packages/core/README.md` rather than discovered.

**Three validators already existed, and two of them overlap.** The schema's Tier 2 and
`checkReachability` both check the same four advance conditions — `advanceOnNonMedia` is reported by
both, with different codes. That overlap predates this feature and is the reason the engine
**composes** rather than checks: a fourth opinion would drift from the player, and a report that
disagrees with the thing it describes is worse than no report. Every issue carries a `source`
because `UNKNOWN_ELEMENT_TYPE` and `UNKNOWN_EFFECT_TYPE` are declared by *both* vocabularies and
mean different things at the two tiers.

**A plugin validator that restated the format got caught by checking.** The first `question` plugin
reported fewer than two options and an empty prompt; `interactionSchema` declares
`options: z.array(optionSchema).min(2)` and `prompt: z.string().min(1)`, so both were already
rejected and the plugin was producing a second issue for one fault. What the format genuinely cannot
say replaced them: two options whose *labels* read the same (the format checks ids, never labels),
and a `true_false` question with more than two answers. The lesson generalises — FR-006c's rule
holds only if somebody reads the schema rather than assuming it.

**SCH-3 and PB-3 are complete, and the anti-lock-in promise is now something a teacher can press.**
A lesson leaves as one JSON document anybody can read; a host persists to its own API through an
adapter it may decline to install. The plan's settled answer — "we ship an in-memory reference and an
HTTP reference adapter; we never run a server" — was, until this feature, half unbuilt.

**`migrate` gained its second consumer, and its first untrusted input.** Feature 008's draft recovery
was the first, reading a lesson this system had itself written. A package handed over from elsewhere
is the first document this framework reads with no reason to believe a version of itself produced it.
Two things followed from actually using it. `migrate` **already** distinguishes a newer manifest from
an unsupported one, with a message worth quoting — so import delegates the lesson-version question
entirely rather than re-deriving it. And `migrate` **always** ends with `validate`, so a second
validation on the import path would have been redundant work and a second place to disagree about
what valid means.

**Two requirements were written against behaviour the code does not have, and implementing found
both.** FR-017a justified the import registry option with "a custom element type reported unknown" —
unreachable, because the format's element union is closed and a lesson carrying an unregistered type
is refused before any registry is consulted. And a `read(body)` signature could not serve a host whose
version token travels in a header, which is ordinary ETag-shaped concurrency; that surfaced only when
the *second* API shape was written, which is precisely what SC-008 demands two shapes for.

**The headless gate caught something no review would have.** `packages/core` must never reference
`window`, `document`, `performance`, `requestAnimationFrame`, or `localStorage` — checked against the
source text, because a reference guarded behind `typeof` still makes the package depend on a browser
it claims not to need. A local variable and a field both named `document`, holding a parsed package,
tripped it. Renamed to `envelope`, which is the better name anyway.

**`pnpm test:coverage` is red, and was before this feature.** Branch coverage stands at **89.03%**
against a 90% floor, and measuring it with feature 010's contribution removed gives **88.57%** — so
this feature's code (`packaging/`, at 95.58% branches) *improved* the number and did not cause the
shortfall. CI runs this gate at `.github/workflows/ci.yml:90`, so it is failing there too.

The cause is a disagreement between the config and its own comment. `vitest.config.ts` says "the
thresholds below stay scoped to core and schema", but `thresholds` in Vitest is **global** — it
applies to everything in `include`, which is `packages/react/src/**` and `packages/studio/src/**` as
well. The drags are `react/src/media` (0% branches, 21% statements), `studio/src/registry` (57%),
`react/src/frame` (79%), and `studio/src/session` (82%). Fixing it means either raising those or
scoping the thresholds to match the documented intent — **a repo-wide decision somebody should make
deliberately**, which is why feature 010 surfaced it rather than quietly adjusting a gate.

It surfaced at all because feature 010's task list was the first to run `pnpm test:coverage` as part
of its own verification. Earlier features' equivalents ran `pnpm test`, which runs no coverage.

**The coverage floor's scope is narrower than the constitution reads.** Constitution II states 90%
line and branch coverage for `@cuestack/core`; `vitest.config.ts` scopes the `include` to
`{resolve,effects,time,advance}` and widens "as each lands". That widening has been skipped for
`validation/`, `publishing/`, and `elements/` — so most of core sits outside a floor the constitution
states plainly. Feature 010 widened it for `packaging/` only. **Closing the rest is a decision
somebody should make deliberately**, not a side effect of an unrelated diff, and it is recorded here
so it is findable.

**The format permits an executable address today, for any lesson.** `elementSchema` declares a
button's address as `url: z.string().max(2000).optional()` — no scheme constraint — so a lesson
authored in this editor can carry `javascript:` and nothing rejects it. Import now refuses one
(NFR-SEC-007 for that path), and the editor still does not. Tightening the schema would reject
manifests that are valid today and needs its own decision about `schemaVersion` and a migration,
which is why this feature deliberately did not do it.

## Open design questions

| Question | Default unless overridden |
|---|---|
| Does the framework ship a backend? | **No — settled.** `StorageAdapter` / `AssetAdapter` / `AnalyticsAdapter` interfaces (EN-6) land in Wave 1, so a host can persist to its own API from day one. We ship an in-memory reference and an HTTP reference adapter (PB-3); we never run a server. The user can always export the design as a portable package (SCH-3) — no lock-in, per spec §7.7. |
| Render substrate: DOM or canvas? | **DOM — settled.** SSR and WCAG 2.2 AA each independently rule canvas out, and per-slide element counts (~5–15) sit far below where DOM compositing strains. Canvas stays available *inside* an element plugin for a future chart or particle type. Not revisitable wholesale later without a rewrite. |
| Effects: CSS keyframes or computed style at time t? | **Computed at t.** A keyframe can't be seeked to deterministically (spec §30.5) or rendered server-side. WAAPI as a later optimization behind the same descriptor. |
| Schema validation library | **Zod in `@cuestack/schema`**; `@cuestack/core` imports types only and takes validators by injection, keeping core's runtime deps near zero. |
| Styling | **Plain CSS + custom properties** for theme tokens. Zero runtime, SSR-safe, no style-injection hydration risk. |
| React version floor | **19** (stable RSC), with an 18-compatible client-only entry in the exports map. |
| Editor state management | **Zustand + Immer patches**, patches doubling as the undo/redo journal and the autosave delta. |
| Monorepo tooling | **pnpm workspaces + Turborepo**; ESM-only builds via tsdown. |
| Next.js router support | **App Router first.** Pages Router gets the client-only entry, no RSC path. |

## Scoring rubric

    weights: U=1 · C=2 · E=1 · R=1
    (greenfield framework — nearly all near-term value is architectural, so C is doubled;
     R stays at 1 because schema and SSR-boundary mistakes are expensive to unwind even
     with no production traffic)

- **U** — user impact: value a teacher or learner can see.
- **C** — core impact: value to the codebase — de-risking, extensibility, test leverage.
- **E** — ease: inverse effort (3 = trivial, 0 = a slog).
- **R** — risk: cost if it goes wrong, here mostly *rework cost*, not blast radius.

Scores live only in the implementation table; item blocks never repeat them.

## Production safety

No live path yet — nothing here can break a user today. Safety in this plan means the
lines the design must not cross, because they are cheap now and expensive after v1.

**Touch-points**

| Module | Items that touch it | Essential path? | Risk surface |
|---|---|---|---|
| `@cuestack/schema` types | SCH-1/2, all EN, RC-1/2, PB-1 | yes — every package | after v1 the manifest is additive-only; a rename ripples everywhere |
| resolver (EN-1) | EN-1/2/3, RC-1, NX-1, ED-6, all QA | yes | sole source of render state; a bug here breaks preview and player *identically*, which is the design working as intended |
| registries (EN-5) | EN-4/5, RC-2, ED-2, DX-2 | yes | the public plugin contract; breaking it breaks third-party elements |
| CSS scaling layer (NX-2) | NX-1/2, PL-4, ED-1 | yes | first-paint correctness under SSR; a JS-measured fallback here silently reintroduces layout shift |
| adapter interfaces (EN-6) | EN-6, ED-5, PB-2/3, SCH-3 | yes | the only place lesson data leaves the framework; conflict semantics belong in the interface, not per-impl |

**Data-safety invariants**

1. Lesson manifests MUST NOT carry learner identifiers (NFR-PRV-002).
2. Analytics payloads carry no PII beyond identifiers the host explicitly configures (NFR-AN-004).
3. Migrations are forward-only and additive; a published manifest is never rewritten in place (BR-008, BR-009).
4. Exported lesson packages contain no author or learner secrets (NFR-PRV-004).
5. Rich text and plugin content are sanitized on **both** paths (NFR-SEC-007). SSR sharpens
   this: unsanitized markup rendered server-side ships in the HTML document itself, so it
   executes before any client-side guard can run.

**Reversibility.** Per-package semver; the framework ships nothing to production on its own.
Once a host app exists, the player mounts behind a pinned dependency and rolls back by version.

## Item details

Detail blocks cover Waves 0–2 — the work that is actually next. Later waves are one-liners
in the table until they're the working set.

### IN-1 — monorepo, build, exports maps

pnpm workspace with `@cuestack/{schema,core,react,element}` stubbed plus a `examples/nextjs`
app. Every package: ESM-only, `"sideEffects": false`, TS strict, and an `exports` map with
`"react-server"` and `"default"` conditions so Next.js resolves the RSC-safe entry
automatically. The dependency-boundary lint rule (Constitution I) lands here, not later —
it is what keeps React out of core, and retrofitting it after code exists means deleting code.

**Files:** `pnpm-workspace.yaml`, `turbo.json`, `packages/*/package.json`, `tsconfig.base.json`, `eslint.config.js`
**Safety:** none live. The exports map is the load-bearing part; get the conditions wrong and SSR silently falls back to the client bundle.

### IN-2 — CI gates from the constitution

The seven blocking gates in constitution §"Development Workflow": typecheck, lint (incl.
dependency-boundary and no-hardcoded-theme-values), tests, coverage floors on core+schema,
parity fixtures, a11y checks, perf fixture. Gates 5–7 start as green no-op jobs and gain
teeth as QA-2/3/4/5 land — the job exists from day one so adding the check is a one-line diff.

**Files:** `.github/workflows/ci.yml`, `vitest.config.ts`, coverage thresholds
**Safety:** none.

### SCH-1 — manifest schema + types + validators

Zod schemas for Lesson, LessonVersion, Slide, Element, Effect, Interaction, Asset per spec
§27, with types inferred from the schemas rather than declared alongside them. Enforces
BR-001..004 at the type and runtime layer: integer non-negative ms, `endMs > startMs`,
`durationMs > 0`. Ships the §28 example manifest as the first fixture, used by every
later test.

**Files:** `packages/schema/src/*.ts`, `packages/schema/fixtures/*.json`
**Safety:** invariants 1, 3. Hardest item to reverse in the plan — after v1 the manifest is additive-only.

### SCH-2 — schemaVersion + migration harness

`migrate(manifest, targetVersion)` with a registered chain of steps, plus the test pattern
every future migration follows: old fixture in, new fixture out, round-trip asserted.
Constitution I requires a migration to ship in the same change as any schema change, so the
harness must exist before the schema can move.

**Files:** `packages/schema/src/migrate.ts`, `packages/schema/migrations/*`
**Safety:** invariant 3.

### EN-5 — element registry + plugin contract

The `ElementPlugin` interface enforcing FR-FWK-002's full contract — schema, editor
component, player renderer, inspector config, validator — as a type that will not compile if
partial. Registration is data, not a switch statement (Constitution I). Includes the scoped
data access boundary of FR-FWK-011: a plugin receives its own element and theme tokens, never
the lesson or user.

**Files:** `packages/core/src/registry/element.ts`, `packages/core/src/registry/types.ts`
**Safety:** invariant 5 — plugin-supplied content is untrusted input.

### EN-4 — effect registry + 8 MVP effects

Effects are **descriptors**, not CSS classes: each exposes `at(progress) -> style delta`.
Appear, Fade, Slide, Zoom, Pulse, Highlight, Dim, Disappear (FR-TIM-011). This shape is what
makes both seeking (§30.5: recompute, never replay) and server rendering possible — the
server evaluates `at(0)` with no clock and no DOM. Deterministic ordering for equal start
times (FR-TIM-014) is resolved here.

**Files:** `packages/core/src/effects/*.ts`
**Safety:** none.

### EN-1 — timeline resolver (pure)

`resolve(slide, timeMs) -> RenderState`: a pure function, no DOM, no clock, no React. Given a
slide and a time it returns every element's visibility, transform, and style. This is the
single most important item in the plan — it is simultaneously the parity guarantee
(Constitution V: one engine, so preview and player cannot diverge), the seek implementation,
and the reason SSR works at all (`resolve(slide, 0)` on the server needs nothing a server
lacks).

**Files:** `packages/core/src/resolve.ts`
**Safety:** none live; correctness is covered by QA-1.

### EN-2 — monotonic clock + transport

`performance.now()`-based clock with play/pause/seek and `visibilitychange` pause/resume
(BR-013, FR-PLY-008/009). Injectable so tests drive it synthetically (Constitution II) and so
the server can construct the engine without one. Never uses CSS animation delay as the source
of truth (FR-TIM-019).

**Files:** `packages/core/src/clock.ts`, `packages/core/src/transport.ts`
**Safety:** none.

### EN-3 — advance controller

The four advance modes (FR-ADV-001..004) plus the single-fire guard: one advance per slide
instance, no matter how many conditions fire at once (BR-007, FR-ADV-012). Required
interactions outrank the duration timer (BR-005). Media-end mode validates that its
controlling element still exists (BR-006, FR-ADV-007).

**Files:** `packages/core/src/advance.ts`
**Safety:** none.

### QA-1 — virtual-clock harness + BR-001..018 suite

The test infrastructure Constitution II mandates: an injectable fake clock, plus one named
test per business rule so compliance is greppable by rule ID. Every later wave writes tests
against this harness, so its ergonomics matter more than its coverage.

**Files:** `packages/core/test/harness.ts`, `packages/core/test/rules/BR-*.test.ts`
**Safety:** none.

### EN-6 — storage / asset / analytics adapter interfaces

The boundary that keeps us out of the backend business while still letting a host save
through its own API. `StorageAdapter` (load draft, save draft, list versions, publish),
`AssetAdapter` (upload, resolve URL), `AnalyticsAdapter` (emit — FR-AN-005). Ships an
in-memory reference so tests and `examples/nextjs` run with no server.

`saveDraft` carries an opaque version token and MUST be able to reject with a conflict rather
than overwrite (FR-DAT-006/007). Putting that in the *interface* rather than in each
implementation is what makes "never silently overwrite a newer server version" a property of
the framework instead of a hope about the host's endpoint.

**Files:** `packages/core/src/adapters/*.ts`, `packages/core/src/adapters/memory/*.ts`
**Safety:** invariants 1, 2, 4 — adapter payloads are the boundary where lesson data leaves the framework.

### RC-1 — React player component

`<LessonPlayer manifest={...} />` over the kernel. Subscribes to the transport, applies
`RenderState` to DOM nodes. Presentational only — no timing logic in React, which is what
lets ED-6 reuse it verbatim for preview and DX-2 reuse the kernel for web components.

**Files:** `packages/react/src/LessonPlayer.tsx`, `packages/react/src/SlideView.tsx`
**Safety:** invariant 5 — sanitize before render.

### NX-2 — CSS-driven logical-canvas scaling

Scale the logical canvas (FR-CAN-017/018) with `aspect-ratio` and a CSS custom property,
never a JS-measured `width`. A measured scale factor is unavailable on the server, so the
first paint would be wrong and snap on hydration — visible layout shift on every lesson load.
Doing this in CSS is what makes the server-rendered frame correct at zero JS.

**Files:** `packages/react/src/canvas.css`, `packages/core/src/geometry.ts`
**Safety:** none.

### NX-1 — RSC/client boundary + hydration safety

The split: a server component renders `resolve(slide, 0)` as static HTML; a `"use client"`
island mounts the clock and takes over. Rules enforced by lint and test — no `window`,
`document`, or `Date.now()` at module scope anywhere in core or the server entry; no
`prefers-reduced-motion` read in JS on the first pass (PL-4 handles it in CSS, since the
server cannot know the user's preference).

**Files:** `packages/react/src/server/*.tsx`, `packages/react/src/client/*.tsx`, exports map
**Safety:** invariant 5, sharpened — server-rendered markup ships inside the HTML document.

### NX-3 — Next.js App Router example app

`examples/nextjs`: loads a manifest in a server component, streams the first slide, hydrates
into playback. Doubles as the SSR regression fixture for QA-2 and as the copy-paste
integration doc. First point in the plan where the headline requirement is demonstrably true.

**Files:** `examples/nextjs/app/**`
**Safety:** none.

### QA-2 — SSR + hydration test suite

Asserts what the boundary promises: server HTML for `t=0` is byte-identical to the client's
first render, zero hydration warnings, and the first slide is present in the raw document
with JS disabled. Runs against NX-3 in CI.

**Files:** `packages/react/test/ssr/*.test.tsx`
**Safety:** none.

## Deferred & future

⏸️ **Vue and Svelte adapters** — the kernel is framework-agnostic by construction, but a
third adapter proves nothing DX-2 doesn't. *Re-open:* first real request, or when a second
consumer team appears.

⏸️ **Real-time collaborative editing** — out of MVP scope by spec §19 and it would reshape
ED-5's state model. *Re-open:* if two-editor conflicts (FR-DAT-006) become a common support
complaint rather than an edge case.

⏸️ **SCORM / xAPI export** — spec §10 excludes it from the first release. *Re-open:* first
enterprise LMS deal that requires it.

⏸️ **Canvas/WebGL render path for heavy slides** — only if QA-4 shows the DOM path missing
the 30fps floor on the reference device. Would arrive as an element plugin rendering into its
own canvas, not as a second whole-scene renderer (that would violate Constitution V).
*Re-open:* that measurement, not before.

⏸️ **Export lesson as video (MP4/WebM)** — the strongest argument for a canvas substrate, since
`canvas.captureStream()` makes it nearly free while DOM requires headless browser capture. Not
worth reversing the render substrate for a feature nobody has asked for. *Re-open:* if
customers ask for offline/broadcast distribution of lessons — and then solve it with
server-side headless capture, not by rewriting the renderer.

⏸️ **Offline learner playback** — needs a service worker and an asset-caching story neither
the schema nor the adapters currently model. *Re-open:* when a customer needs classroom
playback without connectivity.
