# Data Model: Validation and Immutable Publish

Two families of thing, with opposite lifetimes. A **report** is derived, disposable, and recomputed
on demand — nothing about it is ever stored. A **published version** is written once and never
touched again, and most of this document's care is about which side of that line each field sits on.

Nothing here enters a `LessonManifest`. A published version *is* one; it does not add to one.

---

## 1. The line, restated

| Kind | Lives where | Stored | Changes after it exists |
|---|---|---|---|
| Validation report | recomputed on demand | never | n/a — it is discarded and remade |
| Validation policy | the host supplies it | the host's business | whenever the organisation says |
| Published version | the host's publishing adapter | yes | **never** (BR-008) |
| Active version pointer | the same adapter | yes | on publish, withdraw, and restore |
| Publication record | the same adapter | yes, append-only | grows; entries never change |

Features 005 and 008 drew this table for session state and authored data. This one adds a third
category the project has not had before: **data that is written once and is thereafter read-only for
the lifetime of the system.** A published version is the first thing the framework produces that has
no edit path at all.

---

## 2. `ReportIssue`

The schema's existing shape, reused, plus the two fields a composed report needs.

| Field | Type | Required | Notes |
|---|---|---|---|
| `source` | `'schema' \| 'semantic' \| 'plugin'` | yes | Which validator produced it |
| `code` | `string` | yes | An `IssueCode`, a `SemanticCode`, or a plugin's own — see below |
| `severity` | `'error' \| 'warning'` | yes | Applied by policy; see §4 |
| `message` | `string` | yes | Written for a teacher: problem, object, action (FR-004) |
| `path` | `readonly (string \| number)[]` | yes | Where in the document, for a machine |
| `location` | `IssueLocation` | yes | Slide and element, for a person |

**Why the shape is borrowed.** `IssueLocation` already carries what FR-005's jump-to-source needs,
and a second shape would leave the report unable to hold a schema issue without translating it. The
translation layer is the part nobody keeps correct.

**`source` exists because two codes already collide.** `RenderProblem` declares
`UNKNOWN_ELEMENT_TYPE` and `UNKNOWN_EFFECT_TYPE`, and `@cuestack/schema`'s `ISSUE_CODES` declares
**the same two strings**. R-03's argument for two unions is that a host branching on a code should be
able to tell which validator produced it — without a discriminator, for those two codes it cannot.
Adding `source` delivers that properly and makes the collision harmless; renaming would break two
published vocabularies to avoid one field.

**`code` is a `string` because a plugin's code cannot be in a union core owns.**
`ElementPlugin.validate` returns `readonly PluginIssue[]`, where `PluginIssue` is
`{ code: string; message: string }` — arbitrary, and by design: a third-party element type reports
faults core has never heard of. `source` is what keeps that from being a hole. A caller wanting
exhaustiveness narrows on `source` first, which is the same discipline the two unions were for.

**`PluginIssue` carries no location, so the engine supplies one.** A plugin sees a payload and
nothing else — it does not know which element it is, which slide that is on, or where either sits in
the document. The engine is iterating both when it calls, so it fills `path` and `location` from
what it already has.

## 3. `SemanticCode`

A closed union in core, separate from `@cuestack/schema`'s `ISSUE_CODES`. **Every code its four
sources can emit**, not a selection — an omission here is a code the report cannot carry.

| Code | Default severity | Source | Policy-governed |
|---|---|---|---|
| `QUESTION_DEAD_END` | error | `isDeadEnd`, new (R-02) | no |
| `ADVANCE_UNSATISFIABLE` | error | `checkReachability` | no |
| `ADVANCE_MEDIA_FAILED` | error | `checkReachability` | no |
| `UNKNOWN_REQUIRED_INTERACTION` | error | `checkReachability` | no |
| `ELEMENT_BEYOND_SLIDE` | warning | `collectProblems` | no |
| `EFFECT_BEYOND_SLIDE` | warning | `collectProblems` | no |
| `UNKNOWN_ELEMENT_TYPE` | error | `collectProblems` | no |
| `UNKNOWN_EFFECT_TYPE` | error | `collectProblems` | no |

**`UNKNOWN_ELEMENT_TYPE` has a cliff, and this feature walks off it deliberately.**
`resolve/element.ts` reads `const known = plugin !== undefined || elements.types().length === 0`, so
an **empty** registry treats every type as known and the code can never fire. Before this feature
the default registry was empty, so it never did. Registering the seven turns the escape off, which is
correct — and it means a registry holding *some* types reports every other type as unknown, which is
why the seven are registered together and never in instalments (research R-12).
| `ACCESSIBILITY_METADATA_ABSENT` | **warning** | the engine, reading `element.accessibility` | **yes** |
| `ASSET_UNRESOLVED` | warning here, error at publish | the separate pass (R-06) | no |
| `PLUGIN_VALIDATE_FAILED` | error | a plugin whose own `validate` threw | no |

**Accessibility is the engine's rule, not a plugin's.** `accessibility` is a *common* element field —
`altText`, `label`, `announce` — sitting beside `payload` rather than inside it, so
`ElementPlugin.validate(payload)` cannot see it and could not report on it if it wanted to. An
earlier draft of this table attributed it to plugins, which would have made a policy-governed rule
depend on every plugin author implementing it identically.

**`UNKNOWN_ELEMENT_TYPE` and `UNKNOWN_EFFECT_TYPE` are the two that also exist in `ISSUE_CODES`.**
They mean different things at the two tiers — the schema means "no such type in the format", the
resolver means "no such type in *this* registry" — which is precisely why `source` is not optional.

`ELEMENT_BEYOND_SLIDE` and `EFFECT_BEYOND_SLIDE` are warnings, which is a judgement worth stating.
Neither renders past the boundary — the player simply stops — so the lesson is playable. Both are
almost always a mistake and occasionally a deliberate margin, and BR-017 already requires the
*timeline* to report an overrun rather than prevent it.

`PLUGIN_VALIDATE_FAILED` exists because the alternative is worse: an author with one broken plugin
would otherwise lose the whole report, and every issue they could have acted on with it.

## 4. `Severity` and `ValidationPolicy`

```text
severity = 'error' | 'warning'
```

Errors block publication; warnings do not (FR-013, FR-014). Nothing else depends on severity.

| Field | Type | Notes |
|---|---|---|
| `errors` | `readonly string[]` | Codes to raise to `error` |
| `warnings` | `readonly string[]` | Codes to lower to `warning` |

Keyed by code string rather than by `SemanticCode`, because a plugin's codes are arbitrary and a host
must be able to govern them too — an element type whose author considers something fatal may be a
warning in somebody else's deployment.

**There is no `off`.** FR-010b: a rule an organisation does not want blocking is a warning, and a
rule nobody wants to see is a rule that should not exist. A silenceable set drifts towards silence
one incident at a time.

**Only policy-governed codes may move.** Whether a code is governed is a property of the code, listed
in §3, so a policy cannot make a structural error into a warning: a manifest the format rejects is
not publishable regardless of anybody's rules.

**Plugin codes default to `error` and are always governable.** A plugin reporting a fault in its own
payload is reporting something it believes makes the element wrong, so blocking is the honest
default — but core has no way to judge a code it has never seen, so a host may lower any of them by
name. Silencing remains impossible.

## 5. `ValidationReport`

| Field | Type | Notes |
|---|---|---|
| `issues` | `readonly ReportIssue[]` | Every issue found, in a deterministic order |
| `blocks` | `boolean` | True when any issue is an error. Derived, carried for the caller's sake |

**The order is part of the contract** (FR-007). Slides in document order, elements within a slide in
document order, and each element's issues in the order its sources were consulted. Two runs of one
lesson are identical lists, which is what lets a test assert a report rather than a set — and what
stops a teacher who re-runs a report from having to find their place again.

## 6. `PublishedVersion`

Written once. There is no method that modifies one (R-05).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Stable, host-assigned; FR-027's addressable identifier |
| `manifest` | `LessonManifest` | Deeply frozen on read |
| `versionNumber` | `number` | Position in the lesson's publication sequence |
| `publishedBy` | `string` | The host's identity for whoever published (FR-022) |
| `publishedAt` | `number` | Epoch milliseconds, the **host's** clock |
| `schemaVersion` | `string` | The format it was published under, kept rather than migrated |

`publishedAt` follows the rule ED-5 established for checkpoints: the host's storage is the only
participant with an authoritative clock, and the studio may not read one at all.

**`schemaVersion` is recorded so it can be honoured, not so it can be upgraded.** FR-023 — a
published version plays as published, because bringing it forward would change what a learner
receives, which is the one thing BR-008 forbids. That makes it a standing constraint on future
migrations rather than on this feature.

**Note what is absent**: no `updatedAt`, no `status`, no `title` copy. Anything that could go stale
relative to the manifest is not stored beside it.

## 7. `ActiveVersion` and `PublicationRecord`

The active version is a pointer, not a field on a version — which is what lets withdrawal change
availability without touching anything immutable (R-09).

| Entry field | Type | Notes |
|---|---|---|
| `action` | `'published' \| 'withdrawn' \| 'restored'` | A closed set |
| `versionId` | `string` | Which version it concerned |
| `actor` | `string` | The host's identity |
| `at` | `number` | Epoch milliseconds, the host's clock |

Append-only. The adapter offers no way to alter or remove an entry (FR-034), for the same reason
`PublishedVersion` has no update method: an interface that can rewrite history can be asked to.

**The record is the framework's, not the organisation's audit log.** It records what the framework
did. A compliance trail spanning logins, exports, and approvals is a larger thing belonging to
whoever runs the deployment.

## 8. What `PublishingAdapter` gains, and what it deliberately lacks

See [contracts/publishing-contract.md](./contracts/publishing-contract.md).

| Method | Returns |
|---|---|
| `publish(lessonId, manifest, by)` | the new `PublishedVersion`, or a refusal |
| `listPublished(lessonId)` | versions, newest first |
| `loadPublished(lessonId, versionId?)` | a version — the active one when no id is given |
| `withdraw(lessonId, by)` / `restore(lessonId, by)` | acknowledgement, or a refusal |
| `readRecord(lessonId)` | the entries, oldest first |

**Absent, permanently**: anything that updates a version, anything that deletes one, and anything
that edits the record. Absence is the enforcement — the argument EN-6 made for the conflict token
applies unchanged.

## 9. What `DraftPersistence` gains

| Member | Before | After |
|---|---|---|
| `saveNow()` | `void` | `Promise<SaveOutcome>` |

Additive: a caller that ignores the promise behaves exactly as before, which is what every existing
call site does. Publishing needs it because publishing saves first, and a publish that proceeded
without knowing whether the save landed would publish a state storage never held (R-08, FR-018a).
