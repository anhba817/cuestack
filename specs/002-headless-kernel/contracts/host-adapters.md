# Contract: host adapters

**Date**: 2026-08-14 · **Feature**: `002-headless-kernel`

The complete boundary where lesson data leaves the framework. Six ports; the framework runs no
server and implements none of them beyond an in-memory reference.

## Ports

```ts
interface Ports {
  time: TimeSource
  media: MediaPort
  visibility: VisibilityPort
  storage: StorageAdapter
  assets: AssetAdapter
  analytics: AnalyticsAdapter
}
```

Grouped into one object rather than passed individually so that the list of things a host must
supply is a single reviewable type. Adding a port is a visible change to every construction
site, which is the point.

## TimeSource

```ts
type TimeSource = () => number   // monotonically non-decreasing milliseconds
```

The kernel does not verify monotonicity — checking every tick would cost more than the bug is
worth. A source that goes backwards produces undefined behaviour.

## MediaPort

```ts
interface MediaPort {
  query(elementId: string): MediaStatus | null   // null = not yet attached
  subscribe(listener: (elementId: string) => void): () => void
}

interface MediaStatus {
  readonly positionMs: number
  readonly durationMs: number | null   // null while unknown
  readonly ended: boolean
  readonly paused: boolean
  readonly failed: boolean
}
```

**Read-only, deliberately** (R-04). The kernel decides what a media position *means* for
advancement; the adapter decides how it is learned. `failed` exists so a media-gated slide can
report blocked rather than waiting forever for a video that will never load — the alternative is
a learner on a slide with no way forward and no explanation.

If Wave 3 needs the timeline to scrub media, this port becomes bidirectional. That is a design
change, and it is the highest-risk assumption recorded for this feature.

## VisibilityPort

```ts
interface VisibilityPort {
  isHidden(): boolean
  subscribe(listener: (hidden: boolean) => void): () => void
}
```

Exists so BR-013 can be honoured without the kernel touching `document`.

## StorageAdapter

```ts
interface StorageAdapter {
  loadDraft(lessonId: string): Promise<LoadResult>
  saveDraft(lessonId: string, manifest: LessonManifest, token: VersionToken): Promise<SaveResult>
  listVersions(lessonId: string): Promise<VersionSummary[]>
}

type LoadResult =
  | { ok: true; manifest: LessonManifest; token: VersionToken }
  | { ok: false; reason: 'not_found' | 'unauthorized' | 'unavailable' }

type SaveResult =
  | { ok: true; token: VersionToken }
  | { ok: false; reason: 'conflict'; currentToken: VersionToken }
  | { ok: false; reason: 'unauthorized' | 'unavailable' }

type VersionToken = string   // opaque; the kernel never interprets it
```

**The conflict path is in the signature, not in a convention** (R-08). `saveDraft` cannot be
called without a token, and `SaveResult` has a `conflict` case a caller must handle. This makes
FR-031's "never silently overwrite a newer version" a property of the interface — a host cannot
accidentally implement last-writer-wins, because there is nowhere to put the token that isn't
the check.

Opaque because an ETag, a row version, a vector clock, and a content hash are all reasonable and
the kernel has no basis for preferring one. Explicitly **not** a timestamp: that would need
synchronised clocks and would reintroduce the nondeterminism this codebase bans elsewhere.

Every method returns a result rather than throwing. Storage failure is an expected condition in
an editor that autosaves.

## AssetAdapter

```ts
interface AssetAdapter {
  resolve(assetId: string): Promise<AssetLocation | null>
}
```

The manifest carries what a renderer needs to lay out before the network answers — mime type and
dimensions — so this port supplies only the location. That split is why a slide can reserve
correct space for an image whose bytes have not arrived.

## AnalyticsAdapter

```ts
interface AnalyticsAdapter {
  record(event: LessonEvent): void
}
```

Fire-and-forget: returns void, never throws, never awaited. Analytics must not be able to stall
playback or fail a lesson.

`LessonEvent` carries the lesson version, slide, interaction, attempt, and outcome (FR-033).
**It has no field for a learner identifier.** A host that wants attribution supplies it through
its own transport; there is nowhere in this shape to put one, which is how NFR-PRV-002 is
enforced structurally rather than by review.

## The in-memory reference

`memoryAdapters` implements all six. It is product, not test scaffolding: FR-032 requires the
framework to work with no host code at all, so that `resolve` and playback can be exercised — and
the Next.js example can run — before anyone writes a backend.

Its storage implementation issues incrementing integer tokens and genuinely rejects stale saves,
so the conflict path is exercised by default rather than only in whatever the first real host
gets around to implementing.
