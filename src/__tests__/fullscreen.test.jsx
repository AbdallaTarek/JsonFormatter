// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import App from '../App.jsx'
import SAMPLE from '../sample.js'

afterEach(cleanup)

beforeAll(() => {
  const store = new Map([['json-log-formatter:input', SAMPLE]])
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    },
  })
})

describe('full-screen reading mode', () => {
  it('hides the paste box and the page header, and keeps the results', async () => {
    const user = userEvent.setup()
    render(<App />)

    // querySelector, not getByRole('textbox'): the search box is a textbox too.
    expect(document.querySelector('textarea')).toBeTruthy()
    expect(screen.getByRole('heading')).toBeTruthy()
    expect(screen.getByText('taxBreakdown')).toBeTruthy()

    await user.click(screen.getByLabelText('Full screen'))

    expect(document.querySelector('textarea')).toBeNull()
    expect(screen.queryByRole('heading')).toBeNull()
    // The payload is still there - only the chrome around it went away.
    expect(screen.getByText('taxBreakdown')).toBeTruthy()
    expect(screen.getByLabelText('Exit full screen')).toBeTruthy()
  })

  it('marks the button as active while full screen is on', async () => {
    const user = userEvent.setup()
    render(<App />)

    const button = screen.getByLabelText('Full screen')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.className).not.toMatch(/emerald/)

    await user.click(button)

    const active = screen.getByLabelText('Exit full screen')
    expect(active.getAttribute('aria-pressed')).toBe('true')
    expect(active.className).toMatch(/emerald/)
  })

  it('comes back on Escape', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByLabelText('Full screen'))
    expect(document.querySelector('textarea')).toBeNull()

    await user.keyboard('{Escape}')
    expect(document.querySelector('textarea')).toBeTruthy()
    expect(screen.getByRole('heading')).toBeTruthy()
  })

  it('comes back on a second click of the button', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByLabelText('Full screen'))
    await user.click(screen.getByLabelText('Exit full screen'))
    expect(document.querySelector('textarea')).toBeTruthy()
  })

  it('keeps the pasted text when the box is hidden and shown again', async () => {
    const user = userEvent.setup()
    render(<App />)

    const before = document.querySelector('textarea').value
    await user.click(screen.getByLabelText('Full screen'))
    await user.keyboard('{Escape}')
    expect(document.querySelector('textarea').value).toBe(before)
  })
})
