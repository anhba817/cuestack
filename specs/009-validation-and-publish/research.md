# Research: Validation and Immutable Publish

Nine decisions. The first three are findings rather than preferences — they came from discovering
that most of what PB-1 was asked to build already exists, in pieces, in three places.

---

## R-01 — The engine composes; it does not check

**Decision.** `checkLesson` calls `validate` from `@cuestack/schema`, `checkReachability` per slide,
`collectProblems` per slide, and `ElementPlugin.validate` per element. It owns exactly one rule of
its own: the static dead end (R-02). Everything else it does is arrangement — one vocabulary, one
severity model, one deterministic order, one location shape.

**Rationale.** This repository already contains three validators, and two of them already overlap:

| Where | What it reports | For whom |
|---|---|---|
| `schema/validate` Tier 1 | Structure: types, required fields, timing integers | Anyone loading a manifest |
| `schema/validate` Tier 2 | Referential: duplicate ids, `ADVANCE_MEDIA_NOT_FOUND`, `ADVANCE_INTERACTION_NOT_REQUIRED` | Anyone loading a manifest |
| `core/advance/reachability` | `ADVANCE_UNSATISFIABLE` — **the same four advance conditions**, plus two the schema cannot see | The learner, at runtime |
| `core/resolve/problems` | `ELEMENT_BEYOND_SLIDE`, on every resolve since Wave 1 | The timeline, and now the author |

So the risk was never that this feature would be hard. It was that it would become the **fourth**
copy of the advance rules, and that an author and a learner would be told different things about one
lesson. FR-009 states the consequence: "Two answers to one question is how a teacher learns to trust
neither."

Composing also settles what PB-1 *is*. It is not a new source of truth about lessons; it is the first
place all the existing sources are asked at once, on purpose, by somebody who can still fix the
answer.

**What each source contributes, and why none of them is enough alone.** The schema knows the format
and cannot know that a question traps a learner. `checkReachability` knows a slide's advance rule and
is called per slide at playback, never across a lesson before one. `collectProblems` runs inside
`resolve`, which is a rendering concern that happens to notice an authoring fault. Only a caller
standing outside all three can produce one ordered report with severities.

**Alternatives considered.**

- *Re-implement the rules in one engine and deprecate the others.* Cleanest on paper. It would delete
  the runtime reachability the player needs at the moment a learner is stuck, which is a different job
  from warning an author beforehand.
- *Extend the schema's Tier 2 with semantic rules.* Puts "is this lesson any good" behind the same
  gate as "is this a lesson", so a host loading a manifest would be told about missing alt text.

---

## R-02 — The static dead end lives beside the runtime one

**Decision.** `isDeadEnd(policy, maxAttempts)` joins `interactions/policy.ts`, immediately below
`isUnsatisfiable`. A required question is a dead end when its policy is `on_correct` and
`maxAttempts` is finite — the shape from which `isUnsatisfiable` can become true for some learner.

**Rationale.** Core already named this feature as the consumer. `isUnsatisfiable`'s header:

> The kernel does not rescue the learner by opening the gate. That would make the policy mean
> something other than what it says. It reports the condition, the player presents a way forward
> (FR-030), and **Wave 5's validation engine warns the author before a learner ever meets it.**

The two are the same rule asked at two moments — "has this learner run out" and "could anyone run
out" — and the reason they belong in one file is that they are exactly the pair that comes to
disagree. `policy.ts` already carries the subtleties: `on_first_attempt` completes on anything;
`on_attempts_exhausted` completes by definition; unlimited attempts cannot exhaust. A predicate
written in the validation engine would restate all three from memory, and the first time
`DEFAULT_COMPLETION_POLICY` changed, one of them would be wrong.

**The default matters here and is already right.** `DEFAULT_COMPLETION_POLICY` is `on_first_attempt`,
chosen with the comment "defaulting to `on_correct` would turn every unconfigured required question
into a potential dead end." So an author who configures nothing cannot create one, and the warning
fires only where somebody asked for correctness and capped the tries.

**Alternatives considered.** A rule inside the engine — the fourth-copy failure R-01 exists to avoid.
Reporting every `on_correct` question regardless of `maxAttempts` — unlimited attempts always
terminate, so that is a warning about nothing, and warnings about nothing are how a report stops
being read.

---

## R-03 — The shape is reused; a `source` discriminates; only the semantic codes are a closed union

**Decision.** The report carries issues in the schema's existing shape — `code`, `path`, `location`,
`message` — with a `severity` and a `source` alongside. Semantic codes form their own closed union in
core; plugin codes are arbitrary strings, and `source` is what keeps that from being a hole.

**Rationale.** Three separate judgements, all pulling the same way.

`IssueLocation` already carries what an editor needs to navigate to a problem, and FR-005's
jump-to-source is exactly that. Redefining the shape would give a host two vocabularies for one idea
and would leave the report unable to carry a schema issue without translating it.

Severity goes *beside* the issue rather than inside it because the same code can be either — BR-012's
accessibility rules are a warning by default and an error under policy (FR-010a). A severity baked
into the issue would have to be rewritten by the policy layer, which is a mutation of something that
reads like a fact.

Codes stay separate because `issues.ts` says so about itself: "`code` values are part of the public
contract — callers branch on them." That contract belongs to `@cuestack/schema`, and "this question
traps a learner" is not a statement about the format. A host that branches on a code should also be
able to tell which validator produced it, and two unions give that for free.

**Two things the first draft of this decision got wrong**, both found by reading the sources rather
than the design:

**The two unions already collide.** `RenderProblem` declares `UNKNOWN_ELEMENT_TYPE` and
`UNKNOWN_EFFECT_TYPE`; `ISSUE_CODES` declares the same two strings. So the benefit claimed above —
that a host can tell which validator produced an issue — was not actually delivered by having two
unions, because for those two codes the code is identical. They mean different things at the two
tiers: the schema means "no such type in the format", the resolver means "no such type in *this*
registry". A `source` field delivers the benefit properly and makes the collision harmless; renaming
would break two published vocabularies to avoid one field.

**A plugin's code cannot be in a union core owns.** `ElementPlugin.validate` returns
`PluginIssue` — `{ code: string; message: string }` — and the `string` is deliberate: a third-party
element type reports faults core has never heard of, which is the entire point of the extension
point. Declaring `SemanticCode` closed *and* sourcing plugin issues into it was a contradiction. The
union stays closed for what core owns; plugin codes sit beside it under `source: 'plugin'`.

`PluginIssue` also carries no location, so the engine supplies one. A plugin sees a payload and
cannot know which element it is or which slide that is on; the engine is iterating both at the moment
it calls.

**Alternatives considered.** One union in schema — makes core's rules the schema package's problem
and its release cadence. A fresh issue shape in core — two shapes for one idea, and a translation
layer nobody would keep correct. Renaming the two colliding codes — breaks two public vocabularies to
avoid one field.

---

## R-04 — Publishing is a fourth adapter

**Decision.** `PublishingAdapter`, beside `StorageAdapter`, `AssetAdapter`, and `AnalyticsAdapter`:
`publish`, `listPublished`, `loadPublished`, `withdraw`, `restore`, `readRecord`. In
`packages/core/src/publishing/` with its own in-memory reference.

**Rationale.** `StorageAdapter` is at four methods after ED-5 added `loadVersion`. Six more takes it
to ten and mixes two opposite lifetimes in one interface: a draft that changes every 1.5 seconds and
a version that must never change again. EN-6 divided adapters by *capability* rather than by subject,
and publishing is a capability a host may not have at all — an editor embedded in an LMS that
publishes through its own workflow needs storage and no publishing.

The split is also what makes FR-020 structural. **There is no method that modifies a published
version**, and in a file containing only publish/read/withdraw that absence is visible; in a file of
ten methods, six of which write, it would be a convention. This is the argument EN-6 already made
about the conflict token — "putting that in the *interface* rather than in each implementation is
what makes it a property of the framework instead of a hope about the host's endpoint."

**Withdraw and restore are not writes to a version.** They change which version is *active*, which is
a property of the lesson rather than of any version. That is why they can exist beside an interface
with no update method without weakening it.

**Alternatives considered.** Growing `StorageAdapter` — above. A `publish` method on storage with the
rest elsewhere — the worst of both, splitting one capability across two boundaries.

---

## R-05 — A published version is frozen on read, and there is nowhere to write one

**Decision.** Two mechanisms, deliberately both. The adapter offers no method that modifies a
published version, and `loadPublished` returns a deeply frozen manifest.

**Rationale.** The absent method is the guarantee; the freeze is what catches the honest mistake. A
host that hands the same object to a renderer which mutates it in place would violate BR-008 without
anybody writing a line of code that looks like a violation — and the framework has a renderer that
takes manifests, so this is not hypothetical.

Freezing is cheap here in a way it would not be elsewhere: a published version is read rarely
compared with a draft, which is resolved sixty times a second. The draft is deliberately **not**
frozen for exactly that reason.

**Alternatives considered.** A structural clone per read — costs more than a freeze and gives a
mutable copy, which is the problem restated. Trusting the host — BR-008 is a business rule, and a
business rule enforced by trust is a business rule until somebody is in a hurry.

---

## R-06 — Asset availability is two checks at two strengths, sharing one reference-finder

**Decision.** `collectAssetRefs(manifest)` is pure and shared. The optional async pass resolves them
and reports **warnings**; `publish` resolves them again and refuses on an **error**.

**Rationale.** The clarification settled *that* it happens twice; the design decision is that the two
share the finder. FR-016b says why: "One rule reported at two strengths is a courtesy; two rules
disagreeing about which assets a lesson uses is a defect." A separate walk in the publish path is
precisely how the report ends up saying a lesson is fine while publishing refuses it for an asset the
report never looked at.

Keeping the finder pure also keeps the engine pure. Which assets a lesson references is a fact about
the manifest; whether they exist is a question for the outside world, and only the second needs to
wait.

**Alternatives considered.** Caching the validation-time answer for the publish check — the answer's
ability to change between the two moments is the entire reason there are two. A single async engine —
rejected in clarification, and it would put a network round trip in front of every report.

---

## R-07 — Severity is applied by a pure function, and policy cannot silence

**Decision.** `severityFor(code, policy)` in `validation/severity.ts`. Codes are inherently `error`
or `warning`; a policy may raise a policy-governed code to `error` or lower it to `warning`. There is
no `off`.

**Rationale.** FR-010b, and the reason is worth keeping visible: "A rule an organisation does not
want blocking is a warning, and a rule nobody wants to see is a rule that should not exist." A
silenceable rule set drifts towards silence, one incident at a time, and the framework ends up with
rules that are technically present and practically absent.

Which codes are policy-governed is a property of the code rather than of the policy, so an
organisation cannot make a structural error into a warning. The schema's issues are always errors —
a manifest the format rejects is not publishable regardless of anybody's policy.

**Alternatives considered.** Per-rule defaults, so alt text is an error and captions a warning —
rejected in clarification; it also puts an accessibility judgement in the framework, which is the
call BR-012 explicitly delegates. A policy that can silence — above.

---

## R-08 — The publish flow drives ED-5's save loop, which must learn to say when it is done

**Decision.** `DraftPersistence.saveNow()` returns `Promise<SaveOutcome>`. The publish flow awaits it,
and publishes only on success.

**Rationale.** FR-018a requires publishing to save first and publish what was saved. Today `saveNow`
returns `void`, so a caller can start a save and cannot learn whether it landed — and a publish that
proceeded on hope would publish a state storage never held, producing a version nobody can reproduce
and a record that points at nothing.

This is a change to a file feature 008 owns, made by a feature that does not otherwise touch it,
which is why it is listed as a single-owner file. It is additive: `saveNow()` is currently called for
its effect and ignoring a returned promise is legal, so the existing example app and tests are
unaffected.

**The failure paths come with it, and they are not about the lesson.** An unreachable storage, a
permission refusal, and an unanswered conflict are all reasons a publish does not happen. The spec's
edge case is explicit that the message must distinguish them from a lesson that failed validation:
"a teacher told the wrong one goes looking in the wrong place."

**Alternatives considered.** A separate `saveAndSettle()` — two ways to save, and the wrong one is
the shorter name. Publishing the in-memory draft and saving afterwards — publishes something that
might never be saved, which is the failure FR-018a was written against.

---

## R-09 — Withdrawal changes availability; the framework never interrupts a learner

**Decision.** `withdraw` clears the active version and leaves every version in place.
`loadPublished` with no active version answers *withdrawn* rather than *not found*. Nothing in the
framework stops a player mid-lesson.

**Rationale.** The clarification settled the behaviour; the design consequence is that "withdrawn"
and "not found" must be distinguishable in the result type, because a host that cannot tell them
apart will show a learner "this lesson does not exist" about a lesson that plainly does.

The reason the framework does not interrupt is that it cannot know which kind of withdrawal this is.
A lesson withdrawn because it teaches something wrong should stop everyone immediately; one withdrawn
because term ended should let the class finish — and nothing in a manifest says which. A framework
that guessed would be wrong half the time, in the half where being wrong matters most.

**Restore creates no version.** FR-031, and it follows from what withdrawal is: if withdrawing did
not change any version, restoring has none to create.

**Alternatives considered.** Withdrawal as a new version with an "unpublished" flag — makes the
version list grow with events that are not versions, and makes "the most recently published version"
mean something other than what it says. A hard delete — FR-030, and a framework that could destroy a
published version could be asked to.


---

## R-10 — Accessibility metadata is the engine's rule, not a plugin's

**Decision.** `ACCESSIBILITY_METADATA_ABSENT` is produced by the engine, reading `element.accessibility`
directly. It is not sourced from `ElementPlugin.validate`.

**Rationale.** `accessibility` is a **common element field** — `altText`, `label`, `announce` — declared
beside `payload` rather than inside it. `ElementPlugin.validate(payload)` receives only the payload, so
it cannot see the accessibility bag and could not report on it if it wanted to.

An earlier draft of the data model attributed this rule to plugins, which would have been wrong twice
over. It would not work, and even if the signature were widened it would make BR-012 — the one rule an
organisation's policy governs — depend on every plugin author implementing it identically. A rule that
can block a publish should have exactly one implementation.

**What plugins are for, by contrast**, is the half core cannot reach: whether *this* payload is
coherent. A question with a correct-answer id that names no option, a video with a poster but no
source. Those are per-type facts, and the registry is the only thing that knows them.

**Alternatives considered.** Widening `ElementPlugin.validate` to receive the whole element — makes
every plugin able to report on fields it does not own, and invites two plugins to disagree about a
common field. Leaving accessibility unchecked until a plugin opts in — BR-012 exists precisely because
an organisation may need it enforced, and enforcement that depends on plugin authors is not enforcement.

---

## R-11 — One advance problem per slide, accepted

**Decision.** `checkReachability` returns `BlockingProblem | null` — at most one problem per slide —
and the engine uses it as it is rather than reaching past it into the individual checks.

**Rationale.** FR-001 requires every issue in one pass, and this is the one place the engine reports
fewer than it theoretically could. Accepted for two reasons.

The conditions are mutually exclusive in practice: a slide advances on media *or* on an interaction,
so the checks that could both fire cannot both apply. What the single answer really costs is the
second fault of a *sequence* — a media element that is both the wrong type and failed to load — and
the first is the one an author must fix before the second can matter.

The alternative costs more than it buys. Reaching past `checkReachability` into its internals would
give the engine its own copy of the advance rules, which is the fourth-copy failure R-01 is arranged
to prevent — and it would do so to report a second problem that becomes visible the moment the first
is fixed and the report is re-run.

**Recorded rather than hidden.** [contracts/validation-contract.md](./contracts/validation-contract.md)
§3 states it as a limit of the promise, so a reader does not have to discover it from a lesson with
two faults and one issue.


---

## R-12 — The seven MVP types get real plugins, and their `resolve` changes nothing

**Decision.** `packages/core/src/elements/builtin/` gains a complete `ElementPlugin` for each of
`text`, `image`, `shape`, `video`, `audio`, `button`, and `question`. `DEFAULT_ELEMENTS` is built
from them. Each plugin's `resolve` returns `{ visible: true }` and contributes nothing, so nothing
about playback changes.

**Rationale.** This feature's headline was that `ElementPlugin.validate` finally gets a consumer.
Reading the registry showed the other half: it has never had a **producer** either. There are no
concrete `ElementPlugin` implementations in the shipped framework — only in test harnesses — and
`DEFAULT_ELEMENTS = createElementRegistry()` is empty. The seven types carry a renderer in
`@cuestack/react` and an editor in `@cuestack/studio`, and no core plugin.

So a validation engine that called `plugins.get(element.type)` would get `undefined` for every
element in every lesson a teacher can author. SC-001 — "every registered element type contributes its
own checks" — would have been satisfied by zero types, which is the kind of green that means nothing.

Constitution I settles what to do about it rather than leaving it to taste: "A plugin MUST supply its
full contract before merge: data schema, editor component, player renderer, inspector configuration,
and validator. **Partial plugins are rejected.**" The seven have been partial since Wave 1. No
feature until now depended on the missing member, which is why it surfaced here.

**The `resolve` member is the risk, and neutrality is how it is managed.** `resolve/element.ts` calls
`plugin.resolve` and composes its contribution; a plugin that returned geometry or style would change
what every lesson renders, at the moment this feature is supposed to be adding *checks*. So each
plugin's `resolve` returns `{ visible: true }` with no contribution — the same outcome the code
already produces when no plugin exists — and a parity suite asserts the change is invisible
(FR-006b, SC-001a).

**Registering them turns off an escape hatch, deliberately.** `resolve/element.ts` reads
`const known = plugin !== undefined || elements.types().length === 0` — an empty registry treats
every type as known. With seven registered, an unregistered eighth is now reported. That is the
correct behaviour and it is a behaviour change: any existing test that relied on the empty-registry
escape to use an invented type will start seeing `UNKNOWN_ELEMENT_TYPE`, and those are migrated in
the same change rather than worked around.

**What each `validate` checks is bounded by R-01's discipline.** Not what the schema already rejects.
The format already reports a correct answer naming no option, so `question.validate` covers what the
format cannot: a single-option question, an empty prompt. Anything a plugin restates produces two
issues for one fault (FR-006c).

**Alternatives considered.**

- *Ship the engine with the seam empty and record it as an obligation.* Honest, and it means PB-1
  reports nothing type-specific for any type in the product. The feature's own spec calls
  `ElementPlugin.validate` the seam; a seam with no producers is a hole with a name.
- *Put the checks in the engine, keyed by type.* Exactly the `switch (element.type)` Constitution I
  calls a defect, and the thing SC-001 exists to measure the absence of.
- *Register plugins for some types now and the rest later.* The worst option available. With a
  partial registry the escape hatch is off and every *unregistered* type is reported unknown — so a
  half-migration would flag five of the seven types in every lesson.


---

## R-13 — The plugins declare the inspector fields; the studio adds only what editing needs

**Decision.** Each builtin plugin's `inspector` carries that type's canonical field list.
`builtinElementEditors` derives its `inspector` from `builtinElements` rather than restating it, and
adds only what editing requires. **The merge is per field, by key**, not per type: `defaults` and
`textSurface` are type-level, but `fromStored`/`toStored` and `itemDefaults` hang off individual
fields. `Inspector.tsx`'s precedence is inverted for the case where both describe one type: the
editor registry wins where it has an entry, and a plugin wins for a type it does not know.

**Rationale.** R-12 made `resolve` inert and asserted playback is unchanged, and stopped there.
`resolve` is not the only member with a side effect: `Inspector.tsx` reads

```ts
const pluginSpec = plugins?.get(element.type)?.inspector?.fields as readonly EditorField[] | undefined
const typeFields = pluginSpec ?? editors.get(element.type)?.inspector
```

so a registered plugin's spec **replaces** what a teacher sees for that type. Seven new plugins would
therefore change the authoring surface for all seven types, inside a feature about adding checks.
FR-006b said "must not change what any lesson renders", which is exactly half the neutrality needed.

**Two lists would be the wrong fix.** Hand-maintaining a plugin spec that mirrors the editor registry
gives two sources of truth for one thing, joined by a cast that would not catch a divergence — which
is the failure R-01 arranges this entire feature to avoid. So there is one list, in core, where the
plugin contract already says it belongs, and the studio extends it.

**Getting the granularity wrong would ship a visible bug**, which is why it is stated rather than
left to the implementation. `question`'s options field carries
`itemDefaults: (count) => ({ id: \`option-${count + 1}\`, ... })` — a *function*, which
`InspectorField` has no room for and which `EditorField` adds. Its comment names the failure it
exists to prevent: without it "an item of blank strings fails the schema's minimums, so 'Add option'
was refused by validation and appeared to do nothing." A derivation that spread core's fields and
then added type-level extras would drop it silently, and the symptom would be a button that does
nothing rather than an error anybody could search for.

So the rule is: core declares what a field *is* — key, label, kind, options, `of`, `minItems` — and
the studio overlays, by key, what a field needs in order to be *edited*. Both halves already exist;
what changes is that the description is written once.

**Corrected during implementation: it is a merge, not an inversion.** This decision originally
called for the editor registry to win where both describe a type. Feature 005's **FR-018** settles it
the other way — "the inspector MUST source an element type's fields from that type's registered
plugin" — and two of its suites assert exactly that. Inverting would have contradicted a shipped
requirement to solve a problem a merge solves better.

So the plugin's field list wins, and the studio overlays **only** the three members that describe
editing rather than the field: `toStored`, `fromStored`, and `itemDefaults`. Overlaying the whole
editor entry was the second wrong answer — it let the editor override a plugin's own label, so a host
registering a plugin to rename a field would find the rename ignored.

The result satisfies both concerns at once. FR-018 keeps the list; the transforms and `itemDefaults`
survive; and for the seven builtins the two lists are identical by construction, so the merge only
ever adds. The paragraph below is kept for the reasoning it carries about *why* the extras matter,
with its conclusion corrected.

**The transform problem is real, and it is what the overlay is for.** `EditorField extends InspectorField` by adding
`fromStored`/`toStored`, and the plugin path is *cast* rather than converted — so a plugin spec
lacking a transform silently replaces an editor entry that has one. `fields.ts`'s own header names the
resulting failure: writing `background.color` on a slide with no background produces `{ color: '#fff' }`
with no `kind`, "leaving the teacher with a colour picker that never works." No *element* type uses a
transform today, so this is latent rather than live — which is the best moment to fix it.

Nothing about feature 005 is amended. Its comment — "A registered plugin wins; the editor registry is
the fallback for the built-ins" — remains true, and the merge simply adds what a plugin cannot
express to the list the plugin owns.

**Registering the seven does not compose them into a host's own registry**, and the guidance that
follows is new even though the behaviour is not. `resolve` reads `context?.elements ?? DEFAULT_ELEMENTS`,
so a non-empty default helps only callers who pass nothing. A host that registers one custom type gets
a registry of one — and with the empty-registry escape now off, its other six types are reported
unknown. That was already true; what changes is that it now matters, so composing
`createElementRegistry([...builtinElements, mine])` moves from irrelevant to mandatory. It is the
sharpest edge this feature exposes to a host, and it belongs in the README rather than in a release
note nobody reads.

**Alternatives considered.** An empty `inspector` on each plugin — `assertComplete` requires the
member, and `[]` is not nullish, so the `??` would select it and a teacher would see no type fields at
all. Merging the two lists by key — more machinery than one inversion, for a case where one list is
already a superset of the other.

---

## R-14 — `ElementPlugin.schema` has seven producers and still no consumer

**Decision.** Each builtin plugin's `schema` delegates to `@cuestack/schema`'s per-type validation
rather than hand-rolling a type guard. It is recorded as a carried obligation rather than given a
consumer here.

**Rationale.** `assertComplete` requires `schema` at registration — a plugin without one is refused —
and **nothing anywhere calls it**. So this feature, which exists partly to give
`ElementPlugin.validate` its first consumer, hands `schema` seven producers and leaves it exactly
where `validate` was.

That is worth writing down rather than quietly satisfying. It is the tenth instance of this project's
recurring pattern and the first to arrive from the other direction: not a contract member built ahead
of its consumers, but one required at the boundary and read by nobody.

Delegating rather than hand-rolling is what keeps that honest. Seven bespoke type guards nobody runs
would be seven places to drift from the format they claim to check; delegation means that if a
consumer ever arrives, what it gets is the same answer the schema already gives.

**Alternatives considered.** Making `checkLesson` call `schema` before `validate` — it would duplicate
the structural tier the engine already delegates to, which R-01 refuses. Dropping `schema` from the
contract — a change to the plugin contract, and out of scope for a feature about publishing.


---

## R-15 — Registration failure becomes an import failure, and that is the right trade

**Decision.** `DEFAULT_ELEMENTS` is built at module scope from the seven, so `assertComplete` runs
when `@cuestack/core` is imported. A malformed builtin therefore fails the import rather than a test.

**Rationale.** `createElementRegistry` validates each plugin and **throws** on an incomplete one, with
a message naming the missing member — Constitution I's "partial plugins are rejected", enforced at the
only moment it can be. Until now no plugin was ever registered by default, so that path never ran
outside tests.

Failing at import is louder than failing in a suite and arrives sooner: a missing `validate` on a
builtin becomes an error the first time anything imports the kernel, rather than a green build with
one type quietly unchecked. Given the whole point of this feature is that a missing validator "passes
publication checks it should fail", failing loudly is the consistent choice.

It is still a new failure mode for the package, which is why it is written down. The mitigation is a
test that exercises it deliberately rather than discovering it: an incomplete builtin is refused, and
the message names what is missing.

**Alternatives considered.** Building the registry lazily on first `resolve` — moves the throw to a
frame of playback, which is the worst possible moment. Catching and degrading to an empty registry —
restores the "everything is known" escape by accident, and silently unregisters the type whose
registration failed.
