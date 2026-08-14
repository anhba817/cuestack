---
name: dev-plan
description: Create and maintain structured, terminal-readable development plans that spec, score, and prioritize work into waves. During coding sessions, use this whenever the user wants to plan a feature rollout, sequence a multi-step change, prioritize a backlog, lay out a roadmap, decide what to build next, or track progress on an existing plan — and whenever a planning discussion produces more than a couple of dependent steps.
argument-hint: [what to plan]
---

# Dev plan

Produce a plan that lives in the repo as plain markdown — readable in a terminal,
cheap in tokens, and updatable in place by flipping a status glyph.

## Status vocabulary

Put this legend at the top of every plan, then mark each item:

- ✅ complete
- 🔄 partial / in-progress
- 💡 proposed — analysis-backed, recommended next, not yet started
- ⏸️ deferred / paused — parked on purpose, with a re-open trigger
- 🔲 unmarked / not started

Updating status is a one-character edit. Track live incident or hotfix execution
in the PR/commits, not in the plan prose.

## Simple or complex

Pick the shape from the work, and say which in one line:

- **Simple** — one feature or a short, mostly-sequential change. Low uncertainty,
  few or no parallel tracks. Use the template below; qualitative scoring table.
- **Complex** — several interdependent items or parallel tracks, work that spans
  types (tooling, features, eval/testing…), anything that changes production
  behavior, or real uncertainty about ordering and payoff. Read
  `references/complex-plan.md` and follow it.

When in doubt, start simple and promote to complex if it grows.

## Simple plan template

```
# <Effort name> — plan

Status: ✅ complete · 🔄 in-progress · unmarked = not started

## Goal
<one or two sentences: what changes and why>

## Steps  (ordered by priority — see below)
1. [H] <high>
2. [M] <medium>
3. [L] <low>

## Done when
<the observable condition that means this is finished>
```

Tag each step **H / M / L** as an qualitative estimate of impact ÷
difficulty, and order the sequence, highest at the top.

If you find yourself wanting columns, a real score, or a dependency diagram,
switch to the complex format.

## Core behaviors

- **Write it to the repo.** Save the plan as markdown at the repo root (or
  alongside related plans), named for the effort, e.g. `core_model_upgrade.md` —
  the file is the deliverable, not just chat.
- **Stay terminal-readable and token-lean.** Plain ASCII and the status glyphs;
  no rendered diagrams. The plan is re-read on every turn it's in context, so
  every line is a recurring cost. Draw dependencies as an ASCII graph (see the
  reference), not a rendering tool.
- **Keep the human in the loop.** Present the plan, and check in between waves so
  the human can steer rather than running straight through to the end.
- **Propose the next tranche.** After laying out or updating a plan, name the
  next small, shippable chunk and ask whether to take it.

## Updating a plan

When a plan already exists, edit it in place — flip glyphs, add a finding, add or
drop an item — rather than regenerating the file; a small diff keeps it
reviewable. After a status change, re-check what's now unblocked; in a complex
plan, confirm the critical path still holds and call out if it moved.

## When to suggest a plan

When a conversation turns into real planning — several dependent steps, parallel
tracks to sequence, or multi-part work with nothing written down — offer to
capture it, or to extend an existing plan. Suggest, don't auto-write; nudge once,
and drop it if the user passes.
