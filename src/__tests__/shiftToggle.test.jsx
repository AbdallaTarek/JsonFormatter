// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import JsonTree from '../components/JsonTree.jsx'
import TransactionCard from '../components/TransactionCard.jsx'
import { parseLog } from '../lib/logParser.js'
import SAMPLE from '../sample.js'

afterEach(cleanup)

const RESPONSE_BODY = parseLog(SAMPLE)[0].sections[1].body

// Shaped like the real search response: a list of items that repeat the same
// keys, which is what makes level-toggling worth having.
const ITEMS = [
  { id: 1, policies: { free: true }, images: { main: 'a' } },
  { id: 2, policies: { free: false }, images: { main: 'b' } },
]

// Arrows are the only buttons whose label is a chevron. Their state is the
// reliable signal: a collapsed object also prints a preview of its key names,
// so searching for a key's text alone cannot tell open from closed.
function arrows() {
  return screen
    .getAllByRole('button')
    .filter((b) => b.textContent === '▾' || b.textContent === '▸')
}

function openArrows() {
  return arrows().filter((b) => b.textContent === '▾')
}

// The arrow belonging to the row a given key label sits in.
function arrowOf(keyElement) {
  return keyElement.closest('.group').querySelector('button')
}

async function clickWith(user, element, modifier) {
  if (modifier) await user.keyboard(`{${modifier}>}`)
  await user.click(element)
  if (modifier) await user.keyboard(`{/${modifier}}`)
}

describe('shift-click toggles a node with its siblings', () => {
  it('opens every item sharing the clicked node’s parent', async () => {
    const user = userEvent.setup()
    render(<JsonTree value={ITEMS} defaultOpen={false} />)

    // Only the root is open: the two items are listed but closed.
    expect(arrows()).toHaveLength(3)
    expect(screen.queryByText('policies')).toBeNull()

    // Shift-click the first item. Both items are children of the root, so both
    // open - one level, not a deep expand.
    await clickWith(user, arrows()[1], 'Shift')
    expect(screen.getAllByText('policies')).toHaveLength(2)
    expect(screen.getAllByText('images')).toHaveLength(2)
    expect(arrows()).toHaveLength(7)
    expect(openArrows()).toHaveLength(3)
  })

  it('leaves the other items alone when the clicked node is nested', async () => {
    const user = userEvent.setup()
    render(<JsonTree value={ITEMS} defaultOpen={false} />)

    await clickWith(user, arrows()[1], 'Shift') // both items open
    expect(openArrows()).toHaveLength(3)

    // Shift-click `policies` inside the first item: only that item's own
    // branches follow - the second item keeps its state entirely.
    await clickWith(user, arrowOf(screen.getAllByText('policies')[0]), 'Shift')

    // Root + 2 items + the first item's policies and images = 5 open, while the
    // second item's two branches stay closed. (Counting arrows, not key text:
    // a collapsed object also prints a preview of its keys.)
    expect(openArrows()).toHaveLength(5)
    expect(arrows()).toHaveLength(7)
  })

  it('closes the group again on a second shift-click', async () => {
    const user = userEvent.setup()
    render(<JsonTree value={ITEMS} defaultOpen={false} />)

    await clickWith(user, arrows()[1], 'Shift')
    expect(screen.getAllByText('policies')).toHaveLength(2)

    await clickWith(user, arrows()[1], 'Shift')
    expect(screen.queryByText('policies')).toBeNull()
    expect(arrows()).toHaveLength(3) // root plus the two items, still listed
  })

  it('opens the group when only some of it is open', async () => {
    const user = userEvent.setup()
    render(<JsonTree value={ITEMS} defaultOpen={false} />)

    // Open just the first item by hand, so the group is half open.
    await user.click(arrows()[1])
    expect(screen.getAllByText('policies')).toHaveLength(1)

    // Shift-click it: the direction comes from the group, so it opens the rest
    // rather than collapsing the one already showing.
    await clickWith(user, arrows()[1], 'Shift')
    expect(screen.getAllByText('policies')).toHaveLength(2)
  })
})

describe('plain click', () => {
  it('is scoped to the clicked node', async () => {
    const user = userEvent.setup()
    render(<JsonTree value={RESPONSE_BODY} />)

    // Everything starts expanded: the deepest keys are visible.
    expect(screen.getAllByText('codeDescription')).toHaveLength(2)

    // Clicking the taxBreakdown arrow hides its children only.
    await user.click(arrows()[2])
    expect(screen.queryByText('codeDescription')).toBeNull()
    expect(screen.getByText('totalTax')).toBeTruthy()

    // Re-expanding restores them, proving the click touched nothing else.
    await user.click(arrows()[2])
    expect(screen.getAllByText('codeDescription')).toHaveLength(2)
  })

  it('auto-collapses bodies with more branches than the render budget', async () => {
    // 400 branches, past AUTO_EXPAND_LIMIT: only the root should be expanded.
    const big = Array.from({ length: 400 }, (_, i) => ({ deep: { n: i } }))
    render(<JsonTree value={big} />)
    expect(screen.getAllByText('deep')).toHaveLength(400) // one level: the array items
    expect(screen.queryByText('n')).toBeNull() // but not their contents
  })
})

describe('shift-click on a section header', () => {
  const transaction = parseLog(SAMPLE)[0]

  it('opens or closes every section of the card at once', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <TransactionCard transaction={transaction} search="" expandAll resetKey={0} />,
    )

    const headers = container.querySelectorAll('header')
    expect(headers).toHaveLength(2)
    expect(within(container).getAllByText('Headers')).toHaveLength(2)

    // Plain click closes just the request section.
    await user.click(headers[0])
    expect(within(container).getAllByText('Headers')).toHaveLength(1)

    // Shift-click reopens all of them.
    await clickWith(user, headers[0], 'Shift')
    expect(within(container).getAllByText('Headers')).toHaveLength(2)

    // Shift-click again closes all of them.
    await clickWith(user, headers[0], 'Shift')
    expect(within(container).queryByText('Headers')).toBeNull()
  })
})
