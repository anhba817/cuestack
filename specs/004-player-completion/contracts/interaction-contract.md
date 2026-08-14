# Contract: interactions

**Date**: 2026-08-15 · **Feature**: `004-player-completion`

What a question renderer is given, what the kernel decides, and where the line between them falls.

## The division

| Decided by the kernel | Decided by the renderer |
|---|---|
| Whether an answer is correct | What a radio group looks like |
| Whether an interaction is complete, per its policy | How feedback is announced |
| How many attempts remain | Whether options are laid out in a row or a column |
| Whether the outcome is unreachable | Which control receives focus after submitting |
| Whether the slide may advance | — |

The line is the same one the element registry draws, and for the same reason: a Vue adapter must
reach the same conclusion from the same answer. A renderer that decided completion would mean the
gate and the display disagree the first time a second adapter exists.

## What the kernel exposes

```ts
// packages/core/src/interactions/
function evaluate(
  definition: Interaction,            // from the manifest
  responses: readonly InteractionResponse[],
): InteractionOutcome

function submit(
  state: InteractionState,
  elementId: string,
  selected: string | readonly string[],
  atMs: number,
): { state: InteractionState; response: InteractionResponse; event: LessonEvent }
```

`submit` returns a **new** state rather than mutating one. Interaction state is an input to
advancement, and an input that mutates under its reader is the class of bug that makes a gate open
one frame early. It also makes the whole thing trivially testable: apply a sequence of submissions,
assert the outcome, with no player involved.

The `LessonEvent` comes back from `submit` rather than being recorded inside it. The kernel does
not own the analytics adapter, and a function that both computes and emits cannot be called twice
in a test without a spy.

## The three completion policies

| `completionPolicy` | Complete when |
|---|---|
| `on_first_attempt` | Any answer has been submitted |
| `on_correct` | A correct answer has been submitted |
| `on_attempts_exhausted` | A correct answer has been submitted, **or** `maxAttempts` submissions have been made |

Absent from the manifest, the policy defaults to `on_first_attempt` — the least restrictive
reading, because a question whose author did not say it must be answered *correctly* should not
trap a learner who got it wrong.

**The dead end this creates, deliberately.** `on_correct`, `maxAttempts: 1`, wrong answer, and
`required: true` is a question that can never complete on a slide that will therefore never
advance. The format permits authoring it. The kernel does not silently rescue the learner by
opening the gate — that would make the policy mean something different from what it says — it
reports `unsatisfiable`, and the player presents a way forward (FR-030). Wave 5's validation
engine warns the author before a learner ever meets it.

## What a question renderer receives

Extending feature 003's `ElementRendererProps`:

```ts
interface ElementRendererProps {
  readonly element: ResolvedElement
  readonly resolveAsset: AssetResolver
  // Added here, and only meaningful to interactive renderers.
  readonly interaction?: {
    readonly outcome: InteractionOutcome
    readonly responses: readonly InteractionResponse[]
    readonly submit: (selected: string | readonly string[]) => void
  }
}
```

Optional, because six of the seven built-in renderers have no use for it and a required field they
all ignore is a field that invites being used for something else. Absent means "not interactive",
not "interactions unavailable".

Note what is still **not** here: no slide, no lesson, no transport, no time. `submit` takes only
the answer; the kernel stamps the lesson time, so a renderer cannot report a moment other than the
one that happened.

## Obligations on an interactive renderer

Beyond feature 003's four prohibitions, which all still apply:

- **Announce the outcome, not just render it.** A learner using a screen reader gets no signal from
  a colour change. The result and the remaining attempts go into a live region.
- **Keep the control reachable after it closes.** When no further answer is accepted, the controls
  are `aria-disabled`, never `disabled` — the same rule Wave 2 applied to the inert question, for
  the same reason: `disabled` leaves the tab order, so the explanation cannot be reached by the
  learner it is for.
- **Never reveal the correct answer before the response is final** (FR-009). `correctResponse` is
  in the manifest the client already holds; what must not happen is the renderer putting it in the
  markup, where it is one inspection away.
- **Submit once per learner action.** A double-fired submit consumes two attempts, and the learner
  cannot tell why they have one fewer.

## The advance seam, which already exists

```ts
interface AdvanceSignals {
  readonly learnerAdvanced: boolean
  readonly completedInteractions: ReadonlySet<string>
  readonly overrideAdvance?: boolean
}
```

Unchanged from Wave 1. `hasIncompleteRequiredInteraction` already implements BR-005 against it,
across *every* required question on the slide rather than only one named by an advance rule — a
duration-advanced slide carrying a required question waits too, or the learner loses the question.

This feature supplies the set. The gate was built in Wave 1 and passed an empty one; nothing about
the gating logic is written here, which is the main reason US1 is cheaper than it looks.
