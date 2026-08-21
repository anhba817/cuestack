# Data Model: The Authoring Guide and the Second Adapter

## 1. The line, restated

| Kind | Lives where | Stored | Changes after it exists |
|---|---|---|---|
| Element contribution | across three packages | no — it is code | whenever its author changes it |
| The guide | the repository | as Markdown | with the contracts it describes |
| The guide's example | the test suite | as a registered type | with the contracts, or the build fails |
| Adapter instance state | one custom element | never leaves the element | every frame |
| Agreement report | recomputed on demand | never | n/a — discarded and remade |

Ten features have added things a host stores. **This one adds nothing.** A guide is a file, an adapter
instance is a DOM node's private state, and an agreement report is a comparison discarded after it is
printed. That is worth stating because it decides what can go wrong: there is no migration, no
persistence, and no state anybody else can observe.

---

## 2. `ElementContribution` — the thing the guide exists to make visible

Not a type in the codebase. A **fact about the codebase** that no single file states: a third-party
element type is **four** contributions across **four** packages, three of them registrations and one a
versioned change to the format itself.

| Piece | Package | Contract | What its absence causes |
|---|---|---|---|
| Plugin | `@cuestack/core` | `ElementPlugin` | `createElementRegistry` throws at registration, naming the missing member |
| Renderer | an adapter | `ElementRenderer` (React), the adapter's own equivalent elsewhere | The element is reported unavailable and the rest of the slide still plays |
| Editor registration | `@cuestack/studio` | `ElementEditor` | The type is absent from the Add menu, which a teacher discovers rather than a test |
| **Format variant + migration** | `@cuestack/schema` | an additive variant in the element union, and a migration step | **A lesson using the type cannot be saved at all.** `element.ts` declares `z.discriminatedUnion('type', variants)` over seven literals, so `validate` rejects the manifest |

**The fourth is the one that looks optional and is not.** With the first three an author has a type
that registers, renders, and appears in the Add menu — every signal says it works — and then the
lesson will not save. It fails last, after the most work, and for a reason none of the earlier
failures hints at.

**It is also the only piece that is not a registration.** The other three are things a host supplies
at runtime; this is a MINOR change to a published format, with a migration and a `schemaVersion` bump.
The distinction the guide must draw is between what the **kernel** needs (nothing — no edit to
resolution, timing, the canvas, the timeline, or the player, which is Goal 5's claim) and what
**shipping a type to authors** needs.

**The plugin's own members**, since Constitution I rejects a partial one:

| Member | Purpose |
|---|---|
| `type` | The discriminant, matching the manifest |
| `schema` | A guard over the payload |
| `resolve` | What this type contributes to a rendered frame |
| `inspector` | The fields an author edits |
| `validate` | What the format cannot check about this payload |
| `renderStateVersion` | Refuses a contribution shaped for a different kernel |

**Note the asymmetry the guide has to explain.** A missing plugin is loud — registration throws. A
missing renderer is quiet and survivable. A missing editor registration is silent until a teacher goes
looking. Three different failure modes for three pieces of one thing is exactly the kind of fact that
lives only in the heads of people who have already made the mistake.

---

## 3. What a plugin can reach, and why the restriction is the interesting part

`ElementResolveInput` carries a payload, a geometry, a slide time, and a theme. It does **not** carry
the lesson, the slide, the sibling elements, the transport, or anything about the learner.

Enforced by the signature rather than by documentation: there is nowhere to reach for the data. The
guide must say *why*, because an author who thinks it is distrust will ask for an exception, and an
author who understands it will not — a plugin *able* to read the whole lesson becomes one that does,
and then the lesson shape cannot change without breaking third-party code.

---

## 4. `LessonElement` — the second adapter's public surface

One custom element. Its whole API is attributes and properties, because that is what the platform
gives a host that is not using a framework.

| Input | Kind | Notes |
|---|---|---|
| `manifest` | property | The lesson. A property rather than an attribute: a manifest is an object, and stringifying one into markup is a size and escaping problem nobody needs |
| `src` | attribute | Where to fetch a manifest, for a host that would rather write markup |
| `autoplay` | attribute | Whether to start on connect |
| `resolveAsset` | property | `assetId` → address. Absent means images report themselves unavailable, which is R-03's conditional |

**Note what is absent**: no registries, no storage, no analytics adapters. A proof-scoped adapter that
took a storage adapter would be claiming a capability it does not have.

**One exception, which the first draft of this paragraph denied.** A `ports` property exists and
takes the time and visibility ports — a *test seam*, so a suite can drive lesson time by hand rather
than wait out real durations, which Constitution II requires. It is settable and therefore public, so
saying "no ports" was inaccurate in print while being right in spirit. A host has no reason to set
it, and the README now says so where a host will read it.

**Events out**, because a host with no framework has no other way to hear anything: lesson started,
slide changed, lesson completed, and a problem the learner is seeing. Names and shapes in
[contracts/element-adapter.md](./contracts/element-adapter.md).

---

## 5. `InstanceState`

Per element, and never global (FR-016).

| Held | Why it cannot be shared |
|---|---|
| Clock | Two lessons on a page are at two times |
| Transport | Two lessons are on two slides |
| Advance controller | Its decisions are keyed on slide *instance*, which is per lesson |
| Slide index | The last index drawn, so a change is detectable and the node map can be cleared |
| Running transition | The leaving stage, its deadline in lesson time, and the slide it is entering |
| Frame loop handle | Cancelled on disconnect, or the page leaks a loop per lesson ever mounted |
| Shadow root and node map | The elements this instance wrote, addressed by id |

**The slide index is state, not a derived value.** It is compared against the transport's each frame
so that entering a slide is an *event* — the node map is cleared, the outgoing stage is cloned, and
the transition starts. Reading the transport alone tells you which slide you are on, never that you
just arrived, and every one of those three actions must happen exactly once.

**The running transition holds `toIndex` alongside its deadline** because the deadline is measured on
the incoming slide's clock, and navigating elsewhere resets that clock to zero — leaving the
comparison permanently unsatisfied and two stages on screen forever.

**Disconnect is the one that gets forgotten.** A custom element that starts a rAF loop in
`connectedCallback` and does not cancel it in `disconnectedCallback` leaves it running forever — and
the symptom is a page that gets slower the longer somebody uses it, which nobody traces back to a
lesson they closed.

---

## 6. `AgreementReport`

| Field | Notes |
|---|---|
| `at` | The instants compared. **They must straddle a slide boundary** — see below |
| `differences` | Slide, element, property, and the two values |
| `covered` | Which types were in scope for the comparison |
| `compared` | How many elements *both* adapters drew |

**`covered` exists because the adapter is a subset.** A report that did not say what it skipped would
read as "the adapters agree" when it means "the adapters agree about text and shapes".

**`compared` exists because a comparison's real failure mode is comparing nothing.** With one adapter
rendering an empty container, every element is "present in one only", nothing can disagree about a
*value*, and the report is clean. "They agree" and "nothing was asked" otherwise print the same line.
Two further disguises for the same thing were met and are worth naming: a clock jumped in one step
rather than advanced in frames does not move a lesson (the kernel clamps a single tick), and a player
that was never told to play holds its first frame forever. Both produced plausible-looking findings
about element lifetimes.

**The instants must cross a slide boundary**, and the report asserts that they did. A set of instants
inside one slide never asks whether the two adapters change slide at the same moment, which is the
largest thing they could disagree about.

**It is a report and not an assertion** (FR-011). It runs, prints, and exits zero — the difference is
information about two renderers over one kernel, not a bug in either.
