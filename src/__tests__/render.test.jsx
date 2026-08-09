import { renderToString } from 'react-dom/server'
import { beforeAll, describe, expect, it } from 'vitest'
import App from '../App.jsx'
import SAMPLE from '../sample.js'

// Server rendering is enough to catch broken JSX, bad imports and crashes in the
// initial render path without pulling in a full DOM.
let html = ''

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
  html = renderToString(<App />)
})

describe('App rendered with the sample log restored from storage', () => {
  it('renders the transaction header', () => {
    expect(html).toContain('A1B2C3D4')
    expect(html).toContain('PUT')
    expect(html).toContain('/v1/public/booking/api/v1/hotels/1234/rooms/prices')
    expect(html).toContain('200')
    expect(html).toContain('120ms')
  })

  it('renders body keys and values in the tree', () => {
    expect(html).toContain('taxBreakdown')
    expect(html).toContain('codeDescription')
    expect(html).toContain('1200.5')
  })

  it('renders headers and query params sections', () => {
    expect(html).toContain('Headers')
    expect(html).toContain('Query params')
  })
})

describe('App with no stored input', () => {
  it('renders the empty state instead of crashing', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('storage disabled')
        },
        setItem: () => {},
      },
    })
    expect(renderToString(<App />)).toContain('Paste a log on the left')
  })
})
