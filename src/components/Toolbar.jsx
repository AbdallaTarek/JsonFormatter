import CopyButton from './CopyButton.jsx'

export default function Toolbar({
  search,
  onSearch,
  view,
  onView,
  indent,
  onIndent,
  onExpandAll,
  onCollapseAll,
  cleanText,
  disabled,
  focused,
  onToggleFocus,
  stats,
}) {
  function download() {
    const blob = new Blob([cleanText], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'clean.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
      <div className="flex overflow-hidden rounded-md border border-slate-800">
        <Tab active={view === 'tree'} onClick={() => onView('tree')}>
          Tree
        </Tab>
        <Tab active={view === 'raw'} onClick={() => onView('raw')}>
          Raw
        </Tab>
      </div>

      {view === 'tree' ? (
        <>
          <Action onClick={onExpandAll} disabled={disabled}>
            Expand all
          </Action>
          <Action onClick={onCollapseAll} disabled={disabled}>
            Collapse all
          </Action>
          <span className="hidden items-center gap-1 text-[11px] text-slate-600 xl:inline-flex">
            <kbd className="rounded border border-slate-700 px-1 text-[10px]">Shift</kbd>
            <span>+ arrow — node and its siblings</span>
          </span>
        </>
      ) : (
        <div className="flex overflow-hidden rounded-md border border-slate-800">
          {[2, 4, 0].map((n) => (
            <Tab key={n} active={indent === n} onClick={() => onIndent(n)}>
              {n === 0 ? 'Minified' : `${n} spaces`}
            </Tab>
          ))}
        </div>
      )}

      {/* The page header is hidden in reading mode, so its stats live here. */}
      {focused && stats && (
        <span className="ml-auto font-mono text-[11px] text-slate-500">{stats}</span>
      )}

      <div className={`relative ${focused && stats ? '' : 'ml-auto'}`}>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search keys & values…"
          className="w-52 rounded-md border border-slate-800 bg-slate-900/60 py-1 pl-7 pr-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
        />
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-600">
          ⌕
        </span>
      </div>

      <CopyButton
        text={cleanText}
        label="Copy all"
        className="border border-slate-800 !px-2 !py-1 !text-[11px] hover:border-slate-600"
      />
      <Action onClick={download} disabled={disabled}>
        Download
      </Action>
      <button
        type="button"
        onClick={onToggleFocus}
        aria-label={focused ? 'Exit full screen' : 'Full screen'}
        aria-pressed={focused}
        title={focused ? 'Exit full screen (Esc)' : 'Full screen — hide the paste box (Esc to exit)'}
        className={`rounded-md border px-2 py-0.5 text-[17px] leading-6 transition ${
          focused
            ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
            : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
        }`}
      >
        {focused ? '⤡' : '⤢'}
      </button>
    </div>
  )
}

function Tab({ active, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`px-2.5 py-1 text-[11px] transition ${
        active ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function Action({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-md border border-slate-800 px-2 py-1 text-[11px] text-slate-400 transition hover:border-slate-600 hover:text-slate-200 disabled:opacity-30"
    >
      {children}
    </button>
  )
}
