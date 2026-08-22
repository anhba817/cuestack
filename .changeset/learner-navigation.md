---
'@cuestack/react': minor
'@cuestack/element': minor
'@cuestack/core': minor
---

A learner can move through a lesson.

Navigation controls that know when they may act: a slide gated by a required question or
by media that has not finished refuses to advance, and says so, rather than appearing
operable and doing nothing. `learnerMayLeave` states that rule once, in the kernel, so
both adapters answer the same question the same way.

Fixes: a learner who reviewed a lesson could not complete it again in either adapter, and
the web component never reported a timed slide carrying a required question.
