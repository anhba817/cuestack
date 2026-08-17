# Contract: Simple Sequence Mode

**Feature**: `006-timeline-and-sequencing` · Covers US4 · FR-027–FR-036

The whole of this contract is two pure functions over a slide. That is not an implementation
preference: Constitution III forbids mode-specific storage, so a relationship *must* be derived,
and Constitution II names "Simple Sequence to absolute-time conversion" among the things that MUST
be developed test-first. A pure function is the only shape that satisfies both.

---

## 1. Events

```text
eventsOf(slide: Slide): readonly Event[]
```

**Pure. Node project. No DOM. No React.**

An event is **an element appearing or an effect running** (FR-035). Not elements alone — UC-02 is
*Create a Chronological Effect Sequence*, and a teacher revealing a list one line at a time is
sequencing effects. A mode that could only order elements would send them to the timeline for the
commonest case it exists to serve.

**Ordering, stated because "previous" is undefined without it:**

1. by `startMs` ascending
2. then by the owning element's paint order
3. then by `Effect.order`

The same tie-break the resolver uses, so the sequence view and playback never disagree about which
of two simultaneous things comes first. `Effect.order` exists for exactly this case (FR-TIM-014)
and reusing it keeps one answer to the question.

| Promise | Requirement |
|---|---|
| One event per element, at its `startMs` | FR-035 |
| One event per effect, at the effect's `startMs` | FR-035 |
| Effect times need no conversion — `Effect.startMs` is slide time | assumption, verified in schema |
| A hidden element still produces an event | edge case |
| A locked element still produces an event; applying to it is refused | FR-016 |
| A slide of zero elements produces zero events and does not throw | edge case |
| Ordering is total and stable — same slide, same list, every time | FR-022, SC-007 |

## 2. Classification

```text
classify(events: readonly Event[]): readonly Relationship[]
```

**Pure.** One relationship per event, positionally aligned.

| Given event `e` with predecessor `p` | Result |
|---|---|
| no predecessor | `first` — shown as starting at the slide's beginning (FR-033) |
| `e.startMs === p.startMs` | `with-previous` |
| `e.startMs === p.endMs` | `after-previous` |
| `e.startMs > p.endMs` | `after-previous-delay`, `delayMs = e.startMs - p.endMs` |
| anything else | `custom` |

**Exact equality, deliberately** (R-05). A tolerance would make two teachers' identical-looking
slides classify differently. The format stores integer milliseconds, so exactness is reachable.

The remaining case — `p.endMs > e.startMs > p.startMs`, an event beginning while its predecessor
is still running — classifies as `custom`. That is FR-031 working: shown as Custom, not silently
reinterpreted as With Previous.

**Adjacency is the only input** (FR-036). `classify` compares an event with the one before it in
the list and reads nothing else — not what kind either event is, not whether they share an element.
So a relationship is expressible between any two adjacent events, and the four shapes must behave
identically:

| Predecessor → event | Must classify and resolve like every other row |
|---|---|
| element → element | the ordinary case |
| effect → effect, on one element | the reveal-a-list case UC-02 is about |
| element → effect | an element arriving, then something emphasising it |
| effect → element | an effect finishing, then the next element arriving |

Stated as a table because it is otherwise the requirement most likely to be half-built: an
implementation that special-cases "the previous event belongs to the same element" would pass every
other assertion in this contract. The adjacency suite asserts all four.

## 3. Resolution

```text
resolveSequence(
  events: readonly Event[],
  relationships: readonly Relationship[],
): readonly TimingChange[]
```

**Pure.** Returns the absolute times a sequence implies; writes nothing.

| Promise | Requirement |
|---|---|
| Every event ends with absolute `startMs`/`endMs` | FR-029 |
| An element's duration is preserved when its start moves | FR-029 |
| An effect's `durationMs` is preserved when its start moves | FR-029 |
| `first` resolves to the slide's beginning, 0 | FR-033 |
| Every produced value is a non-negative integer millisecond | BR-001, BR-002 |
| `classify(resolveSequence(...))` returns the relationships it was given | round-trip |
| **Nothing is stored beyond those times** | FR-029, BR-016, SC-008, Constitution III |

The round-trip property is the whole mode's correctness in one line, and it is the test to write
first.

## 4. Switching views

| Promise | Requirement |
|---|---|
| Switching to the timeline changes zero values | FR-030, SC-007 |
| Timing edited on the timeline into something no relationship describes shows as Custom | FR-031 |
| Returning a Custom event to a relationship states what precision would change | FR-032 |
| …and requires confirmation before applying | FR-032 |
| Reordering elements **re-classifies the view** and rewrites no timing | FR-034, edge case |
| An element carries its effects with it when reordered | FR-034 |
| Reordering changes "previous" only among events sharing a start time | FR-034, R-06 |

**Re-classify, not re-resolve.** A reorder changes stacking, and stacking changes what the sequence
view shows — not what the draft holds. Nothing but `apply-sequence` writes timing, which is what
keeps FR-029's "stores nothing" and FR-031's "shown as Custom rather than silently reinterpreted"
true at the same time. The alternative reading — that a z-order swap rewrites `startMs` — would be a
destructive edit produced by a non-timing action, with no undo behind it until ED-5.

The scope is also narrower than it sounds, and saying so is what stops the destructive reading from
sounding reasonable. Events are ordered by `startMs` first and by paint order only as a tie-break
(§1), and `reorder` swaps adjacent `zIndex`. So three elements starting at 0, 1000, and 2000 reorder
without changing "previous" at all. It matters when two events start together — which is exactly the
case `Effect.order` was stored explicitly to make deterministic.

FR-032's confirmation is not a courtesy dialogue. Making a Custom event simple *discards* the
timing that made it custom, and the teacher authored that timing on purpose. The message states
the current absolute time and the one the relationship would produce.

## 5. Applying

One edit, one reducer path.

```text
apply({ kind: 'apply-sequence', relationships: readonly { eventKey, relationship }[] })
```

`eventKey` is `elementId`, or `elementId + ':' + effectId` for an effect event. Derived, because
an event has no id of its own and minting one would be storage (FR-029).

| Promise | Requirement |
|---|---|
| Applies to the unlocked events; the locked ones are reported, not fatal | FR-016, BR-011 |
| Refused outright only when **every** affected element is locked | FR-016, BR-011 |
| Refused if the result fails validation; the draft is unchanged | FR-041 |
| Refused in read-only mode, with a reason | FR-047 |
| Routes through `applyEdit` — no separate mutation path | FR-042 |
| The reducer is pure and does not mutate its input | feature 005's five promises |

**The locked rule follows the reducer, not the other way round.** `partitionLocked`
(`reducer.ts:47-56`) is what every other multi-element kind already uses — apply to the movable
members, report the rest — and its comment states the reason: "returning a refusal for the whole set
would let one locked element silently veto a five-element drag." A sequence is the largest
multi-element edit in the editor, so it is the last place that convention should be inverted. One
locked element must not veto a slide.

## 6. Named-rule tests

**BR-016** — Simple Sequence and Timeline read and write the same data — gets at least one test
named for the rule ID (SC-013). It is the manifest comparison: apply a sequence, serialize, read
back, and assert the only differences are `startMs`, `endMs`, and `durationMs`. If anything else
appears, the mode grew storage.

## 7. UC-02, as a measurable outcome

SC-016: a list revealed one line at a time can be authored **entirely in the sequence view**,
without opening the timeline. This is the case that decides whether the mode serves the teacher
§7.1 describes, and it is the reason the effect half of US4 exists. It is also the cut line the
specification recorded in advance — severable, at the cost of UC-02 and SC-016.

## 8. Accessibility

| Promise | Requirement |
|---|---|
| Every relationship control is keyboard-operable | FR-046, SC-009 |
| Every control has an accessible name and a visible focus indicator | FR-046 |
| axe reports zero violations on the sequence view | SC-010 |
| The confirmation in FR-032 is reachable and dismissible by keyboard | FR-046 |
