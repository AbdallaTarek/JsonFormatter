import { useRef, useState } from 'react'

export default function InputPane({ value, onChange, onLoadSample }) {
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef(null)

  async function readFile(file) {
    if (!file) return
    onChange(await file.text())
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        readFile(e.dataTransfer.files[0])
      }}
      className={`relative flex min-h-0 flex-1 flex-col rounded-xl border bg-slate-900/40 transition ${
        dragging ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-slate-800'
      }`}
    >
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Paste log</span>
        <div className="ml-auto flex gap-1">
          <PaneButton onClick={() => fileInput.current?.click()}>Open file</PaneButton>
          <PaneButton onClick={onLoadSample}>Sample</PaneButton>
          <PaneButton onClick={() => onChange('')} disabled={!value}>
            Clear
          </PaneButton>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.log,.json,.rtf"
          className="hidden"
          onChange={(e) => readFile(e.target.files[0])}
        />
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder={PLACEHOLDER}
        className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-[12px] leading-relaxed text-slate-300 placeholder:text-slate-700 focus:outline-none"
      />

      <div className="border-t border-slate-800 px-3 py-1.5 text-[11px] text-slate-600">
        {value ? `${value.length.toLocaleString()} chars · ${value.split('\n').length} lines` : 'Drop a .txt / .log / .json / .rtf file anywhere here'}
      </div>
    </div>
  )
}

function PaneButton({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="rounded border border-slate-800 px-2 py-0.5 text-[11px] text-slate-400 transition hover:border-slate-600 hover:text-slate-200 disabled:opacity-30 disabled:hover:border-slate-800 disabled:hover:text-slate-400"
    >
      {children}
    </button>
  )
}

const PLACEHOLDER = `Paste anything:

┌──────────────────────────────
│ ➡️ REQUEST  [ID]
│ PUT https://api.example.com/v1/things?x=1
│ Headers:
│   Content-Type: application/json
│ Body:
│   { "hello": "world" }
└──────────────────────────────

…or just plain JSON.`
