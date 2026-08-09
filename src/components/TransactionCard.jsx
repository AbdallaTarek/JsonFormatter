import { useEffect, useState } from 'react'
import JsonTree from './JsonTree.jsx'
import HeadersTable from './HeadersTable.jsx'
import CopyButton from './CopyButton.jsx'

export default function TransactionCard({ transaction, search, expandAll, resetKey }) {
  // Which sections are collapsed lives here so a shift-click on one section's
  // arrow can open or close every section in the card at once.
  const [closed, setClosed] = useState(() => new Set())

  useEffect(() => setClosed(new Set()), [resetKey, expandAll])

  function toggleSection(index, all) {
    setClosed((prev) => {
      const willOpen = prev.has(index)
      if (all) {
        return willOpen ? new Set() : new Set(transaction.sections.map((_, i) => i))
      }
      const next = new Set(prev)
      if (willOpen) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <article className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/30">
      {transaction.id && (
        <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-1.5 font-mono text-[11px] text-slate-500">
          {transaction.id}
        </div>
      )}
      <div className="divide-y divide-slate-800">
        {transaction.sections.map((section, i) => (
          <Section
            key={i}
            section={section}
            search={search}
            expandAll={expandAll}
            resetKey={resetKey}
            open={!closed.has(i)}
            onToggle={(event) => toggleSection(i, event.shiftKey)}
          />
        ))}
      </div>
    </article>
  )
}

function Section({ section, search, expandAll, resetKey, open, onToggle }) {
  const isResponse = section.kind === 'RESPONSE'

  return (
    <section>
      <header
        onClick={onToggle}
        title={`${open ? 'Collapse' : 'Expand'} — shift-click for every section`}
        className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-2.5 transition hover:bg-slate-800/30"
      >
        <span className="w-3 shrink-0 text-slate-600">{open ? '▾' : '▸'}</span>

        {section.kind !== 'BODY' && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              isResponse ? 'bg-slate-800 text-slate-400' : 'bg-sky-500/15 text-sky-300'
            }`}
          >
            {isResponse ? 'Res' : 'Req'}
          </span>
        )}

        {section.method && (
          <span className="font-mono text-[12px] font-semibold text-violet-300">
            {section.method}
          </span>
        )}
        {section.path && (
          <span className="min-w-0 truncate font-mono text-[12px] text-slate-300">
            {section.path}
          </span>
        )}
        {section.kind === 'BODY' && (
          <span className="text-[12px] uppercase tracking-wider text-slate-500">JSON</span>
        )}

        <span className="ml-auto flex items-center gap-2">
          {section.repaired && (
            <span
              title="Body was auto-repaired (trailing commas / unquoted keys)"
              className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300"
            >
              repaired
            </span>
          )}
          {section.duration != null && (
            <span className="font-mono text-[11px] text-slate-500">{section.duration}ms</span>
          )}
          {section.status != null && <StatusPill section={section} />}
        </span>
      </header>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          {section.query.length > 0 && (
            <HeadersTable title="Query params" rows={section.query} />
          )}
          {section.headers.length > 0 && (
            <HeadersTable title="Headers" rows={section.headers} />
          )}

          {section.body !== null && (
            <div className="rounded-md border border-slate-800 bg-slate-950/60">
              <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-500">
                <span>Body</span>
                <CopyButton text={JSON.stringify(section.body, null, 2)} label="Copy JSON" />
              </div>
              <div className="overflow-auto px-2 py-2">
                <JsonTree
                  value={section.body}
                  search={search}
                  defaultOpen={expandAll}
                  resetKey={resetKey}
                />
              </div>
            </div>
          )}

          {section.parseError && <ParseError section={section} />}
        </div>
      )}
    </section>
  )
}

function StatusPill({ section }) {
  const status = section.status
  const tone =
    status < 300
      ? 'bg-emerald-500/15 text-emerald-300'
      : status < 400
        ? 'bg-sky-500/15 text-sky-300'
        : status < 500
          ? 'bg-amber-500/15 text-amber-300'
          : 'bg-rose-500/15 text-rose-300'

  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${tone}`}>
      {status}
      {section.statusText && <span className="ml-1 opacity-70">{section.statusText}</span>}
    </span>
  )
}

function ParseError({ section }) {
  const lines = section.bodyRaw.split('\n')
  return (
    <div className="rounded-md border border-rose-500/30 bg-rose-500/5">
      <div className="border-b border-rose-500/20 px-3 py-1.5 text-[11px] text-rose-300">
        Could not parse body — {section.parseError.error}
      </div>
      <pre className="max-h-96 overflow-auto px-3 py-2 font-mono text-[12px] leading-relaxed">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`flex gap-3 ${
              section.parseError.line === i + 1 ? 'bg-rose-500/15 text-rose-200' : 'text-slate-400'
            }`}
          >
            <span className="w-8 shrink-0 select-none text-right text-slate-700">{i + 1}</span>
            <span className="whitespace-pre-wrap break-all">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  )
}
