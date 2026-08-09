import { useState } from 'react'
import { splitDelimited } from '../lib/delimited.js'
import CopyButton from './CopyButton.jsx'

/**
 * A packed string such as "C1K~TS8~12~...~Margin#0^Markup#0^Fixed#0".
 * Collapsed it reads like any other string; expanded it becomes a numbered
 * table of its parts. Positional only -- no assumptions about the model.
 */
export default function DelimitedString({ value, highlight }) {
  const [open, setOpen] = useState(false)
  const parts = open ? splitDelimited(value) : null

  return (
    <span className="inline-flex max-w-full flex-col gap-1 align-top">
      <span className="flex items-start gap-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Collapse parts' : `Split into ${splitDelimited(value).length} parts`}
          className="mt-px shrink-0 rounded border border-slate-700 px-1 text-[10px] leading-4 text-slate-400 transition hover:border-emerald-500/50 hover:text-emerald-300"
        >
          {open ? '−' : '⋯'}
        </button>
        <span
          onClick={() => setOpen((v) => !v)}
          className={`cursor-pointer break-all text-emerald-300/90 ${open ? 'line-clamp-1 opacity-50' : ''}`}
        >
          "{highlight ? highlight(value) : value}"
        </span>
      </span>

      {open && (
        <span className="mb-1 block overflow-hidden rounded-md border border-slate-800 bg-slate-900/60">
          <span className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500">
            <span>{parts.length} parts · split on ~ | ^ ####</span>
            <CopyButton text={parts.map((p) => p.value).join('\n')} label="Copy parts" />
          </span>
          <span className="block max-h-72 overflow-auto">
            {parts.map((part) => (
              <span
                key={part.path}
                className="flex gap-2 border-b border-slate-800/60 px-2 py-0.5 last:border-0 hover:bg-slate-800/40"
              >
                <span className="w-10 shrink-0 select-none text-right text-[11px] text-slate-600">
                  {part.path}
                </span>
                <span className="break-all text-[12px] text-slate-300">
                  {part.value === '' ? <span className="text-slate-700">∅</span> : part.value}
                </span>
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  )
}
