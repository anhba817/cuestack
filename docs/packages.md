# Which package do I need?

Cuestack is six packages. Most hosts need two of them.

## The three questions people ask first

**Does this ship a backend?** No. There is no server in this repository, no database, and no
migrations. `@cuestack/adapter-http` is a *client* — it defines four operations and calls whatever
endpoints you give it. Storage, authentication, and multi-tenancy are yours.

**Does it run a server to play a lesson?** No. A lesson is a JSON manifest and playback is entirely
client-side. Serve the JSON from anything — a CDN, an S3 bucket, your existing API. The player needs
no runtime of its own.

**Must I use the editor?** No. `@cuestack/studio` is optional and nothing else depends on it. If
your lessons come from your own tooling, a script, or an LLM, generate manifests that satisfy
`@cuestack/schema` and play them. The editor is one producer of manifests, not the producer.

## The packages

| Package | You need it when | Depends on |
| --- | --- | --- |
| `@cuestack/schema` | You generate or validate manifests yourself. Zod schemas, types, and the migration chain. | — |
| `@cuestack/core` | Always, transitively. Resolution, timing, effects, validation, publishing, packaging. No UI. | schema |
| `@cuestack/react` | You are playing lessons in a browser. **This is the complete player.** | core, schema |
| `@cuestack/studio` | You want the authoring UI — canvas, timeline, inspector. | core, react, schema |
| `@cuestack/adapter-http` | You want save/load/publish wired to your own API. | core, schema |
| `@cuestack/element` | A demonstration that the kernel is framework-agnostic. **Deliberately partial** — see its [README](../packages/element/README.md) before choosing it. | core, schema |

## By goal

**"I want to play a lesson in my React app."**
`@cuestack/react`. Give `LessonPlayer` a manifest and a `resolveAsset`.

**"I want to play a lesson on a page with no framework."**
`@cuestack/element`, if the lesson is text and shapes only. It renders no video, audio, or
questions. If it uses those, you want `@cuestack/react` — read the element package's README, which
says this at more length because it is the mistake worth preventing.

**"I want teachers to author lessons."**
`@cuestack/studio` plus `@cuestack/react`, plus `@cuestack/adapter-http` pointed at your API.

**"I want to generate lessons from my own system."**
`@cuestack/schema` to build valid manifests, `@cuestack/core` to check them (`checkLesson`) and to
publish them. No React needed at all.

**"I want to add an element type of my own."**
[docs/authoring-elements.md](./authoring-elements.md). You will write one `ElementPlugin` for
`@cuestack/core` and one renderer for `@cuestack/react`, and you will not modify either package.

## How they fit together

```text
        schema  ──►  core  ──┬──►  react  ──►  studio
   (the format)   (the kernel)│   (the player)  (the editor)
                              ├──►  adapter-http
                              └──►  element
```

Everything above the kernel is an *adapter*: a way to draw, edit, or transport what the kernel
decides. The kernel decides what is on screen at a given millisecond, and it is the same code in
every one of them — see [packages/element/README.md](../packages/element/README.md) for the test
that holds that claim honest.

## Constraints a host meets whether or not it expects to

These are decisions, not limitations to work around. Meeting them in prose is cheaper than meeting
them in a failing build.

**There is no clock in the editor.** Studio previews a lesson by resolving it at a scrubbed instant;
it does not run time forward on its own. Timing is a playback concern, and an editor that animated
while you dragged would make authoring a moving target. Anything needing elapsed time in the editor
gets it from the preview transport, not from `Date.now()`.

**One manifest is the source of truth.** Not a manifest plus a derived index, plus a cache of
resolved positions. Every view — canvas, timeline, inspector, preview, player — reads the same
document. A second store that could disagree with it is the class of bug the architecture is
arranged to make impossible, which is also why undo is a document operation rather than per-panel.

**Published versions are immutable.** `publish` writes a version and never rewrites one. Correcting
a published lesson means publishing another version; a learner mid-lesson keeps the one they
started. Withdrawal marks a version unavailable rather than deleting it, because a lesson someone
completed last week must still explain what they completed.

**A supplied element registry replaces the default; it does not extend it.** Pass your own registry
and the seven built-ins are *gone* unless you include them. This is deliberate — a host restricting
authors to three types must be able to actually restrict them — but it surprises everyone once.
`builtinElements` is exported so you can spread it:

```ts
createElementRegistry([...builtinElements, myPlugin])
```

**Assets are referenced, never embedded.** A manifest carries asset *ids*; turning one into a URL is
the host's job, through `resolveAsset`. The exception is `exportLesson`, which packages files for
transport — and that is a transport format, not the lesson format.
