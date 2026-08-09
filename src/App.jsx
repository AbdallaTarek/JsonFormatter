import { useEffect, useMemo, useState } from 'react'
import { parseLog } from './lib/logParser.js'
import InputPane from './components/InputPane.jsx'
import Toolbar from './components/Toolbar.jsx'
import TransactionCard from './components/TransactionCard.jsx'
import SAMPLE from './sample.js'

const STORAGE_KEY = 'json-log-formatter:input'

// Storage is a convenience, never a requirement: private browsing modes and
// server rendering both make it unavailable.
function loadInput() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveInput(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [raw, setRaw] = useState(loadInput)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('tree')
  const [indent, setIndent] = useState(2)
  // Bumping resetKey remounts the trees, which is how expand/collapse-all applies
  // to nodes the user has already toggled by hand.
  const [expandAll, setExpandAll] = useState(true)
  const [resetKey, setResetKey] = useState(0)
  // Reading mode: the paste box and the page header step aside so a wide payload
  // gets the whole window.
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    saveInput(raw)
  }, [raw])

  useEffect(() => {
    if (!focused) return
    function onKeyDown(event) {
      if (event.key !== 'Escape' || event.metaKey || event.ctrlKey || event.altKey) return
      setFocused(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focused])

  const transactions = useMemo(() => {
    try {
      return parseLog(raw)
    } catch (err) {
      console.error('parseLog failed', err)
      return []
    }
  }, [raw])

  const bodies = transactions.flatMap((t) => t.sections.filter((s) => s.body !== null))
  const cleanText = useMemo(() => {
    const parts = bodies.map((s) => JSON.stringify(s.body, null, indent))
    return parts.length === 1 ? parts[0] : parts.join('\n\n')
  }, [bodies, indent])

  function setAll(open) {
    setExpandAll(open)
    setResetKey((k) => k + 1)
  }

  const stats = transactions.length
    ? `${transactions.length} transaction${transactions.length === 1 ? '' : 's'} · ${bodies.length} bod${bodies.length === 1 ? 'y' : 'ies'}`
    : ''

  return (
    <div className="flex h-full flex-col">
      {!focused && (
        <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-2.5">
          <h1 className="font-mono text-[13px] font-semibold tracking-tight text-slate-200">
            JSON<span className="text-emerald-400">·</span>Log Formatter
          </h1>
          <p className="hidden text-[11px] text-slate-600 sm:block">
            paste a raw request/response log or plain JSON
          </p>
          {stats && <span className="ml-auto font-mono text-[11px] text-slate-500">{stats}</span>}
        </header>
      )}

      <main
        className={
          focused
            ? 'grid min-h-0 flex-1 grid-cols-1'
            : 'grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(320px,38%)_1fr]'
        }
      >
        {!focused && <InputPane value={raw} onChange={setRaw} onLoadSample={() => setRaw(SAMPLE)} />}

        <div
          className={`flex min-h-0 flex-col overflow-hidden bg-slate-900/40 ${
            focused ? '' : 'rounded-xl border border-slate-800'
          }`}
        >
          <Toolbar
            search={search}
            onSearch={setSearch}
            view={view}
            onView={setView}
            indent={indent}
            onIndent={setIndent}
            onExpandAll={() => setAll(true)}
            onCollapseAll={() => setAll(false)}
            cleanText={cleanText}
            disabled={!bodies.length}
            focused={focused}
            onToggleFocus={() => setFocused((v) => !v)}
            stats={stats}
          />

          <div className="min-h-0 flex-1 overflow-auto p-3">
            {!transactions.length ? (
              <Empty hasInput={Boolean(raw.trim())} />
            ) : view === 'raw' ? (
              <pre className="whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-slate-300">
                {cleanText || 'No JSON body found.'}
              </pre>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction, i) => (
                  <TransactionCard
                    key={i}
                    transaction={transaction}
                    search={search}
                    expandAll={expandAll}
                    resetKey={resetKey}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function Empty({ hasInput }) {
  return (
    <div className="flex h-full items-center justify-center text-center text-[12px] text-slate-600">
      {hasInput
        ? 'Nothing recognisable yet — keep pasting.'
        : 'Paste a log on the left, or hit Sample to see how it looks.'}
    </div>
  )
}
