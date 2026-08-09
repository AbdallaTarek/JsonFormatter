import { useState } from 'react'

const REDACTED = /^[•*]{3,}$/

export default function HeadersTable({ title, rows }) {
  const [open, setOpen] = useState(false)
  if (!rows.length) return null

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] uppercase tracking-wider text-slate-500 transition hover:text-slate-300"
      >
        <span className="w-3 text-slate-600">{open ? '▾' : '▸'}</span>
        {title}
        <span className="text-slate-600">({rows.length})</span>
      </button>

      {open && (
        <div className="border-t border-slate-800 px-3 py-2 font-mono text-[12px]">
          {rows.map((row, i) => (
            <div key={`${row.name}-${i}`} className="flex flex-wrap gap-x-2 py-0.5">
              <span className="text-sky-300/80">{row.name}</span>
              <span
                className={REDACTED.test(row.value) ? 'text-slate-600' : 'break-all text-slate-300'}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
