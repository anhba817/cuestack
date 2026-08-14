# Contract: `@cuestack/react` public API

**Date**: 2026-08-14 · **Feature**: `003-react-ssr-player`

## Entry points

| Specifier | Condition | Purpose |
|---|---|---|
| `@cuestack/react` | `default` | Client entry: the player, hooks, the frame loop |
| `@cuestack/react` | `react-server` | Server entry: the same surface, rendering only |

Both entries export the **same names**. A consumer's tsconfig should never have to know which
condition resolved — feature 001 learned that the hard way, when the server entry exported a
different constant and the type layer could not see it.

## The player

```tsx
import { LessonPlayer } from '@cuestack/react'

<LessonPlayer lesson={lesson} />
```

Props are defined in [`../data-model.md`](../data-model.md). Only `lesson` is required.

**Guarantees**

1. **Renders on a server.** No `window`, `document`, `matchMedia`, or clock is read during
   render. Importing the server entry in a Node process with no DOM works.
2. **The first render is the state at time zero**, on both server and client. Playback begins in
   an effect after mount, which is what makes hydration match by construction rather than by care.
3. **Hydration is byte-identical.** Server markup equals the client's first render for every
   corpus slide, with no mismatch warning.
4. **No global styles.** Everything is scoped beneath the stage element. A host's own typography
   and resets are untouched.
5. **React is a peer.** The host's copy is the only copy.
6. **Computes no timing.** Visibility, opacity, and effect progress come from
   `resolve()`. There is no second implementation of when things happen.

**Not guaranteed**: that playback is smooth at 300 animating elements. That is Wave 3's budget;
this wave's architecture keeps it reachable by keeping the frame loop out of React, but does not
yet measure it.

## Playback

```tsx
const { transport } = usePlayer()   // inside a LessonPlayer subtree
transport.play(); transport.seek(4000)
```

`usePlayer` is client-only and throws outside a `LessonPlayer`. The transport is the kernel's,
unwrapped — deliberately, so a host driving playback and the player itself cannot hold different
ideas of the current time.

## Element renderers

```tsx
import { createRendererRegistry, builtinRenderers } from '@cuestack/react'

const elements = createRendererRegistry([...builtinRenderers, myRenderer])
<LessonPlayer lesson={lesson} elements={elements} />
```

See [`element-renderer-contract.md`](./element-renderer-contract.md).

## Styles

```tsx
import '@cuestack/react/styles.css'
```

Required. The stylesheet is where scaling happens, so a player without it is unpositioned rather
than merely unstyled — see [`stage-css-contract.md`](./stage-css-contract.md) for why that is
deliberate.

## What this package will never do

- **Read a viewport.** Scaling is CSS. Nothing calls `getBoundingClientRect` or observes a resize.
- **Decide about reduced motion.** It expresses motion as custom properties a stylesheet can
  neutralise, and stops there. The preference cannot be read on a server.
- **Validate a lesson.** It assumes `@cuestack/schema` accepted it.
- **Bundle React, or require Next.js.** It works in a host that never server-renders.
