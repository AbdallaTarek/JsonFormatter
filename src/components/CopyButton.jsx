import { useEffect, useState } from 'react'

export default function CopyButton({ text, label = 'Copy', title, className = '' }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy(event) {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard API needs a secure context; fall back to a hidden textarea.
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={title ?? label}
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition ${
        copied
          ? 'bg-emerald-500/20 text-emerald-300'
          : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'
      } ${className}`}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
