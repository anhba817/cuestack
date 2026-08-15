import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { questionElement, lessonOf, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'

/**
 * FR-007, SC-001: answerable by keyboard alone, with the outcome announced.
 *
 * The announcement is the half automated checking usually misses and a sighted developer
 * never notices. A colour change is not feedback to a learner using a screen reader, and a
 * result rendered into a container that is not a live region is a result nobody hears.
 */

const mount = async (payload: Record<string, unknown> = {}) => {
  const lesson = lessonOf([slide([questionElement({ id: 'q', payload })], { durationMs: 10_000 })])
  const container = await client(h(LessonPlayer, { lesson, ports: testPorts() }))
  return container
}

const radios = (c: HTMLElement) => [...c.querySelectorAll<HTMLInputElement>('input[type="radio"]')]

describe('a question is operable by keyboard', () => {
  it('keeps every control in the tab order', async () => {
    const container = await mount()
    const controls = [...container.querySelectorAll('input, button')]
    expect(controls.length).toBeGreaterThan(0)
    for (const control of controls) expect(control.getAttribute('tabindex')).not.toBe('-1')
  })

  it('names every option', async () => {
    const container = await mount()
    for (const radio of radios(container)) {
      const label = radio.closest('label')
      expect(label?.textContent?.trim()).toBeTruthy()
    }
  })

  it('groups the options and labels the group with the prompt', async () => {
    const container = await mount()
    const group = container.querySelector('[role="radiogroup"]')
    expect(group).not.toBeNull()
    const labelledBy = group!.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(container.querySelector(`#${labelledBy}`)?.textContent).toMatch(/reported/i)
  })

  it('marks a required question as required', async () => {
    const container = await mount()
    expect(container.querySelector('[aria-required="true"]')).not.toBeNull()
  })

  it('gives the submit control an accessible name', async () => {
    const container = await mount()
    const submit = [...container.querySelectorAll('button')].find((b) =>
      /submit|answer/i.test(b.textContent ?? ''),
    )
    expect(submit?.textContent?.trim()).toBeTruthy()
  })
})

describe('the outcome is announced, not only shown', () => {
  it('puts feedback in a live region', async () => {
    const container = await mount()
    const live = container.querySelector('[role="status"], [aria-live]')
    expect(live, 'no live region for the outcome').not.toBeNull()
  })

  it('announces the result after answering', async () => {
    const container = await mount()
    await act(async () => {
      radios(container)[0]!.click()
    })
    await act(async () => {
      ;[...container.querySelectorAll('button')]
        .find((b) => /submit|answer/i.test(b.textContent ?? ''))!
        .click()
    })
    const live = container.querySelector('[role="status"], [aria-live]')!
    expect(live.textContent).toMatch(/correct/i)
  })

  it('announces the remaining attempts alongside the result', async () => {
    // Two facts a learner needs at once: whether they were right, and whether they may try
    // again. Split across two regions, a screen reader may deliver only one.
    const container = await mount({ maxAttempts: 3, completionPolicy: 'on_correct' })
    await act(async () => {
      radios(container)[1]!.click()
    })
    await act(async () => {
      ;[...container.querySelectorAll('button')]
        .find((b) => /submit|answer/i.test(b.textContent ?? ''))!
        .click()
    })
    const live = container.querySelector('[role="status"], [aria-live]')!
    expect(live.textContent).toMatch(/2 attempts?/i)
  })

  it('exposes the closed state on the controls rather than only in prose', async () => {
    const container = await mount()
    await act(async () => {
      radios(container)[0]!.click()
    })
    await act(async () => {
      ;[...container.querySelectorAll('button')]
        .find((b) => /submit|answer/i.test(b.textContent ?? ''))!
        .click()
    })
    for (const radio of radios(container)) expect(radio.getAttribute('aria-disabled')).toBe('true')
  })
})
