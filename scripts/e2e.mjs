// End-to-end check of the collapse behaviour in a real Chrome, driven over CDP.
//
//   npm run e2e                 # against the dev server on :5173
//   npm run e2e -- --headful    # watch it happen
//   npm run e2e -- http://localhost:4173/
//
// It pastes json.rtf into the box exactly as a user would, then exercises plain
// click and shift-click on the tree arrows and the section headers. Assertions
// are structural (arrow/row counts), so they survive the log file changing.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const url = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/'
const headful = process.argv.includes('--headful')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const LOG = readFileSync(fileURLToPath(new URL('../json.rtf', import.meta.url)), 'utf8')

const results = []
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  results.push({ ok, name })
  console.log(
    `${ok ? ' ok  ' : 'FAIL '} ${name}` +
      (ok ? '' : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  )
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: !headful,
  args: ['--no-first-run', '--no-default-browser-check'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errors.push(m.text()))

await page.goto(url, { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })

// --- paste the log the way a user does --------------------------------------
await page.waitForSelector('textarea')
const pastedAt = Date.now()
await page.evaluate((text) => {
  const area = document.querySelector('textarea')
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  set.call(area, text)
  area.dispatchEvent(new Event('input', { bubbles: true }))
}, LOG)
await page.waitForSelector('article section')
const renderMs = Date.now() - pastedAt

// --- page helpers ------------------------------------------------------------
const ARROWS = `[...document.querySelectorAll('button')].filter(b => ['▾','▸'].includes(b.textContent.trim()))`

const state = () =>
  page.evaluate(`(() => {
    const arrows = ${ARROWS}
    return {
      arrows: arrows.length,
      open: arrows.filter(b => b.textContent.trim() === '▾').length,
      dom: document.querySelectorAll('*').length,
      sections: document.querySelectorAll('article section').length,
      headerTables: [...document.querySelectorAll('button')].filter(b => b.textContent.includes('Headers')).length,
    }
  })()`)

// Counts restricted to one section, for assertions that must not be disturbed
// by the state of the other body on the page.
const sectionState = (i) =>
  page.evaluate(`(() => {
    const section = document.querySelectorAll('article section')[${i}]
    const arrows = [...section.querySelectorAll('button')].filter(b => ['▾','▸'].includes(b.textContent.trim()))
    return { arrows: arrows.length, open: arrows.filter(b => b.textContent.trim() === '▾').length }
  })()`)

// Arrow indices are global; the response body's root is the first arrow that
// lives inside the second section.
const responseRootIndex = () =>
  page.evaluate(`(() => {
    const arrows = ${ARROWS}
    const sections = [...document.querySelectorAll('article section')]
    return arrows.findIndex(b => sections[1] && sections[1].contains(b))
  })()`)

async function clickArrow(index, { shift = false } = {}) {
  const handle = (
    await page.evaluateHandle(`(() => ${ARROWS}[${index}] ?? null)()`)
  ).asElement()
  if (!handle) throw new Error(`no arrow at index ${index}`)
  const t0 = Date.now()
  if (shift) await page.keyboard.down('Shift')
  await handle.click()
  if (shift) await page.keyboard.up('Shift')
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))))
  return Date.now() - t0
}

async function clickSection(index, { shift = false } = {}) {
  const handle = (
    await page.evaluateHandle(
      `(() => document.querySelectorAll('article section > header')[${index}] ?? null)()`,
    )
  ).asElement()
  if (shift) await page.keyboard.down('Shift')
  await handle.click()
  if (shift) await page.keyboard.up('Shift')
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))))
}

async function clickToolbar(label) {
  const handle = (
    await page.evaluateHandle(
      `(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}) ?? null)()`,
    )
  ).asElement()
  if (!handle) throw new Error(`no toolbar button "${label}"`)
  await handle.click()
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))))
}

// --- 1. the log loads, and loads fast ---------------------------------------
const loaded = await state()
console.log(`\nlog: ${(LOG.length / 1024) | 0} KB · first render ${renderMs} ms · ${loaded.dom} DOM nodes\n`)
check('request and response sections render', loaded.sections, 2)
check('first render stays under 400 ms', renderMs < 400, true)
check('big body is not fully expanded on load', loaded.dom < 5000, true)

// --- 2. plain click is scoped to one level -----------------------------------
// On load each body root is open with its children collapsed: one row per item.
const rootIdx = await responseRootIndex()
const oneLevel = await state()
await clickArrow(rootIdx)
const rootClosed = await state()
check('plain click closes the response root only', rootClosed.arrows < oneLevel.arrows, true)
check('the request body is untouched', rootClosed.sections, 2)
await clickArrow(rootIdx)
check('plain click re-opens exactly one level', (await state()).arrows, oneLevel.arrows)

// --- 3. shift-click opens the clicked node with its siblings -----------------
// The first hotel's arrow sits one below the response root; its siblings are
// the other 43 hotels.
const siblingMs = await clickArrow(rootIdx + 1, { shift: true })
const afterSiblings = await state()
check('shift-click opens every sibling of the clicked node', afterSiblings.arrows > oneLevel.arrows, true)
check('it stops there, nowhere near a deep expand', afterSiblings.arrows < 900, true)
console.log(`        (opened to ${afterSiblings.arrows} arrows in ${siblingMs} ms)`)

// All 44 hotels are open, and each one revealed its own closed branches.
check('every sibling is open', afterSiblings.open >= 45, true)
check('what they revealed stays closed', afterSiblings.arrows - afterSiblings.open > 0, true)

// --- 4. shift-click the same group again closes it ---------------------------
await clickArrow(rootIdx + 1, { shift: true })
check('shift-click again closes that group', (await state()).arrows, oneLevel.arrows)

// --- 5. a nested shift-click must not disturb the other items ----------------
await clickArrow(rootIdx + 1, { shift: true }) // the 44 hotels again
const hotelsOpen = await state()
// rootIdx+2 is the first branch *inside* hotel 0: its siblings are hotel 0's
// own keys, so only hotel 0 may change.
await clickArrow(rootIdx + 2, { shift: true })
const nested = await state()
check('a nested shift-click opens more rows', nested.arrows > hotelsOpen.arrows, true)
check(
  'but only one hotel worth of them',
  nested.arrows - hotelsOpen.arrows < (hotelsOpen.arrows - oneLevel.arrows) / 10,
  true,
)
console.log(`        (nested group added ${nested.arrows - hotelsOpen.arrows} arrows)`)

// --- 6. the toolbar still covers the whole tree ------------------------------
await clickToolbar('Collapse all')
const collapsed = await state()
check('collapse all closes the bodies down to their roots', collapsed.arrows, 2)
await clickToolbar('Expand all')
const expanded = await sectionState(1)
check('expand all opens every branch of the response', expanded.arrows > 1000, true)
check('and every one of them reads open', expanded.open, expanded.arrows)

// --- 7. shift still works on a body collapsed to its root --------------------
// A root has no siblings, so shift there behaves like a plain click: one level.
await clickToolbar('Collapse all')
await clickArrow(await responseRootIndex(), { shift: true })
const fromCollapsed = await sectionState(1)
check('shift-click on a collapsed root opens it', fromCollapsed.arrows > 1, true)
check('one level only, not the whole body', fromCollapsed.arrows < 900, true)

// --- 8. section headers ------------------------------------------------------
await clickToolbar('Collapse all')
const base = await state()
await clickSection(0)
check('plain click closes one section', (await state()).headerTables, base.headerTables - 1)
await clickSection(0, { shift: true })
check('shift-click opens every section', (await state()).headerTables, base.headerTables)
await clickSection(0, { shift: true })
check('shift-click closes every section', (await state()).headerTables, 0)

// --- 9. full-screen reading mode --------------------------------------------
const paneWidth = () =>
  page.evaluate(() => {
    const pane = document.querySelector('article').closest('main > div')
    return Math.round((pane.getBoundingClientRect().width / window.innerWidth) * 100)
  })

const windowed = await paneWidth()
check('the results pane shares the window by default', windowed < 70, true)

await clickToolbar('⤢')
check('the paste box is gone in full screen', await page.$('textarea'), null)
check('the results pane fills the window', (await paneWidth()) >= 99, true)
check('the payload is still rendered', (await state()).sections, 2)

await page.keyboard.press('Escape')
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))))
check('escape brings the paste box back', Boolean(await page.$('textarea')), true)
check('and the pane goes back to sharing the window', await paneWidth(), windowed)

check('no console errors', errors, [])

if (headful) await new Promise((r) => setTimeout(r, 5000))
await browser.close()

const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
