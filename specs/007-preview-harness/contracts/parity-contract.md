# Contract: Parity, and the gate that checks it

**Feature**: `007-preview-harness` · Covers FR-027, FR-028 · SC-001, SC-012 · Constitution V

This is the contract QA-5 has been waiting for. `gate:parity` has printed "placeholder" since Wave
1 with an honest reason each time — first no editor, then no preview. Both halves now exist.

---

## 1. What parity means here, and what it does not

**The comparison is the editor's canvas against the learner's player.** Not the preview against the
player — that one cannot fail, and a check that cannot fail is the thing this gate exists to
prevent.

### Why "preview vs playback" is the wrong target

The preview mounts `LessonPlayerClient` unmodified (R-01). Comparing it with the player would be
comparing a component with itself, and writing the comparison as

```text
resolve(slide, t) === resolve(slide, t)      ← tautological; passes unconditionally
```

is worse still: `resolve` is pure, so that assertion holds for any input, forever, including after
somebody breaks parity. An earlier draft of this contract said exactly that, and it would have armed
the gate against nothing — the same defect as the theme-values gate's inherited escape hatch and
feature 006's near-miss, which are the two reasons SC-012 exists.

### Where divergence can actually happen

`EditorCanvas` and `LessonPlayerClient` render the same lesson through **different renderer sets**:

```text
EditorCanvas         createRendererRegistry(staticRenderers)    // EditorCanvas.tsx:69
LessonPlayerClient   createRendererRegistry(builtinRenderers)   // LessonPlayerClient.tsx:80
```

That difference is deliberate — a teacher composing a slide is authoring a question, not answering
one, so the canvas uses the static renderer set. It is also exactly where a divergence can appear,
and feature 005 already found one: the interactive question renderer carries a submit control the
static one does not, and the canvas rendered it before the split was made.

FR-FWK-013's own words are "registered elements render consistently in **editor preview** and
**learner playback**", and the editor's rendering surface is the canvas. That is what the gate
compares.

### What feature 005 already asserts, and must not be rebuilt

`test/parity/` is not empty. Feature 005 wrote:

| Suite | What it already holds |
|---|---|
| `overlay.test.tsx` | the editor's render layer is **byte-identical** to the player's with the overlay subtracted — across all seven MVP types, with a selection active, with a ghost present |
| `overlay.test.tsx` | no ghost markup in a player render of the same manifest; every affordance inside the overlay subtree; no editor prop added to `SlideView` |
| `geometry.test.tsx` | geometry, rotation, and paint order agree between editor and player |
| `state.test.tsx` | one resolution per moment — including *"changes with time, so the equality above is not vacuous"* |

That last row deserves reading twice. Feature 005 anticipated exactly the tautology an earlier draft
of this contract fell into, and defended against it. The canvas-versus-player comparison is
**done**; what remains is narrower and sharper.

### The remaining surface, and it is one element

`staticRenderers` and `builtinRenderers` are the same seven objects except one:

```text
staticRenderers  = [ text, image, shape, video, audio, button, staticQuestionRenderer ]
builtinRenderers = [ text, image, shape, video, audio, button, questionRenderer       ]
```

So the entire divergence surface between the two sets is **the question element** — which is also
where feature 005 found a real divergence, the submit control appearing on a canvas that should not
have had one.

```text
staticQuestionRenderer content  ≈  questionRenderer content
```

The *content* must agree — the prompt, the options, the geometry. The interactive set alone may add
the controls a learner needs and an author does not. What must never differ is what the element
**says**.

**No `resolve` equality line.** An earlier draft asserted
`resolve(slide,t,canvasContext) ≡ resolve(slide,t,playerContext)`, which is the tautology again in a
third costume: `ResolveContext` carries the *core* registries, nothing gives the canvas and the
player different ones, and the renderer difference is a React-level concern the kernel knows nothing
about.

### Effects are structural, not comparable here

Effects are applied as CSS custom properties by `FrameWriter`, from one `resolve`, on both sides.
There is no renderer-set difference for them to disagree across — so asserting effect parity between
the two sets would be trivially true rather than informative.

What *is* worth asserting is that both sets **accept** the same resolved contribution: an element
wrapped by either renderer carries the same custom properties. Beyond that, effect parity is a
property of having one writer and one resolver, and the thing that would break it is a second
renderer path, which §5 below covers.

### And a structural check, which is a different claim

That the preview mounts the player unmodified is worth asserting, and it is cheap: the preview's
rendered output contains no editor markup (FR-004), and it is not a component of its own. That is a
*composition* assertion, not a parity one, and it belongs in
[preview-contract.md](./preview-contract.md) §1 where it already is.

**Why not the 100 ms tolerance.** SC-003 quotes §9's divergence budget, which is written for
*published* playback on a learner's device across a network. Inside one process there is an exact
answer, and a timing measurement would pass while genuinely diverging — two renderers can be equally
fast and disagree about what they draw. SC-003 remains the published claim; SC-001 is what this
feature can verify.

## 2. The sweep

```text
packages/studio/test/parity/registered.test.tsx
```

| Promise | Requirement | Where |
|---|---|---|
| The editor's render layer is byte-identical to the player's, overlay subtracted | FR-027 | **exists** — `overlay.test.tsx` |
| Geometry, rotation, and paint order agree | FR-027 | **exists** — `geometry.test.tsx` |
| The question element's *content* is the same statically and interactively | FR-028, SC-001 | **new** — `renderers.test.tsx` |
| Both renderer sets accept the same resolved contribution | SC-001 | **new** — `renderers.test.tsx` |
| Driven from the registry, not from a list in the test | Constitution I | new |
| An eighth element type cannot be registered without a decision here | Constitution I | new |

The gate runs all of it. Its job is to run what exists plus what is added, not to re-derive coverage
this repository already has — a second file asserting `overlay.test.tsx`'s claim would be a
duplicate that drifts.

Driving the sweep from `registry.types()` rather than a literal list is the same shape feature 006
used for its eight-effect sweep, and it is what makes "a ninth cannot arrive unnoticed" true rather
than hoped.

## 3. The gate

```text
tools/scripts/gates/parity.mjs   # placeholder → armed
```

| Promise | Requirement |
|---|---|
| The gate runs the sweep and exits non-zero when it fails | FR-027 |
| It states what it checked, so a pass can be read | FR-017 (project) |
| It states what it does **not** check | honesty |
| A deliberate divergence turns it red | **SC-012** |

**The negative control is not optional.** This project has been bitten twice by a gate that was
green while enforcing nothing: the theme-values gate, which delegated to ESLint and inherited its
escape hatch; and feature 006's near-miss, where a new lint rule would have silently disarmed the
one beside it and only a self-test caught it. A parity gate that has never been observed failing is
not known to be a gate — which is why SC-012 is a success criterion rather than a habit.

The control introduces a divergence in one mount and requires the gate to go red naming the type
that diverged. It is removed afterwards, like every other control in `check-gates.test.ts`.

## 4. What the gate must say it does not check

Its predecessor's honesty is worth keeping. The armed version should still name its own limits:

- **Not paint.** happy-dom has no compositor. Equality of render state is not a claim about pixels,
  and a browser-based check is still required before claiming what a learner sees.
- **Not published playback.** SC-003's tolerance is about a network and a device; this compares two
  mounts in one process.
- **Not the *host's* renderers.** A host that registers its own element types gets parity for them
  only if it runs this sweep against its own registry. The contract the framework can keep is for
  what the framework registers.

Saying so is the difference between a gate that reports a fact and a gate that implies a guarantee.
The placeholder version already did this well and the armed version should not do it worse.

## 5. Why this is checkable at all

Worth recording, because the gate's *value* is easy to misread.

Parity here is structural and has been since Wave 1: one resolver, one transport, one implementation
of each effect. Wave 4's own note says the kernel did not change to accommodate an editor.
`ResolvedElement.geometry` was cut as *authored* position before anything needed it, precisely so a
drag handle and an effect's displacement could coexist without forking.

So this gate does not *establish* parity. It catches the day someone breaks it — a renderer that
takes a shortcut for the editor, an effect that special-cases a preview, a second code path added
under deadline. That day is what Constitution V calls a severity-2 defect, and the gate is what
makes it a build failure instead.
