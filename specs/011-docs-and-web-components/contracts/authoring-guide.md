# Contract: what the authoring guide promises

The guide's subject is the **contracts**, not the internals. A reader finishing it can add an element
type; a reader wanting to change the resolver is reading the wrong document.

---

## 1. What it must contain

| Section | Why it cannot be omitted |
|---|---|
| The four pieces, and their four packages | The single fact no file in the codebase states |
| **Who can complete each piece** | Three are registrations a host supplies at runtime; the fourth is a change to a package a host *consumes*. A reader who cannot make it needs to know before, not after |
| That the fourth is a *format* change, not a registration | Three registrations produce a type that works everywhere except in a saved lesson |
| What the **kernel** needs (nothing) versus what **shipping to authors** needs (a schema minor and a migration) | Conflating them makes a developer conclude either that the framework is closed or that a step is skippable |
| Every member of `ElementPlugin`, and what its absence causes | Constitution I rejects partial plugins; an author meets that refusal before they finish |
| What a plugin can reach, and **why** it cannot reach more | An author who thinks the restriction is distrust asks for an exception |
| Effects, as well as elements | Both are registered contributions and only one of them is obvious |
| Registering with a host's own registry | A supplied registry *replaces* the default rather than extending it — the cliff feature 009 documented, which a third-party author meets first |
| Validation, and what belongs in the schema instead | The line is "could a well-formed lesson fail it?", and an author who gets it wrong writes a rule the format already enforces |

---

## 2. The three failure modes, which are not the same

A guide that treated these alike would be teaching an author to expect the wrong thing three times.

| Missing piece | What happens | When you find out |
|---|---|---|
| Plugin member | `createElementRegistry` **throws**, naming the member | At registration — immediately, loudly |
| Renderer | The element reports itself unavailable; the slide still plays | When somebody looks at the slide |
| Editor registration | The type is absent from the Add menu | When a teacher goes looking for it |
| Format variant | The lesson **cannot be saved** — `validate` rejects the manifest | Last, after everything else appeared to work |

The fourth row is why this table exists. The first three failures each leave something working; the
fourth arrives after all three have been done correctly, and nothing earlier hints at it.

---

## 2a. Three pieces are demonstrated; the fourth is described

The example type in the test suite supplies the plugin, the renderer, and the editor registration. It
does **not** supply a format variant, and the guide says why rather than leaving a reader to wonder
where the fourth piece went: adding one means editing the published element union, which requires a
migration and a `schemaVersion` bump — a real change to the lesson format, made for the sake of a
document.

So the fourth piece is prose: what to add to `variants` and `ELEMENT_TYPES`, and the migration step
beside it. Two things a reader needs and will not guess:

- **An additive variant transforms nothing.** Manifests written before it are still valid, so the
  migration step's `up` returns its input unchanged.
- **It still needs a registered step**, exactly as `v1_0` does — "the chain must reach the current
  version by an unbroken path", and a gap is refused rather than skipped.

There is no additive-variant migration in the repository to copy. The two that exist are a field
rename and that terminal no-op, and the guide should say so rather than send somebody looking.

---

## 2b. Two readers, and only one can finish

**An in-repo contributor** can complete all four pieces and ship a type to authors.

**A host integrator** — somebody consuming `@cuestack/schema` from the registry — can complete three.
Their type registers, renders, and appears in the Add menu, and then **no lesson using it can be
saved**, because the element union lives in a package they do not control and has no catchall. Their
options are an upstream change or a fork, and a fork's lessons fail validation everywhere else, which
makes them worth naming as a cost rather than offering as a workaround.

The guide states this **before** the four pieces, not after. Discovering it at the fourth step means
discovering it after all the work, at the one moment the first three pieces have made everything look
like it worked.

**Say it plainly rather than apologetically.** The closed union is what makes a manifest's meaning
knowable from its version, and that is worth having. What is not worth having is a reader finding out
by accident.

---

## 3. Every code block is extracted, not written

**No fenced block in the guide is typed by hand.** Each names a source file and region; a check
extracts and compares, and a mismatch fails the build.

The example type is real: registered, exercised by the suite, and supplying the **whole** contract —
an example omitting a member would teach an author to write something the framework refuses.

**Why this is mechanical rather than editorial.** `ElementEditor`'s header in `@cuestack/studio`
currently explains that "the seven built-in types have no `ElementPlugin`" and that "core's plugin
registry is empty by default". Feature 009 made both false. Two features have shipped since and
nobody noticed. The audience for a guide is, by definition, the people who cannot tell it is wrong.

---

## 4. What the guide does not cover

- **The kernel's internals.** How `resolve` composes contributions is not an author's concern, and a
  guide that explained it would invite depending on it.
- **Writing an adapter.** That is a much rarer job, and `@cuestack/element` is its worked example.
- **The editor's own surfaces.** Nine features built those for teachers, not for plugin authors.
- **Anything a reader can get from a package README.** The guide links rather than restates, because
  two descriptions of one thing is one description that will be wrong.
