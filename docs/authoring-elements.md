# Adding an element type

This framework ships seven element types. This is how you add an eighth.

It is written for a developer. Everything here is about the **contracts**; if you find yourself
needing to read the resolver, the timeline, or the player, something in this guide is missing and
that is worth reporting.

---

## Before you start: who can finish

An element type is **four** contributions across **four** packages. Three are registrations you supply
at runtime. The fourth is a change to the lesson format itself, and whether you can make it depends on
who you are.

| You are | You can complete | Because |
|---|---|---|
| Contributing to this repository | all four | the format is yours to change |
| Integrating this framework into your own product | three | the element union lives in `@cuestack/schema`, which you install rather than own |

**If you are the second, read this now rather than at the fourth step.** With three pieces your type
registers, renders, and appears in the Add menu — every signal says it works — and then **no lesson
using it can be saved**, because the format rejects a manifest naming a type it does not contain.
Your routes are an upstream change to `@cuestack/schema` or a fork, and a fork's lessons fail
validation everywhere else, which is a real cost rather than a workaround.

This is not an oversight. A closed union is what lets a manifest's meaning be known from its version.
But it is the one thing about extending this framework that you cannot discover by trying things that
appear to work, so it goes first.

---

## The four pieces

| Piece | Package | What its absence causes | When you find out |
|---|---|---|---|
| Plugin | `@cuestack/core` | `createElementRegistry` **throws**, naming the missing member | At registration — immediately |
| Renderer | an adapter, e.g. `@cuestack/react` | The element reports itself unavailable; the rest of the slide plays | When somebody looks at the slide |
| Editor registration | `@cuestack/studio` | The type is absent from the Add menu | When a teacher goes looking |
| Format variant | `@cuestack/schema` | **The lesson cannot be saved** | Last, after the other three made everything look fine |

Four pieces, four failure modes, and they get quieter and later as you go down the table. That
ordering is the reason this guide exists.

---

## 1. The plugin

Your type's payload, and a guard for it.

<!-- from: packages/core/test/fixtures/guide-example/plugin.ts#payload -->
```ts
const isCountdown = (payload: unknown): payload is CountdownPayload =>
  typeof payload === 'object' &&
  payload !== null &&
  typeof (payload as CountdownPayload).seconds === 'number'
```

Then the plugin. **Every member is required** — Constitution I rejects partial plugins, so a missing
one is refused at registration with a message naming it.

<!-- from: packages/core/test/fixtures/guide-example/plugin.ts#plugin -->
```ts
export const countdownPlugin: ElementPlugin<CountdownPayload> = {
  type: 'countdown',

  /** A guard over your own payload. It answers "is this mine", not "is this a lesson". */
  schema: isCountdown,

  /**
   * What this type contributes to a rendered frame — and this one contributes nothing visual,
   * because an example that changed what lessons look like would be teaching by side effect.
   *
   * Note what a plugin is given: a payload, a geometry, a slide time, and a theme. Not the lesson,
   * not the slide, not its siblings, not the transport, and nothing about the learner. That is
   * enforced by the signature rather than by documentation — there is nowhere to reach for the data.
   * The restriction is not distrust: a plugin *able* to read the whole lesson becomes one that does,
   * and then the lesson shape cannot change without breaking third-party code.
   */
  resolve: () => ({ visible: true }),

  /** The fields an author edits. This is the one place your type's field list is declared. */
  inspector: {
    fields: [
      { key: 'payload.seconds', label: 'Seconds', kind: 'number' },
      { key: 'payload.announceFinal', label: 'Announce the final seconds', kind: 'boolean' },
    ],
  },

  /**
   * Only what the format cannot already reject.
   *
   * The format checks types and required fields; it does not know that a countdown of zero counts
   * nothing. Re-checking what the schema checks means one fault produces two issues, which is the
   * duplication a validation engine exists to avoid.
   */
  validate(payload): readonly PluginIssue[] {
    if (payload.seconds > 0) return []
    return [
      {
        code: 'COUNTDOWN_HAS_NO_TIME',
        message:
          'This countdown is set to zero seconds, so a learner sees it finish before it starts. ' +
          'Give it a duration, or remove it.',
      },
    ]
  },

  /** Refuses a contribution shaped for a different kernel rather than composing it. */
  renderStateVersion: RENDER_STATE_VERSION,
}
```

### What a plugin can reach, and why not more

`resolve` receives a payload, a geometry, a slide time, and a theme. Not the lesson, not the slide,
not its siblings, not the transport, and nothing about the learner.

That is enforced by the signature — there is nowhere to reach for the data — and the reason is not
distrust. A plugin *able* to read the whole lesson becomes one that does, and then the lesson shape
cannot change without breaking third-party code. The restriction is what keeps your type working
across versions.

### What to validate, and what not to

`validate` is for what the **format cannot already reject**. The test: could a well-formed lesson fail
it? A countdown of zero seconds is well-formed and useless, so it belongs here. A missing `seconds`
field is not well-formed, and the schema already refuses it — re-checking it means one fault produces
two issues.

### Registering it

A supplied registry **replaces** the default rather than extending it:

```ts
createElementRegistry([...builtinElements, countdownPlugin])
```

Pass only your own plugin and every built-in type is reported unknown. This catches people once.

---

## 2. The renderer

One per adapter. A plugin describes a type; a renderer draws it.

<!-- from: packages/react/test/fixtures/guide-example/renderer.tsx#renderer -->
```tsx
export const countdownRenderer: ElementRenderer = {
  type: 'countdown',
  Component: Countdown,
  /**
   * How assistive technology describes this type when the author gave no label of their own.
   *
   * Required, and easy to miss because nothing visual depends on it. A renderer without one is a
   * renderer whose elements are announced by their role and nothing else.
   */
  label: 'Countdown',
}
```

`label` is required and easy to miss: it is how assistive technology describes your type when the
author gave no label of their own.

**Text, never markup.** `dangerouslySetInnerHTML` is banned repository-wide, and in adapters that
write a DOM directly so is `innerHTML`. Author-supplied content reaches the page as text.

---

## 3. The editor registration

<!-- from: packages/studio/test/fixtures/guide-example/editor.ts#editor -->
```ts
export const countdownEditor: ElementEditor = {
  type: 'countdown',
  defaults: {
    width: 200,
    height: 100,
    payload: { seconds: 30, announceFinal: true },
  },

  /**
   * Empty, and that is the interesting part.
   *
   * `inspector` is required here, but for a type with a registered plugin the *fields* come from the
   * plugin's `inspector` — `Inspector.tsx` takes the plugin's list and overlays only the three
   * members that describe editing rather than the field: `toStored`, `fromStored`, `itemDefaults`.
   * So a third-party type declares its fields once, in `@cuestack/core`, and puts an entry here only
   * when a field needs one of those transforms.
   *
   * Restating the field list here would give the type two lists to keep in agreement, which is the
   * failure the merge exists to prevent.
   */
  inspector: [],
}
```

Note the empty `inspector`. The **fields** come from your plugin's `inspector`; the editor overlays
only the three members that describe editing rather than the field — `toStored`, `fromStored`,
`itemDefaults`. Declare your fields once, in the plugin, and add an entry here only when a field needs
one of those transforms.

---

## 4. The format variant

**Described rather than demonstrated**, because performing it means changing the published lesson
format — and a documentation example should not put an invented element type in it.

In `@cuestack/schema`, add a variant to the element union and your type to `ELEMENT_TYPES`. Then
register a migration step, and two things about it are not obvious:

- **An additive variant transforms nothing.** Lessons written before it are still valid, so the
  step's `up` returns its input unchanged.
- **It still needs a registered step.** The chain must reach the current version by an unbroken path,
  and a gap is refused rather than skipped — exactly why `v1_0` exists and does nothing.

There is no additive-variant migration in this repository to copy; the two that exist are a field
rename and that terminal no-op.

This is a MINOR schema change: `schemaVersion` moves, and `check:migrations` fails a format change
that arrives without its migration.

---

## Effects, briefly

Effects are the other registered contribution, and the one people miss because elements are the
obvious half. An `EffectDescriptor` declares its parameters and how it contributes over its phase, and
registers through `createEffectRegistry` the same way. The same rule applies: a supplied registry
replaces the default.

---

## What this guide does not cover

- **The kernel's internals.** How `resolve` composes contributions is not your concern, and depending
  on it would make your type fragile across versions.
- **Writing an adapter.** Rarer; `@cuestack/element` is the worked example.
- **Anything in a package README.** Those are linked, not restated — two descriptions of one thing is
  one description that will be wrong.
