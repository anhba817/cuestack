import * as React from 'react'
import { act } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { lessonWith, element } from '../harness/corpus.js'
import { useEditorSession, type EditorSession } from '../../src/session/useEditorSession.js'
import { useHistoryShortcuts } from '../../src/useHistoryShortcuts.js'
import { describeReversal } from '../../src/canvas/Announcer.js'
import { countingIds } from '../harness/ids.js'

/**
 * Undo from the keyboard, wherever focus is.
 *
 * Mounted the way a host mounts it — the hook attached to a wrapper the host owns — because
 * the studio has no editor root of its own and that is exactly why the hook exists rather than
 * a document listener.
 *
 * The text-field case is the one worth reading twice. A keystroke inside an input is left to
 * the platform, and not out of deference: the session holds *one* step for a committed text
 * edit, so an editor-level undo mid-typing would discard the whole paragraph instead of the
 * last word.
 */

// Auto-cleanup is not enabled in this repository, so each render would otherwise leave the
// previous tree mounted and every `getByTestId` would find two.
afterEach(cleanup)

function Host({ onSession }: { onSession: (s: EditorSession) => void }): React.ReactNode {
  // Built once, outside the render: `lessonWith` mints a fresh lesson id per call, so building
  // it inline would hand a different manifest to every render and a slide id that matches none.
  const [manifest] = React.useState(() => lessonWith([element({ id: 'a', effects: [] })]))
  const session = useEditorSession({
    manifest,
    slideId: manifest.slides[0]!.id,
    idSource: countingIds(),
  })
  onSession(session)
  const [root, setRoot] = React.useState<HTMLElement | null>(null)
  useHistoryShortcuts(session, root)
  return (
    <div ref={setRoot} data-testid="root">
      <button type="button" data-testid="canvas-ish">canvas</button>
      <input data-testid="a-field" defaultValue="text" />
      <div data-testid="rich" contentEditable suppressContentEditableWarning />
    </div>
  )
}

function mount() {
  let session!: EditorSession
  const { getByTestId } = render(<Host onSession={(s) => { session = s }} />)
  return { get: () => session, getByTestId }
}

const press = (node: HTMLElement, init: KeyboardEventInit): void => {
  act(() => void fireEvent.keyDown(node, { bubbles: true, ...init }))
}

describe('undo and redo from the keyboard', () => {
  it('undoes on the modifier plus Z, with focus anywhere in the editor', () => {
    const { get, getByTestId } = mount()
    const before = JSON.stringify(get().draft)
    act(() => void get().apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))

    press(getByTestId('canvas-ish'), { key: 'z', metaKey: true })
    expect(JSON.stringify(get().draft)).toBe(before)
  })

  it('redoes on shift plus the modifier plus Z', () => {
    const { get, getByTestId } = mount()
    act(() => void get().apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))
    const after = JSON.stringify(get().draft)

    press(getByTestId('canvas-ish'), { key: 'z', metaKey: true })
    press(getByTestId('canvas-ish'), { key: 'Z', metaKey: true, shiftKey: true })
    expect(JSON.stringify(get().draft)).toBe(after)
  })

  it('accepts Ctrl as readily as Command', () => {
    const { get, getByTestId } = mount()
    const before = JSON.stringify(get().draft)
    act(() => void get().apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))

    press(getByTestId('canvas-ish'), { key: 'z', ctrlKey: true })
    expect(JSON.stringify(get().draft)).toBe(before)
  })

  it('leaves a keystroke inside a text input to the platform', () => {
    const { get, getByTestId } = mount()
    act(() => void get().apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))
    const after = JSON.stringify(get().draft)

    press(getByTestId('a-field'), { key: 'z', metaKey: true })
    expect(JSON.stringify(get().draft)).toBe(after)
  })

  it('leaves a keystroke inside a contenteditable alone too', () => {
    const { get, getByTestId } = mount()
    act(() => void get().apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))
    const after = JSON.stringify(get().draft)

    press(getByTestId('rich'), { key: 'z', metaKey: true })
    expect(JSON.stringify(get().draft)).toBe(after)
  })

  it('ignores Z without a modifier, so typing on the canvas is safe', () => {
    const { get, getByTestId } = mount()
    act(() => void get().apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))
    const after = JSON.stringify(get().draft)

    press(getByTestId('canvas-ish'), { key: 'z' })
    expect(JSON.stringify(get().draft)).toBe(after)
  })
})

describe('each reversal says what it did', () => {
  it('names how many elements came back', () => {
    const { get } = mount()
    act(() => void get().apply({ kind: 'delete', ids: ['a'] }))
    act(() => get().undo())
    expect(get().lastReversal).toMatch(/1 element restored/i)
  })

  it('distinguishes undo from redo', () => {
    const { get } = mount()
    act(() => void get().apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))
    act(() => get().undo())
    expect(get().lastReversal).toMatch(/^Undone/)
    act(() => get().redo())
    expect(get().lastReversal).toMatch(/^Redone/)
  })

  it('mentions the move when the reversal changed slide', () => {
    expect(describeReversal('undo', { restored: 0, slideChanged: true })).toMatch(/moved to the slide/i)
    expect(describeReversal('undo', { restored: 0, slideChanged: false })).not.toMatch(/moved to the slide/i)
  })
})
