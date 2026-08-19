# @cuestack/core

The headless kernel. Computes what a slide looks like at a given time; renders
nothing, reads no clock, touches no DOM. Zero runtime dependencies beyond
`@cuestack/schema`, whose types are erased at compile time.

## resolve

```ts
import { resolve } from '@cuestack/core'

const state = resolve(slide, 2500)
// state.elements — visible elements, already in paint order
// state.problems — non-fatal findings, e.g. content past the slide's end
// state.blocked  — set when the slide cannot meaningfully be played
```

`resolve` is a **fold, not a state machine**. Every effect active at the given time
is evaluated and the results composed; nothing accumulates between calls. That one
property is why:

- **Seeking is correct.** There is no replay path — a time is just an argument.
- **Server rendering works.** `resolve(slide, 0)` needs no browser and no clock.
- **Preview and playback cannot diverge.** One function, no memory, so arriving by
  a different route cannot produce a different answer. Proven by a sweep over
  every state-change boundary in the test corpus.

`elements` arrives pre-sorted. Do not re-sort it: two consumers sorting
independently is two chances to sort differently.

`transform` is kept separate from `geometry`. An element translated 40px by a
slide-in is still *authored* where it was — the editor needs the authored value,
the player needs the effective one, and collapsing them loses that distinction
irrecoverably.

## Transport

```ts
const transport = createTransport(lesson, ports)
transport.play()
transport.seek(4000)      // returns the resulting snapshot, synchronously
transport.subscribe((snapshot) => { /* already committed when called */ })
```

Lesson time accumulates from an injected source and is clamped at 250ms per tick.
A larger gap is treated as time that did not happen in the lesson — which covers
machine sleep, a blocked main thread, and a paused debugger identically. While the
host document is hidden, time does not advance at all.

## Advancement

```ts
const controller = createAdvanceController(ports)
const decision = controller.evaluate(slide, transport, signals)
if (decision) transport.goToSlide(transport.slideIndex + 1)
```

`evaluate` is a **query, not a command**: it decides nothing about performing the
advance. That lets a test assert the decision without a transport, and lets an
editor show "would advance now" without advancing.

A slide instance advances at most once. The guard keys on *instance*, not slide id,
so a learner navigating backward can replay a slide and advance again.

`controller.reachability(slide)` reports a rule that can never be satisfied — a
failed video, a required question that disappears before the slide ends. Without
it, a stalled slide and a deliberately-manual slide look identical.

## Registries

New element and effect types are added by registration; the resolution path
contains no knowledge of any specific type, and a lint rule forbids dispatching on
a type discriminant outside a registry.

```ts
const elements = createElementRegistry([myPlugin])
const effects = createEffectRegistry([...builtinEffects, myEffect])
resolve(slide, t, { elements, effects, theme })
```

A plugin must supply its full contract — schema, resolve, inspector, validate, and
the `RenderState` version it targets — or registration is refused with the missing
member named. A plugin receives **only** its own payload, geometry, the slide time,
and the theme. Never the lesson, its siblings, the transport, or anything about the
learner.

### An effect declares its parameters

`EffectDescriptor.parameters` is a list of `InspectorField`, so a consumer can offer
what an effect accepts rather than keeping a table of its own — which would be a
per-effect branch by another name and would rot the first time a ninth effect
registered.

```ts
export const shimmer: EffectDescriptor = {
  type: 'shimmer',
  phases: ['emphasis'],
  motion: false,
  defaultEasing: 'linear',
  parameters: [{ key: 'intensity', label: 'Intensity', kind: 'number' }],
  at: (progress, params) => ({ opacity: 1 - (Number(params?.intensity) || 0.5) * progress }),
}
```

**One difference from an element's inspector fields, and it is load-bearing.** On an
element a `key` is a *dotted path* from the element root (`payload.text`); on an
effect it is a *flat key* into `effect.parameters` (`intensity`). Sharing the type
must not become sharing the read.

The declaration says what *may* be set — it is not a source of defaults. `at()` keeps
its own, because it is called per frame on a server where `parameters` may be absent.

**Whichever registry the editor offers from must be the one `resolve` uses.** A
registry reaching a menu but not `ResolveContext.effects` produces an effect a teacher
can add and the resolver reports as `UNKNOWN_EFFECT_TYPE`.

An unregistered *optional* type degrades to a placeholder and the slide still
resolves. An unregistered *required interaction* type blocks. The asymmetry is
deliberate: losing a decoration costs some content, while silently skipping a
question that gates progression strands the learner.

## Ports the host must supply

The complete list of things the kernel cannot do itself:

| Port | Direction | Supplies |
|---|---|---|
| `time` | read | monotonic milliseconds |
| `media` | read only | position, duration, ended, paused, failed |
| `visibility` | read + subscribe | whether the document is hidden |
| `storage` | read/write | lesson load and save, with a conflict token |
| `assets` | read | asset id to location |
| `analytics` | write | event recording |

`memoryAdapters()` implements the last three so the framework works with no host
code at all. Its storage issues real tokens and genuinely rejects stale saves, so
the conflict path is exercised by default rather than only by the first real host.

## What this package will never do

Render, read a clock, touch the DOM, validate a manifest, or decide about reduced
motion. It reports which effects are motion and stops there — the preference cannot
be read on a server and the substitution is a stylesheet concern.

## The storage boundary, extended (feature 008)

`StorageAdapter` gained three things when ED-5 became its first consumer. All additive; nothing
in the lesson manifest changed, so no `schemaVersion` bump follows.

**A save may declare itself a checkpoint.**

```ts
saveDraft(lessonId, manifest, token, { checkpoint: { label } })
```

Every save advances the token, checkpoint or not — a conflict cannot be detected otherwise. Only
a checkpoint adds an entry to `listVersions`. A save that records no checkpoint **still
persists**: it is absent from the history, not absent from storage. An adapter treating one as a
no-op would pass every history test and lose an hour of work.

**`VersionSummary` is now `VersionEntry`**, carrying `recordedAt` (epoch milliseconds, stamped by
you — your storage is the only participant with an authoritative clock) and an optional `label`.
`listVersions` returns checkpoints, not saves: with autosave firing every 1.5 seconds of idle,
one entry per save is not a history anybody can read.

**`loadVersion(lessonId, token)`** returns an earlier version's content. Note the token it
returns: the **current** draft's, not the loaded version's. What comes back is content to be
saved forward as a new version, and returning the old token would make the very next save look
like a conflict. That single rule is why restoring is additive rather than destructive.

New ports, declared here and implemented in `@cuestack/react`: `Scheduler` (deferred execution)
and `Connectivity` (the network signal). Neither joins `Ports` — playback defers nothing and does
not care whether the network is up — and both are the first ports here with no consumer inside
core, which follows from core being the contract package.

## The publishing boundary (feature 009)

The fourth adapter, and the first thing this framework produces that has no edit path at all.

```ts
publish(lessonId, manifest, by)      -> PublishResult
listPublished(lessonId)              -> readonly PublishedVersion[]   // newest first
loadPublished(lessonId, versionId?)  -> LoadPublishedResult
withdraw(lessonId, by)               -> ActionResult
restore(lessonId, by)                -> ActionResult
readRecord(lessonId)                 -> readonly RecordEntry[]
```

**What it deliberately lacks is the interface.** There is no `update`, no `delete`, no route to
edit the record, and no arbitrary `setActive`. BR-008 says a published version is never modified,
and a rule expressed as a guard is a rule some adapter forgets: expressed as an absence, a host
implementing this interface has nowhere to put such a route even if it wants one. If a version is
wrong, publish another and withdraw this one — both leave the wrong one on the record, which is
the point.

**Versions are deeply frozen on read, and the draft never is.** The object handed out is the one a
renderer might mutate, and this framework ships a renderer that takes manifests. Affordable here in
a way it would not be for a draft: a published version is read rarely, a draft is resolved sixty
times a second.

**The active pointer is a property of the lesson, not a field on a version.** That is what lets
withdrawal change availability without touching anything immutable — `withdraw` clears the pointer
and deletes nothing, so `loadPublished` answers *withdrawn* rather than *not found*, and `restore`
puts the pointer back without creating a version.

**`publishedAt` is the host's clock**, following the rule ED-5 set for checkpoints: your storage is
the only participant with an authoritative clock, and the studio may not read one at all.
`schemaVersion` is recorded so it can be honoured, never upgraded — bringing a published version
forward would change what a learner receives.

## Validation (feature 009)

`checkLesson(manifest, { elements, effects, policy })` answers a different question from
`@cuestack/schema`'s `validate`. That one asks *is this structurally a lesson*; this one asks *is
this a lesson worth giving to a learner* — dead ends, unreachable slides, missing alt text,
elements outside their slide.

The test for which side a new rule belongs on: **could a well-formed lesson fail it?** If yes it is
semantic and belongs here; if a manifest failing it could not be loaded at all, it belongs in the
schema.

It composes rather than checks. `validate`, `checkReachability`, `collectProblems`,
`resolveElement`'s unknown-type reporting, each type's own `ElementPlugin.validate`, and one rule of
its own — the static dead end, which lives in `interactions/policy.ts` beside the runtime predicate
it mirrors. Pure, deterministic, and complete in one pass.

**The asset check is separate and async on purpose.** `collectAssetRefs` is pure and shared by both
the warning pass and the publish check; `checkAssets` is the round trip, and a caller that cannot
afford it skips it and still gets every other issue.

**`builtinElements`** registers the seven MVP types. Their `resolve` is inert — `{ visible: true }`,
exactly what the resolver already did with no plugin — so registering them changes nothing a learner
sees. Note the consequence: `resolve` treats an **empty** registry as "every type is known", so with
a non-empty default an unregistered type is now reported. A host adding one composes
`createElementRegistry([...builtinElements, mine])`; a registry holding only a custom plugin reports
all seven MVP types as unknown.
