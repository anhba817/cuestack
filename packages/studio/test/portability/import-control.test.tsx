import { act } from 'react'
import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PortabilityControls } from '../../src/portability/PortabilityControls.js'
import { renderEditor } from '../harness/editor.js'
import { lessonWith, element } from '../harness/corpus.js'
import { exportLesson, importLesson, readPackage } from '@cuestack/core'

afterEach(cleanup)

const DRAFT = lessonWith([element({ id: 'a', effects: [] })])
const press = (node: HTMLElement): void => {
  act(() => node.click())
}
const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('the import control', () => {
  it('asks the host for a package rather than reading one itself', async () => {
    const requestPackage = vi.fn(async () => null)
    const { container } = render(
      <PortabilityControls
        draft={DRAFT}
        onExported={vi.fn()}
        requestPackage={requestPackage}
        onImport={vi.fn(() => 'done')}
      />,
    )

    press(container.querySelector<HTMLButtonElement>('[data-cs-import]')!)
    await settle()

    expect(requestPackage).toHaveBeenCalled()
    expect(container.querySelector('input[type="file"]')).toBeNull()
  })

  it('reports what happened rather than leaving a teacher to infer it', async () => {
    const { container } = render(
      <PortabilityControls
        draft={DRAFT}
        onExported={vi.fn()}
        requestPackage={async () => '{}'}
        onImport={() => 'Imported, and brought forward from an older format.'}
      />,
    )

    press(container.querySelector<HTMLButtonElement>('[data-cs-import]')!)
    await settle()

    const status = container.querySelector('.cs-portability-status')!
    expect(status.textContent).toContain('brought forward')
    expect(status.getAttribute('role')).toBe('status')
  })

  it('says nothing when the teacher changed their mind', async () => {
    const { container } = render(
      <PortabilityControls
        draft={DRAFT}
        onExported={vi.fn()}
        requestPackage={async () => null}
        onImport={vi.fn()}
      />,
    )

    press(container.querySelector<HTMLButtonElement>('[data-cs-import]')!)
    await settle()

    // Closing a picker without choosing is not an error, and announcing one would be noise.
    expect(container.querySelector('.cs-portability-status')).toBeNull()
  })

  it('offers importing only when the host supplies both halves', () => {
    const { container } = render(<PortabilityControls draft={DRAFT} onExported={vi.fn()} />)
    expect(container.querySelector('[data-cs-import]')).toBeNull()
  })

  it('is operable from the keyboard with an accessible name', () => {
    const { container } = render(
      <PortabilityControls
        draft={DRAFT}
        onExported={vi.fn()}
        requestPackage={async () => null}
        onImport={vi.fn()}
      />,
    )
    const button = within(container).getByRole('button', { name: /import/i })
    button.focus()
    expect(document.activeElement).toBe(button)
  })
})

describe('importing into the open lesson', () => {
  it('replaces the draft, and one undo returns what was there', () => {
    /**
     * FR-015c. Replacing somebody's work is destructive, and NFR-USA-003 requires destructive
     * actions to be undoable or confirmed — this framework answered *undoable* when feature 008
     * deleted its last confirmation dialog. `apply` records a history step for every successful
     * edit, so routing an import through `replace-draft` gets reversibility for free.
     *
     * This asserts the route, not the reversal: `every-kind.test.tsx` already proves `replace-draft`
     * reverses byte for byte. What could go wrong here is an import that went around it.
     */
    const { handle } = renderEditor(DRAFT)
    act(() =>
      void handle.session.apply({
        kind: 'set-field',
        id: 'a',
        path: ['payload', 'text'],
        value: 'Work in progress',
      }),
    )
    const mine = JSON.stringify(handle.session.draft)

    const arriving = lessonWith([element({ id: 'z', effects: [], payload: { text: 'Theirs' } })])
    const read = readPackage(JSON.stringify(exportLesson(arriving, { kind: 'draft' })))
    if (!read.ok) throw new Error('unreachable')
    const imported = importLesson(read.package, { lessonId: handle.session.draft.lesson.id })
    if (!imported.ok) throw new Error('unreachable')

    act(() => void handle.session.apply({ kind: 'replace-draft', manifest: imported.lesson }))
    expect(handle.session.draft.slides[0]!.elements[0]!.id).toBe('z')

    act(() => handle.session.undo())
    expect(JSON.stringify(handle.session.draft)).toBe(mine)
  })

  it('keeps the open lesson identity rather than the package one', () => {
    const { handle } = renderEditor(DRAFT)
    const arriving = lessonWith([element({ id: 'z', effects: [] })])
    const read = readPackage(JSON.stringify(exportLesson(arriving, { kind: 'draft' })))
    if (!read.ok) throw new Error('unreachable')

    const imported = importLesson(read.package, { lessonId: handle.session.draft.lesson.id })
    if (!imported.ok) throw new Error('unreachable')
    expect(imported.lesson.lesson.id).toBe(DRAFT.lesson.id)
  })
})
